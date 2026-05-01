# X4 — Auth con Supabase Auth — diseño

**Estado**: 📐 DRAFT (B38).
**Bloquea**: X5 (API contract necesita JWT validado) y X6 (UI Foxhole necesita login).
**Pre-requisito**: X3 (RLS) aplicado — porque sin RLS, el `tenant_id` del JWT no protege nada.

---

## TL;DR

Supabase Auth nativo provee `auth.users`, JWT firmado, OAuth, magic link, password reset. Necesitamos:

1. Configurar el "Auth Hook" de Supabase para inyectar `tenant_id` y `role` como custom claims en el JWT (server-side, **no** del cliente).
2. Aplicar migration `051_user_profiles_auth.sql` (ya en draft).
3. Crear 5 workflows n8n: `api_auth_login`, `api_auth_logout`, `api_auth_signup_invite`, `api_auth_password_reset`, `util_jwt_verify`.
4. UI mínima de login en HTML (servida por n8n) — antes de UI Foxhole real.

**Total**: ~6-8h (consistente con plan original).

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Foxhole / Login HTML                  │
│                                                                 │
│   email + password ──┐                                          │
│                      │                                          │
└──────────────────────┼──────────────────────────────────────────┘
                       │ POST /auth/v1/token?grant_type=password
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Auth (nativo)                       │
│                                                                 │
│   1. Verifica credenciales contra auth.users                    │
│   2. Llama Auth Hook (function) → resuelve tenant_id + role     │
│   3. Firma JWT con custom claims                                │
└──────────────────────────────────────────────────────────────────┘
                       │ JWT con { sub, email, tenant_id, role, exp }
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  UI guarda el JWT                               │
│   - localStorage (vulnerable a XSS) o                            │
│   - httpOnly cookie set por endpoint n8n (recomendado)          │
└──────────────────────────────────────────────────────────────────┘
                       │ Authorization: Bearer <JWT>
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│             n8n workflows api_*                                 │
│                                                                 │
│   1. Decode JWT (sin verificar firma todavía)                   │
│   2. util_jwt_verify → valida firma + exp + active=true         │
│   3. set_session_context(user_id, tenant_id, role)              │
│   4. Query → RLS filtra automáticamente                         │
│   5. Return { data, meta }                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Decisiones de diseño

### 1. Supabase Auth nativo, NO custom auth en n8n

Pros:
- OAuth providers (Google, GitHub) gratis.
- Magic link, password reset, email verification: ya funcionan.
- JWT firmado con secret rotado periódicamente.
- Rate limit incluido.
- `auth.users` table existente desde día 1.

Contras:
- Vendor lock-in con Supabase.
- Custom claims requieren Auth Hook (function en Postgres) — overhead inicial.

**Decisión**: vale la pena. Construir auth desde 0 en n8n para validar firma JWT, password hashing seguro, OAuth flows... son semanas de trabajo y bugs. Supabase lo da out-of-the-box.

### 2. Custom claims server-side (Auth Hook)

**Problema**: el cliente no puede setear `tenant_id` en el JWT — sería trivial falsificarlo.

**Solución**: Auth Hook de Supabase. Function Postgres que se ejecuta tras login y antes de firmar el JWT:

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  claims jsonb;
  user_id uuid;
  profile record;
BEGIN
  user_id := (event->>'user_id')::uuid;
  claims  := event->'claims';

  SELECT tenant_id, role, full_name, active
    INTO profile
    FROM public.user_profiles
   WHERE user_profiles.user_id = user_id
   LIMIT 1;

  IF NOT FOUND OR NOT profile.active THEN
    -- Bloquear login: el usuario está en auth.users pero no tiene perfil activo
    RAISE EXCEPTION 'User has no active profile';
  END IF;

  claims := jsonb_set(claims, '{tenant_id}', to_jsonb(profile.tenant_id::text));
  claims := jsonb_set(claims, '{role}',      to_jsonb(profile.role));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Registrar en Supabase Dashboard → Authentication → Hooks → Custom Access Token
```

Esta función se llama automáticamente en cada `signInWithPassword` o refresh token. El `tenant_id` y `role` quedan firmados en el JWT — imposible falsificar sin romper la firma.

### 3. Validación JWT en n8n: `util_jwt_verify`

n8n no tiene nodo nativo de validación JWT. Hay 2 opciones:

**A. Sub-workflow util_jwt_verify** (recomendada):
- Recibe el header `Authorization`.
- Code node verifica firma con la `JWT_SECRET` de Supabase via `crypto.createHmac` (HS256) o llamada HTTP a Supabase `/auth/v1/user`.
- Devuelve `{ user_id, tenant_id, role, valid }`.

**B. HTTP Request a Supabase** `GET /auth/v1/user`:
- Pasas el JWT en header.
- Si Supabase devuelve 200 → válido.
- Latencia: +50-100ms por endpoint.

Decisión: empezar con B (más simple, menos código en n8n). Si latencia molesta, migrar a A.

### 4. Roles y permisos

| Rol | Capacidades |
|---|---|
| `architect` | CRUD completo sobre proyectos del tenant. Ve/edita el studio_profile. |
| `colaborador` | Read-only sobre proyectos del tenant. NO puede aprobar ni crear. |
| `super_admin` | Cross-tenant — sólo Damián. Usado para soporte y debugging. |

**Implementación de permisos**:
- En cada workflow API, después de `set_session_context`, un IF chequea `role` antes de operaciones de escritura.
- En la UI, el frontend oculta botones según `me.role` (defense-in-depth, no security primaria).
- RLS sigue siendo la única capa que protege datos.

### 5. Flow de signup: invitación, no auto-registro

Decisión: NO hay signup público. Sólo Damián (super_admin) puede invitar usuarios.

Flow de alta:
1. Damián desde la UI llama `POST /api/v1/users/invite` con `{ email, tenant_id, role }`.
2. n8n llama Supabase Admin API `/auth/v1/admin/invite_by_email`.
3. Supabase manda email con magic link.
4. Usuario hace click → completa password → Supabase crea fila en `auth.users`.
5. Trigger Postgres en `auth.users INSERT` crea fila correspondiente en `user_profiles` (con tenant_id de la invitación, leído de tabla auxiliar `pending_invitations`).

Esto evita: usuarios random registrándose, spam, abuso del free tier.

### 6. Logout: revocar refresh token

Supabase Auth maneja el logout vía `POST /auth/v1/logout`. El access_token sigue siendo válido hasta que expira (1h por defecto), pero el refresh_token queda invalidado.

Alternativa: blocklist de access_tokens en Postgres (más complejo, casi nunca necesario).

### 7. Recovery: password reset por email

Flow estándar Supabase:
1. UI: "Olvidé mi contraseña" → llama `POST /auth/v1/recover`.
2. Supabase manda email con link de un solo uso.
3. Click → UI muestra form "nuevo password" → llama `PUT /auth/v1/user`.
4. Hecho.

Sin código custom en n8n.

---

## Workflows n8n a crear (X4)

| Archivo | Endpoint | Función |
|---|---|---|
| `workflows/api/api_auth_login.json` | `POST /api/v1/auth/login` | Wrapper sobre Supabase `signInWithPassword`. Devuelve `{ access_token, refresh_token, user }`. Setea httpOnly cookie. |
| `workflows/api/api_auth_logout.json` | `POST /api/v1/auth/logout` | Wrapper sobre Supabase logout. Limpia cookie. |
| `workflows/api/api_auth_refresh.json` | `POST /api/v1/auth/refresh` | Wrapper sobre Supabase `refreshSession`. |
| `workflows/api/api_auth_invite.json` | `POST /api/v1/users/invite` | Sólo super_admin/architect. Invita email. |
| `workflows/api/util_jwt_verify.json` | sub-workflow | Verifica JWT vía Supabase `/auth/v1/user`. |
| `workflows/api/login_html.json` | `GET /login` | Sirve UI mínima HTML antes de UI Foxhole. |

---

## SQL adicional (extiende migration 051)

Trigger sobre `auth.users` para crear `user_profiles` automáticamente:

```sql
CREATE TABLE IF NOT EXISTS pending_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  role        text NOT NULL DEFAULT 'architect'
              CHECK (role IN ('architect', 'colaborador', 'super_admin')),
  invited_by  uuid,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_invitations_email ON pending_invitations (lower(email))
  WHERE consumed_at IS NULL;

CREATE OR REPLACE FUNCTION on_auth_user_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  inv pending_invitations;
BEGIN
  -- Buscar invitación pendiente
  SELECT * INTO inv
    FROM pending_invitations
   WHERE lower(email) = lower(NEW.email)
     AND consumed_at IS NULL
     AND expires_at > now()
   LIMIT 1;

  IF NOT FOUND THEN
    -- Sin invitación, crear como architect del tenant baseline
    -- (sólo en desarrollo - en producción bloquear con RAISE)
    INSERT INTO user_profiles (user_id, tenant_id, role, full_name, email)
    VALUES (NEW.id,
            (SELECT id FROM tenants WHERE slug='damian-mtnz' LIMIT 1),
            'architect',
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            NEW.email);
  ELSE
    INSERT INTO user_profiles (user_id, tenant_id, role, full_name, email)
    VALUES (NEW.id, inv.tenant_id, inv.role,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            NEW.email);

    UPDATE pending_invitations SET consumed_at = now() WHERE id = inv.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION on_auth_user_created();
```

Esto va en `migration 053_auth_triggers.sql` (lo creo abajo).

---

## Patrón JWT verify en cada API workflow

Refactor del decode-JWT-en-cada-workflow (duplicación) a un sub-workflow `util_jwt_verify`:

```javascript
// En CADA workflow api_*, en lugar del decode local:
const verified = await $executeWorkflow({
  workflowId: 'util_jwt_verify',
  input: { authorization: $input.first().json.headers?.authorization }
});

if (!verified.valid) {
  return [{ json: { _error: verified.code, _status: verified.status } }];
}

return [{ json: {
  user_id:    verified.user_id,
  tenant_id:  verified.tenant_id,
  role:       verified.role,
  request_id: 'req_' + Math.random().toString(36).slice(2, 10)
}}];
```

Cuando MCP vuelva, refactorizar los 4 workflows api_* (B38) para usar este patrón.

---

## Roadmap de implementación

### Fase A — pre-requisitos (~1h)
1. Verificar X3 aplicado (049 + 050 en BD).
2. Aplicar `051_user_profiles_auth.sql` (en draft).
3. Crear migration `053_auth_triggers.sql` (con `pending_invitations` + trigger).

### Fase B — Supabase Auth setup (~1h)
4. Habilitar email auth en Supabase Dashboard.
5. Crear y registrar `custom_access_token_hook` (SQL arriba).
6. Crear primer usuario `auth.users` para Damián manualmente.
7. Verificar manualmente que login devuelve JWT con `tenant_id` claim.

### Fase C — workflows n8n (~3-4h)
8. Crear `util_jwt_verify` sub-workflow.
9. Crear `api_auth_login`, `api_auth_logout`, `api_auth_refresh`.
10. Crear `api_auth_invite` (sólo architect/super_admin).
11. Refactorizar los 4 workflows api_* (B38) para usar `util_jwt_verify`.

### Fase D — UI mínima HTML (~1h)
12. Crear `login_html.json` que sirve `<form>` simple.
13. JS que postea a `/api/v1/auth/login`, guarda JWT en httpOnly cookie, redirect a `/`.

### Fase E — verificación (~1h)
14. Smoke test completo: login → /me → /projects → logout → /me (debe 401).
15. Verificar JWT custom claims con jwt.io.
16. Crear 2º usuario en otro tenant → verificar aislamiento RLS funciona vía API.

**Total Fase A-E**: ~7h (consistente con estimación 6-8h).

---

## Riesgos

1. **Auth Hook no se llama**: si Supabase no encuentra la función registrada, JWT sale sin custom claims → workflows api_* rompen con `tenant_id is null`. **Mitigación**: smoke test inmediato después de configurar el hook.

2. **Trigger `on_auth_user_created` falla en signup**: si el INSERT en `user_profiles` rompe, el usuario queda en `auth.users` huérfano. **Mitigación**: trigger con `EXCEPTION WHEN OTHERS` que log a `activity_log` pero no bloquee el INSERT en `auth.users`. Tarea de housekeeping para reconciliar.

3. **JWT_SECRET de Supabase rota**: si Supabase rota el secret, JWTs vivos quedan inválidos. **Mitigación**: usar la opción B (HTTP Request a Supabase /auth/v1/user) en lugar de verificar firma local. La API de Supabase siempre usa el secret actual.

4. **Cookies cross-domain**: si la UI Foxhole vive en `app.arquitai.com` y la API en `n8n.arquitai.com`, las cookies cross-subdomain requieren `SameSite=None; Secure` y que ambos compartan dominio padre. **Mitigación**: usar `localStorage` provisionalmente, migrar a cookies cuando dominio definitivo esté claro.

5. **Rate limit en login fallido**: Supabase nativo limita ~5 intentos/min/IP. Suficiente para password attacks. Verificar en Dashboard → Auth Settings.

---

## Archivos a generar (en X4 efectivo)

- `schemas/migrations/053_auth_triggers.sql` (lo creo en este commit como `.draft`).
- `workflows/api/util_jwt_verify.json`
- `workflows/api/api_auth_login.json`
- `workflows/api/api_auth_logout.json`
- `workflows/api/api_auth_refresh.json`
- `workflows/api/api_auth_invite.json`
- `workflows/api/login_html.json`
- `docs/x4_auth_smoke_test.md` (post-implementación, evidencia)

---

## Referencias

- [Supabase Auth — Custom Claims](https://supabase.com/docs/guides/auth/auth-hooks#hooks-overview)
- [Supabase Auth — Password Reset](https://supabase.com/docs/guides/auth/passwords#password-recovery)
- `studio-multiagente/docs/api_v1.yaml` — endpoints que requieren auth.
- `studio-multiagente/docs/x3_multi_tenant_design.md` — RLS que auth alimenta.
- `studio-multiagente/schemas/migrations/051_user_profiles_auth.sql.draft` — base.
