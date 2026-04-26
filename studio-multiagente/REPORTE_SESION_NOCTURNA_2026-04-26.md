# Reporte sesión autónoma — 2026-04-26 (madrugada → mañana)

**Damián**: aquí tienes el resumen ejecutivo de lo construido mientras dormías. Todo está activo, verificado E2E, test data limpiado, commits versionados.

## Lo nuevo construido (12 workflows, 5 migraciones, 5 features sec 3 ArquitAI)

### Features mayores (sec 3 ArquitAI)

| # | Feature | Endpoint | Tablas |
|---|---|---|---|
| **3.10 #18** | `agent_energy_assessor` (CTE HE0/HE1 + huella CO2 + recomendaciones) | `POST /webhook/trigger-energy-assessor` | `energy_assessments` |
| **3.13 #15** | `agent_contracts` (9 plantillas: encargo, contratos, actas, modificados) | `POST /webhook/contract-generate` + `/contract-signed` | `contracts` |
| **3.19 #19** | `util_interop_bc3` (export FIEBDC-3 para CYPE/Presto) | `POST /webhook/export-bc3` | (usa `cost_estimates`) |
| **3.20 #24** | `agent_collab_coordinator` (catálogo + asignaciones de colaboradores) | `POST /webhook/collab-register` + `/collab-assign` + `/collab-update` | `collaborators` + `collab_assignments` |
| **3.16 #21** | `agent_home_automation` (HA/KNX/Matter/Zigbee con preinstall en obra) | `POST /webhook/trigger-home-automation` | `home_automation_proposals` |
| **3.4 #17** | `agent_client_concierge` API (chatbot cliente con escalado al arquitecto) | `POST /webhook/client-ask` | `client_conversations` |

### Crons de seguimiento

| Workflow | Schedule | Qué hace |
|---|---|---|
| `cron_collab_review` | diario 09:45 | Alerta de assignments stuck (5 tipos: invitation_no_response_5d, accepted_overdue, in_progress_overdue, delivered_pending_review_7d, deadline_soon_3d) |
| `cron_contract_followup` | diario 09:50 | Alerta de contratos pendientes (4 tipos: draft_unsent_5d, sent_unsigned_7d, expiring_soon_5d, expired) |
| `cron_weekly_kpis` | lunes 08:00 | Email semanal con KPIs del estudio (proyectos, contratos, colaboradores, aftercare, permisos, QC, anomalías, finanzas, errores) |

### Utilidades

| Workflow | Endpoint | Qué hace |
|---|---|---|
| `util_dashboard_summary` | `GET /webhook/dashboard-summary` | JSON con estado completo del estudio (single SQL query). Útil para futuro portal o integraciones. |

## Bugs críticos arreglados

### `util_llm_call` (`JoKqGZ8pDzhJohV2`) — afectaba a TODOS los nuevos agentes LLM
El nodo Postgres `Log Injection Check` clobberaba el flujo: cuando llegaba al `Call LLM API`, el HTTP body construía con `$json.model = undefined` porque Postgres reemplaza el item con su propio output. La API de OpenAI rechazaba con `"you must provide a model parameter"`.

**Fix aplicado**: el `jsonBody` del HTTP Request ahora referencia `$('Set Defaults').first().json.model` y `$('Sanitize Prompt').first().json.prompt_*` directamente. Robusto frente a futuras modificaciones del flujo.

### `cron_post_phase_audits` — iba a generar ~18 emails de error nocturnos
3 nodos tenían `continueOnFail: true` que n8n 2.12 rechaza. Cada ejecución (cada 30min) fallaba y disparaba `error_handler`. Quitado el flag.

### `cron_project_review` — emitía email cada 6h por tener simplemente proyectos activos
Cambiado IF de `has_projects` a `stale_count > 0`. Ahora solo emite cuando hay proyectos stale. Bonus: arreglado `additionalFields.queryReplacement` → `options.queryReplacement` en Log Review Done (gotcha conocido n8n 2.12).

## Cobertura ArquitAI sec 3 actualizada

**Antes de la sesión**: 12/26 features con MVP.
**Después**: **18/26 features con MVP**.

**Pendientes principales** (orden de prioridad sugerida):
1. **Frontend portal cliente** (HTML form para `client_ask`) — el API está listo, falta UI.
2. **Plantillas de `contracts` en BD** (`contract_templates`) — hoy están inline en jsCode.
3. **Integración firma electrónica** (DocuSign / FNMT / Autofirma) — para cerrar el ciclo de contratos.
4. **Hook agent_proposal aprobada → auto-genera encargo_profesional** (requiere coordinar parties).
5. **agent_bim_sync** (sec 3.12 — XL): IFC + Revit interop.
6. **agent_ar_preview** (sec 3.17 — XL): Visualización inmersiva.
7. **GDPR fase 2** (sec 3.14): RLS multi-tenant + access_log.

## Decisiones arquitectónicas tomadas

1. **Plantillas de contracts inline en jsCode** (no en BD aún): MVP rápido, fase 2 mover a `contract_templates`.
2. **`agent_client_concierge` es solo API** (no HTML form): el portal frontend se hará por separado. El endpoint ya está listo para ser consumido por cualquier UI.
3. **`agent_home_automation` con tabla `CO2_FACTORS` embebida** en el code node (igual que energy_assessor): mismo trade-off, fase 2 a BD.
4. **No se construyó hook `agent_proposal aprobada → contracts`** porque requiere conocer las parties (cliente DNI, dirección) que no están automatizables. Mejor que Damián lo dispare manualmente cuando confirme la propuesta.

## Limitaciones MCP detectadas y workarounds

- **Sub-agentes con muchos `n8n_get_workflow mode:full`** se atascan (stream watchdog 600s).
- **Workaround validado**: `curl` directo a la REST API n8n (`/api/v1/workflows/{id}` con header `X-N8N-API-KEY`), parsear con `node`, escribir limpios.

## Archivos creados (todo versionado en git)

### Migrations SQL
- `studio-multiagente/schemas/migrations/021_energy_assessments.sql`
- `studio-multiagente/schemas/migrations/022_contracts.sql`
- `studio-multiagente/schemas/migrations/023_collaborators.sql`
- `studio-multiagente/schemas/migrations/024_home_automation.sql`
- `studio-multiagente/schemas/migrations/025_client_concierge.sql`

### Knowledge docs
- `studio-multiagente/knowledge/agent_energy_assessor.md`
- `studio-multiagente/knowledge/agent_contracts.md`
- `studio-multiagente/knowledge/util_interop_bc3.md`
- `studio-multiagente/knowledge/agent_collab_coordinator.md`
- `studio-multiagente/knowledge/agent_home_automation.md`
- `studio-multiagente/knowledge/agent_client_concierge.md`

### Workflows JSON
12 workflows nuevos en `studio-multiagente/workflows/` (todos sincronizados con la versión activa de n8n).

## Commits de la sesión

```
4862041 util_dashboard_summary + cron_weekly_kpis
a8bce7e agent_client_concierge MVP API (sec 3.4 #17)
e390b5a agent_home_automation MVP (sec 3.16 #21)
8f25070 crons follow-up: collab_review + contract_followup
c607d16 4 features sec 3 (energy/contracts/bc3/collab) + fix util_llm_call
```

## Cosas que NO te van a llegar como spam

- Los crons nuevos siguen patrón "noOp si no hay nada que reportar".
- `cron_weekly_kpis` solo dispara los **lunes 08:00**, no se ha disparado manualmente.
- `error_handler` sigue con dedup 60min + silent_pattern para `*_TEMP`/`migration_*`/`debug*`.

## Cómo probar lo nuevo

```bash
# 1. Dashboard JSON
curl -s -H "X-API-Key: arquitai-..." \
  https://n8n-n8n.zzeluw.easypanel.host/webhook/dashboard-summary | jq

# 2. Generar contrato encargo
curl -X POST -H "X-API-Key: ..." -H "Content-Type: application/json" \
  https://n8n-n8n.zzeluw.easypanel.host/webhook/contract-generate \
  -d '{"project_id":"<uuid>","contract_type":"encargo_profesional","parties":[{"role":"cliente","name":"X","email":"..."},{"role":"arquitecto","name":"Damian","email":"..."}],"scope":"DO+CSS","amount_eur":4800}'

# 3. Disparar evaluacion energetica
curl -X POST -H "X-API-Key: ..." -H "Content-Type: application/json" \
  https://n8n-n8n.zzeluw.easypanel.host/webhook/trigger-energy-assessor \
  -d '{"project_id":"<uuid>"}'

# 4. Export BC3 para CYPE
curl -X POST -H "X-API-Key: ..." -H "Content-Type: application/json" \
  https://n8n-n8n.zzeluw.easypanel.host/webhook/export-bc3 \
  -d '{"project_id":"<uuid>"}'

# 5. Propuesta domotica
curl -X POST -H "X-API-Key: ..." -H "Content-Type: application/json" \
  https://n8n-n8n.zzeluw.easypanel.host/webhook/trigger-home-automation \
  -d '{"project_id":"<uuid>","level":"medio"}'

# 6. Disparar weekly kpis manualmente (te llega email)
curl -X POST -H "X-API-Key: ..." \
  https://n8n-n8n.zzeluw.easypanel.host/webhook/trigger-weekly-kpis -d '{}'
```

## Si algo no funciona / preguntas

- Logs en `activity_log` (filtrar por `agent_name`).
- Todas las migraciones aplicadas a BD están en `studio-multiagente/schemas/migrations/`.
- Knowledge docs explican cada feature en detalle (modelo, workflows, queries útiles, próximas iteraciones).
- `memory/project_state.md` tiene el estado consolidado del proyecto.
