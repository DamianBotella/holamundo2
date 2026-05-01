# Workflows API REST (X5)

**Estado**: 📐 DRAFT. Importar tras X3 (RLS) + X4 (Supabase Auth) + migration `052_api_views.sql` aplicada.

---

## Patrón común

Todos los workflows API siguen el mismo flujo:

```
[Webhook GET /api/v1/...]
  → [Decode JWT + extract path/query params]
  → [IF auth OK?]                 ── error → [Respond 401/400/403]
  → [Postgres: set_session_context($user_id, $tenant_id, $role)]
  → [Postgres: SELECT v_<vista>]  ─ RLS filtra por tenant automáticamente
  → [Code: format response]
  → [Respond 200 with { data, meta }]
```

## Workflows en este directorio

| Archivo | Endpoint | View consumida |
|---|---|---|
| `util_jwt_verify.json` | (sub-workflow) | n/a — verifica JWT vía Supabase |
| `api_me.json` | `GET /api/v1/me` | `v_my_profile` |
| `api_projects_list.json` | `GET /api/v1/projects` | `v_project_summary` |
| `api_project_detail.json` | `GET /api/v1/projects/{id}` | `v_project_detail` |
| `api_project_timeline.json` | `GET /api/v1/projects/{id}/timeline` | `v_timeline` |
| `api_alerts_global.json` | `GET /api/v1/alerts/global` | `v_alerts` |
| `api_metrics_dashboard.json` | `GET /api/v1/metrics/dashboard` | `v_dashboard_metrics` |

## Pendientes (no construidos aún)

Cuando se haga X5 efectivo, replicar el patrón para:

- `GET /api/v1/projects/{id}/agent-runs` (consume `v_agent_runs`)
- `GET /api/v1/projects/{id}/alerts` (consume `v_alerts` filtrado por project_id)
- `POST /api/v1/projects/{id}/approve/{approval_id}`
- `GET /api/v1/trades` (consume `v_trade_overview`)
- `GET /api/v1/materials/{project_id}`
- `POST /api/v1/projects` (crear proyecto — wrapper sobre `init_new_project`)
- `PATCH /api/v1/studio-profile`
- `GET /api/v1/studio-profile`

Auth:
- `POST /api/v1/auth/login` (wrapper Supabase signInWithPassword)
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/users/invite` (sólo super_admin/architect)
- `GET /login` (HTML form mínimo)

## Antes de importar

1. Aplicar migrations 049 + 050 + 051 + 052 (todas como `.sql`, no `.draft`).
2. Reemplazar `PLACEHOLDER_POSTGRES_ID` con el ID real de la credencial Postgres en n8n.
3. Reemplazar `PLACEHOLDER_ERROR_HANDLER_ID` con el ID del workflow `error_handler`.
4. Verificar que el JWT viene con custom claims `tenant_id` + `role` (configurar Auth Hook en Supabase).
5. Smoke test cada endpoint con curl + JWT válido.

## Util compartido `util_jwt_verify`

Los workflows nuevos (`api_alerts_global`, `api_project_timeline`) usan
`util_jwt_verify` como sub-workflow vía `executeWorkflow`.

Los workflows iniciales (`api_me`, `api_projects_list`, `api_project_detail`,
`api_metrics_dashboard` — todos B38) tienen el decode inline. **TODO**: cuando
MCP vuelva, refactorizar esos 4 para que también usen `util_jwt_verify`.

Beneficios:
- Reduce ~30 líneas de JS duplicado por workflow.
- Un solo punto de cambio si Supabase rota la firma o cambia formato.
- Validación contra `/auth/v1/user` real, no sólo decode local.

## Test manual con curl

```bash
# Login (cuando X4 esté hecho)
TOKEN=$(curl -s -X POST https://<supabase>/auth/v1/token?grant_type=password \
  -H "apikey: <anon_key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"botelladesdeel98@gmail.com","password":"..."}' \
  | jq -r .access_token)

# /me
curl -H "Authorization: Bearer $TOKEN" \
  https://n8n-n8n.zzeluw.easypanel.host/webhook/api/v1/me

# /projects
curl -H "Authorization: Bearer $TOKEN" \
  "https://n8n-n8n.zzeluw.easypanel.host/webhook/api/v1/projects?limit=10"

# /projects/{id}
curl -H "Authorization: Bearer $TOKEN" \
  https://n8n-n8n.zzeluw.easypanel.host/webhook/api/v1/projects/0a53d09f-d8f7-444a-a074-42a3305ef49b

# /metrics/dashboard
curl -H "Authorization: Bearer $TOKEN" \
  https://n8n-n8n.zzeluw.easypanel.host/webhook/api/v1/metrics/dashboard
```
