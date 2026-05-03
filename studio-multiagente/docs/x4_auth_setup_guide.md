# X4 — Guía paso a paso para configurar Supabase Auth

**Estado**: 📋 Esperando ~30 min de Damián.
**Bloquea**: X5 (API REST) + X6 (UI Foxhole).

---

## Estado actual

- ✅ Workflow `util_jwt_verify.json` creado en repo (B43).
- ✅ Migration `051_user_profiles_auth.sql.draft` lista en repo.
- ✅ Migration `053_auth_triggers.sql.draft` lista en repo.
- ✅ foxhole-ui scaffolding creado (B55) — espera env vars para conectar.
- ⏳ **Tu acción**: configurar Supabase Auth + ejecutar migrations + crear usuarios iniciales.

---

## Paso 1 — Habilitar Email Auth en Supabase (5 min)

1. Dashboard Supabase → tu proyecto → **Authentication** (sidebar).
2. **Providers** → tab **Email** → **Enable** → **Save**.
3. **Settings** → desactiva **"Confirm email"** (en MVP no es necesario; cuando llegue producción real se activa).
4. **URL Configuration**:
   - Site URL: `http://localhost:5173` (cambiar a dominio real cuando deployes UI).
   - Redirect URLs (whitelist): añade `http://localhost:5173/**` y futuro dominio production.

## Paso 2 — Sacar las credenciales (1 min)

1. Sidebar → **Project Settings** → **API**.
2. Copia:
   - **Project URL**: `https://xxxxxxx.supabase.co` → para `SUPABASE_URL`.
   - **anon public**: empieza por `eyJ...` → para `SUPABASE_ANON_KEY`.
   - **service_role**: empieza por `eyJ...` → para tools admin (NO commitear).

## Paso 3 — Aplicar migrations 051 + 053 (3 min)

En SQL Editor de Supabase:

```sql
-- 051: tabla user_profiles + helpers de sesión
\i 051_user_profiles_auth.sql.draft
```

(O copia/pega el contenido del archivo. Renombra `.draft` → `.sql` después de ejecutar.)

Luego 053:
```sql
\i 053_auth_triggers.sql.draft
```

053 crea los Auth Hooks que inyectan `tenant_id` + `role` en el JWT cuando el usuario hace login. **Importante**: tras ejecutar 053, hay que registrar el hook desde Dashboard:

1. **Authentication** → **Hooks** (sidebar).
2. **Custom Access Token Hook** → habilitar.
3. Selecciona la función creada (`auth.add_custom_claims` o similar — ver 053).
4. **Save**.

## Paso 4 — Crear primer usuario super_admin (5 min)

1. Sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Email: `botelladesdeel98@gmail.com` (el tuyo).
3. Password: el que prefieras.
4. **Auto Confirm User**: ✅.
5. **Create user**.

Luego en SQL Editor:
```sql
-- Vincular el auth.users con tu tenant + role super_admin
INSERT INTO user_profiles (user_id, full_name, role, tenant_id)
SELECT id, 'Damián Martínez', 'super_admin',
  (SELECT id FROM tenants WHERE slug='damian-mtnz')
FROM auth.users
WHERE email = 'botelladesdeel98@gmail.com'
ON CONFLICT (user_id) DO UPDATE
  SET role = 'super_admin', tenant_id = EXCLUDED.tenant_id;

-- Verificar
SELECT u.email, p.full_name, p.role, t.slug AS tenant
FROM auth.users u
JOIN user_profiles p ON p.user_id = u.id
JOIN tenants t ON t.id = p.tenant_id
WHERE u.email = 'botelladesdeel98@gmail.com';
```

Esperado: 1 fila con `role=super_admin` y `tenant=damian-mtnz`.

## Paso 5 — Conectar la UI Foxhole (5 min)

```bash
cd studio-multiagente/foxhole-ui
cp .env.example .env
```

Edita `.env`:
```
VITE_N8N_API_BASE=https://n8n-n8n.zzeluw.easypanel.host/webhook/api/v1
VITE_SUPABASE_URL=https://xxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_FORCE_MOCK=false
```

```bash
npm install
npm run dev
```

Abre http://localhost:5173. **NOTA**: como aún no hay endpoints `/api/v1/*` en n8n, la UI seguirá usando mock fallback. Verás banner "MOCK DATA" en la TopBar hasta que X5 aplique los workflows API.

## Paso 6 — Smoke test JWT con curl (5 min)

```bash
# 1. Login (simula lo que hará la UI)
TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"botelladesdeel98@gmail.com","password":"<tu_password>"}' \
  | jq -r .access_token)

echo "JWT: $TOKEN"

# 2. Decodear el JWT y verificar que tiene custom claims
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq

# Esperado: { ..., "tenant_id": "bbf3f07e-...", "role": "super_admin" }
# Si tenant_id y role NO aparecen, el Custom Access Token Hook (paso 3) no está activado.
```

Si el JWT contiene `tenant_id` y `role` → ✅ X4 listo. Si no, revisar Paso 3 (Hooks).

---

## Después de X4: avanzar a X5

Con Auth funcionando + JWT con claims correctos, X5 (API REST) consiste en:

1. Aplicar migration `052_api_views.sql` (ya refinada en B55).
2. Importar los 7 workflows API a n8n (`util_jwt_verify`, `api_me`, `api_projects_list`, `api_project_detail`, `api_project_timeline`, `api_alerts_global`, `api_metrics_dashboard`).
3. Reemplazar PLACEHOLDER credentials en cada uno con el ID real de Postgres + Supabase Auth.
4. Activar workflows.
5. Smoke test cada endpoint con el TOKEN del paso 6.
6. La UI Foxhole automáticamente quitará el banner "MOCK DATA" cuando los endpoints respondan.

Esfuerzo X5: ~3-4h.

---

## Checklist X4 (marca cuando termines)

- [ ] Email Auth habilitado en Supabase.
- [ ] Site URL + Redirect URLs configurados.
- [ ] Migration 051 aplicada (tabla `user_profiles`).
- [ ] Migration 053 aplicada (auth triggers).
- [ ] Custom Access Token Hook registrado en Dashboard.
- [ ] Usuario super_admin creado en Auth.
- [ ] INSERT en `user_profiles` vinculando user_id + tenant + role.
- [ ] Verificación: SELECT confirma 1 fila con role=super_admin.
- [ ] foxhole-ui `.env` configurado.
- [ ] `npm install && npm run dev` arranca sin errores.
- [ ] Smoke curl: TOKEN obtenido + JWT decodificado contiene `tenant_id` + `role`.

Cuando todo esté ✅ → dime "X4 listo" y arranco X5.
