# X3 — Multi-tenant + RLS — diseño y plan de aplicación

**Estado**: 📐 DRAFT (migrations en `.draft`, no aplicadas).
**Fecha**: 2026-05-01 (B35 post-X1).
**Bloquea**: X4 (auth) + X5 (API contract) + X6 (UI Foxhole).

---

## TL;DR

Hoy ArquitAI es **mono-tenant** (sólo Damián). Para vender como SaaS necesita aislamiento real entre estudios. El plan: tres migrations en `schemas/migrations/`:

| # | Archivo | Qué hace | Cuándo aplicar |
|---|---|---|---|
| 049 | `049_multi_tenant_extend.sql.draft` | Añade `tenant_id` a 8 tablas raíz que faltan + backfill al tenant baseline | Primera, sin downtime |
| 050 | `050_rls_enable.sql.draft` | Habilita RLS en 30+ tablas + helpers `set_tenant_context()` | Segunda, **requiere actualizar workflows en paralelo** |
| 051 | `051_user_profiles_auth.sql.draft` | Tabla `user_profiles` + linker auth.users + helpers de sesión | Tercera (X4) — sólo cuando se active Supabase Auth |

Las extensiones `.draft` son intencionadas: estos archivos NO se aplican automáticamente. Damián los renombra a `.sql` cuando tenga la ventana de mantenimiento adecuada.

---

## Estado actual (auditoría 2026-05-01)

| Tabla | tenant_id | Origen |
|---|---|---|
| `projects` | ✅ | migration 030 |
| `clients` | ✅ | migration 030 |
| `collaborators` | ✅ | migration 030 |
| `tenants` | (es la propia tabla) | migration 030 |
| `studio_profile` | ❌ | falta (049) |
| `onboarding_sessions` | ❌ | falta (049) |
| `supplier_catalog` | ❌ | falta (049) |
| `project_notes` | ❌ | falta (049) |
| `contract_templates` | ❌ | falta (049) |
| `certificates` | ❌ | falta (049) |
| `contracts` | ❌ | falta (049) |
| `invoices` | ❌ | falta (049) |
| `briefings`, `design_options`, `regulatory_tasks`, etc. (~25 tablas pipeline) | (no necesitan) | heredan via `project_id` (RLS subquery) |

**RLS**: actualmente NO activo en ninguna tabla. Función `current_tenant_id()` ya existe (migration 030) pero ningún workflow la usa porque no hay políticas que filtren.

---

## Decisiones de diseño

### 1. Híbrido tenant_id directo + herencia via project_id

Hay dos approaches puros:

- **A. tenant_id en cada tabla**: rápido pero 30+ ALTER TABLE, 30+ backfills, 30+ índices.
- **B. Sólo en raíces**: queries pipeline pasan por subquery a projects.

Hemos elegido **híbrido**:
- **Raíces** (`projects`, `clients`, `studio_profile`, `supplier_catalog`, etc.) → `tenant_id` directo.
- **Pipeline** (`briefings`, `design_options`, `regulatory_tasks`, `material_items`, etc.) → RLS por subquery `WHERE project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id())`.

Justificación: las pipeline tablas siempre se consultan por `project_id` (ya hay índice), la subquery es barata. Evitamos 25 ALTER TABLE.

### 2. tenant_id NULL = global (excepción controlada)

`supplier_catalog` y `contract_templates` permiten filas con `tenant_id IS NULL` que actúan como **seeds globales** visibles para todos los tenants. La política RLS:

```sql
USING (tenant_id IS NULL OR tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id())  -- inserts SIEMPRE con tenant
```

Lecturas ven globales + propios; escrituras siempre tagged con el tenant actual. Damián mantiene seeds globales editables por super_admin.

### 3. Tablas globales SIN RLS

Estas siguen siendo cross-tenant (no pertenecen a nadie):

- `agent_prompts` — prompts compartidos del producto.
- `normativa_knowledge`, `normativa_sources` — normativa española es la misma para todos.
- `price_references` — CYPE/BEDEC global.
- `llm_calls` — billing total del producto.
- `security_events`, `access_log`, `rate_limits`, `ip_blocklist` — capa infra.
- `applied_migrations`, `system_config`, `system_health_score`, `db_size_history` — meta.

Si en el futuro hay billing por tenant, se añade `tenant_id` a `llm_calls` con migration nueva.

### 4. super_admin bypass para Damián

Helper `is_super_admin()` lee `app.role` de la sesión. Las políticas pueden incluir:

```sql
USING (is_super_admin() OR tenant_id = current_tenant_id())
```

Pero por **seguridad por defecto** las políticas en 050 NO incluyen el bypass — Damián tendrá que setear `app.current_tenant` al tenant que quiera ver. Esto evita bugs donde un workflow olvida setear el tenant y de pronto ve todo.

El bypass se reserva para herramientas administrativas explícitas (admin panel, scripts de mantenimiento).

---

## Cómo aplicar — orden y verificación

### Pre-requisitos

```bash
# 1. Drift cero antes de empezar
cd studio-multiagente/scripts
python check_migration_drift.py --check
# Debe devolver: OK

# 2. Backup de la BD
# (Supabase Dashboard → Database → Backups → Create new backup)
```

### Paso 1: aplicar 049 (tenant_id extend)

**Sin downtime** — sólo añade columnas + backfill al tenant baseline.

```bash
mv studio-multiagente/schemas/migrations/049_multi_tenant_extend.sql.draft \
   studio-multiagente/schemas/migrations/049_multi_tenant_extend.sql
```

Aplicar en Supabase SQL Editor. Verificar:

```sql
SELECT count(*) FROM studio_profile WHERE tenant_id IS NULL;          -- 0
SELECT count(*) FROM onboarding_sessions WHERE tenant_id IS NULL;     -- 0
SELECT count(*) FROM contracts WHERE tenant_id IS NULL;               -- 0
SELECT count(*) FROM invoices WHERE tenant_id IS NULL;                -- 0
```

### Paso 2: actualizar workflows n8n para setear tenant context

**ANTES de aplicar 050**, todos los workflows que tocan tablas tenant-scoped deben empezar con:

```sql
-- Postgres node "Set Tenant Context" (primer nodo después del trigger)
SELECT set_tenant_context($1::uuid);
```

donde `$1` viene del input del workflow (típicamente derivado de `project_id` via `resolve_tenant_from_project()`, o del JWT en endpoints API).

**Workflows críticos a actualizar** (lista parcial — auditar todos):
- `init_new_project` — recibe tenant_id en payload o lo deriva del client
- `main_orchestrator` — resuelve desde project_id
- `agent_briefing` y los otros 12 agentes — resuelven desde project_id
- `util_*` — propagar tenant del invocador
- `cron_*` — usar `set_tenant_context()` por cada tenant en bucle (los crones globales necesitan otra estrategia: NO setear tenant y skip RLS via SECURITY DEFINER)

### Paso 3: aplicar 050 (RLS enable)

**Esta migration cambia el comportamiento del sistema**: si un workflow no setea tenant, todas sus queries devuelven 0 filas.

```bash
mv studio-multiagente/schemas/migrations/050_rls_enable.sql.draft \
   studio-multiagente/schemas/migrations/050_rls_enable.sql
```

Aplicar y **inmediatamente** correr smoke test:

```bash
# Disparar workflow init_new_project con un payload de prueba
curl -X POST https://n8n-n8n.zzeluw.easypanel.host/webhook/new-project \
  -H "Content-Type: application/json" \
  -d '{ "client_name": "Test RLS", ... }'

# Verificar que el proyecto se creó en el tenant correcto
SELECT id, name, tenant_id FROM projects ORDER BY created_at DESC LIMIT 1;
```

Si algo falla → ROLLBACK rápido:

```sql
-- Deshabilitar TODAS las RLS (emergencia)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables
           WHERE schemaname='public' AND rowsecurity=true LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
```

### Paso 4: aplicar 051 (user_profiles) — sólo cuando X4 (Supabase Auth)

No se aplica hasta que Supabase Auth esté habilitado. Requiere que `auth.users` exista (Supabase nativo) y que Damián se registre como primer usuario.

```bash
mv studio-multiagente/schemas/migrations/051_user_profiles_auth.sql.draft \
   studio-multiagente/schemas/migrations/051_user_profiles_auth.sql
```

Tras aplicar, hacer el INSERT manual del super_admin (commented en la migration).

---

## Patrón para n8n workflows post-RLS

### Patrón A — workflow que recibe `project_id`

```
[Trigger] → [Postgres: SELECT tenant_id FROM projects WHERE id = $project_id]
         → [Postgres: SELECT set_tenant_context($tenant_id::uuid)]
         → [resto del workflow]
```

### Patrón B — workflow que recibe JWT (endpoint API)

```
[Webhook] → [Code: decode JWT, extract user_id + tenant_id + role]
         → [Postgres: SELECT set_session_context($user_id, $tenant_id, $role)]
         → [resto del workflow]
```

### Patrón C — cron global que itera tenants

```
[Schedule] → [Postgres: SELECT id FROM tenants WHERE active = true]
          → [SplitInBatches per tenant]
          → [Postgres: SELECT set_tenant_context($tenant_id)]
          → [tareas del cron]
```

### Patrón D — operación admin cross-tenant

```
[Webhook + admin auth] → [Postgres: SELECT set_session_context(uid, tid, 'super_admin')]
                       → [usar políticas que respeten is_super_admin() bypass]
```

---

## Checklist de verificación post-X3

- [ ] `check_migration_drift.py --check` pasa.
- [ ] Crear 2º tenant: `INSERT INTO tenants (slug, name) VALUES ('test-tenant-b', 'Tenant B Test');`
- [ ] Crear projecto en tenant A → setear contexto tenant A → query devuelve 1 proyecto.
- [ ] Setear contexto tenant B → query devuelve 0 proyectos del tenant A.
- [ ] Setear contexto NULL → query devuelve 0 proyectos (RLS rechaza).
- [ ] Crear proyecto en tenant B → query con contexto B devuelve sólo el de B.
- [ ] Cron `cron_e2e_smoke_test` corre sin errores tras aplicar 050.
- [ ] Auditar log de errores 24h post-deploy buscando "permission denied" o "row violates RLS".
- [ ] Documentar en `docs/e2e_evidence_x3_<fecha>.md` los smoke tests con outputs.

---

## Riesgos conocidos

1. **Workflow olvida setear tenant** → queries devuelven 0 filas, fallos silenciosos. **Mitigación**: log de access que detecta queries con `tenant_id IS NULL` en sesión y alerta. Añadir a `cron_health_check`.

2. **Crones globales rompen** → un cron que itera todos los proyectos sin setear tenant ya no ve nada. **Mitigación**: usar Patrón C arriba o marcar el cron como `SECURITY DEFINER` (bypass RLS controlado).

3. **Performance**: subqueries `WHERE project_id IN (SELECT...)` añaden coste. **Mitigación**: `idx_projects_tenant` ya creado en 030. Postgres usa nested loop o hash. Medir antes de optimizar.

4. **Backfill de seeds globales en supplier_catalog**: la migration deja como global (NULL) sólo `source_type = 'global_seed'`. Si hay otros seeds con otro source_type, ajustar el WHERE de 049.

5. **JWT con tenant_id falsificado**: Supabase Auth firma JWT — el tenant_id debe venir de un custom claim emitido SERVER-SIDE en login (no del cliente). Validar la firma JWT en cada request del API.

---

## Estimación

| Tarea | Esfuerzo |
|---|---|
| Aplicar 049 | 30min |
| Auditar y actualizar 13 agentes + 5 utils + 30+ crones para usar `set_tenant_context()` | 4-6h |
| Aplicar 050 + smoke tests | 2h |
| Aplicar 051 (cuando X4) | 30min |
| Crear 2º tenant test + verificar aislamiento | 1h |
| Ajustar bugs encontrados durante smoke | 2-4h estimación |
| **Total X3 efectivo** | **10-14h** |

Coincide con la estimación original del plan (12-15h).

---

## Próximas sesiones encadenadas

Una vez X3 cerrado:

- **X4 (auth)**: ahora sí se aplica `051_user_profiles_auth.sql`. Login UI mínima. JWT firmado por Supabase Auth con custom claim `tenant_id` emitido server-side.
- **X5 (API contract)**: implementar los endpoints del `docs/api_v1.yaml` como workflows n8n. Cada endpoint usa Patrón B.
- **X6 (UI Foxhole)**: consume API. Ya tiene aislamiento real entre estudios.

---

## Archivos relacionados

- `schemas/migrations/030_rls_template.sql` — base existente.
- `schemas/migrations/049_multi_tenant_extend.sql.draft` — extensión.
- `schemas/migrations/050_rls_enable.sql.draft` — RLS policies.
- `schemas/migrations/051_user_profiles_auth.sql.draft` — auth linker.
- `docs/api_v1.yaml` — contrato API que requiere RLS activo.
- `docs/plan_pre_interfaz_foxhole.md` — plan global X1-X6.
