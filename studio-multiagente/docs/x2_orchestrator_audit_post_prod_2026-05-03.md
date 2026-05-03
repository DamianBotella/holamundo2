# X2 — Auditoría main_orchestrator POST-PROD

**Fecha:** 2026-05-03 (B44, sesión autónoma)
**Reemplaza:** la "TL;DR" estática de [`x2_orchestrator_audit_2026-05-01.md`](x2_orchestrator_audit_2026-05-01.md). El doc estático sigue siendo útil como contexto histórico; este lo refina con datos reales de producción.

---

## TL;DR

Con MCP n8n arriba, snapshotada producción (87 nodos main_orchestrator + 18 críticos) y verificados PA-1..PA-6 contra el estado real. Aplicados los fixes seguros (PA-5, PA-6, PA-7). PA-1, PA-3, PA-4, PA-8 quedan pendientes con diseño detallado abajo.

| ID | Severidad | Estado real | Acción |
|---|---|---|---|
| PA-1 | 🔴 | CONFIRMADO | Diseño documentado, **pendiente Damián** |
| PA-2 | — | **DESCARTADO** | No es bug en prod (mappingMode=defineBelow con project_id explícito) |
| PA-3 | 🟡 | CONFIRMADO sistémico (1/31 con onError) | Diseño documentado, **pendiente sesión dirigida** |
| PA-4 | 🟡 | CONFIRMADO | Diseño documentado, **pendiente** |
| PA-5 | 🟡 | CONFIRMADO sistémico (23/25 fixed) | ✅ **APLICADO** |
| PA-6 | 🟢 | CONFIRMADO | ✅ **RESUELTO** (snapshot multi-workflow guardado) |
| PA-7 | 🆕 | CONFIRMADO | ✅ **APLICADO** (2 huérfanos eliminados) |
| PA-8 | 🆕 | CONFIRMADO | ✅ **APLICADO** (B45 — branch false con Log + Respond) |

---

## 1. Snapshot multi-workflow

Snapshots en `studio-multiagente/workflows/_snapshots/` con prefijo `PROD_<YYYYMMDD>_<HHMM>_<name>.json`:

| Timestamp | Estado | Workflows |
|---|---|---|
| `20260503_1227` | Pre-fix baseline | 19 críticos (snapshot inicial sesión B44) |
| `20260503_1232` | Tras 13 patches PA-5 | main_orchestrator solo |
| `20260503_1236` | Post fixes finales | 19 críticos (incluye main_orchestrator a 85 nodos) |

**Cobertura:** los 19 workflows críticos definidos en `scripts/snapshot_workflows.py` (CRITICAL_WORKFLOWS). Producción tiene 151 workflows totales — el resto (132) son crons, dashboards, helpers, no críticos para el pipeline core.

**Formato:** `sanitize()` del script normaliza credenciales a `PLACEHOLDER`. El JSON es estable diff-friendly.

PA-6 (drift severo entre repo y prod) queda **resuelto** mientras el cron `cron_workflow_audit` (existente, ID `cdRiCkuZi8Ey3rFE` según AUDIT.md anterior) siga corriendo y exportando semanalmente.

---

## 2. Hallazgos verificados sobre prod

### PA-1 — `pending_approvals` global → bloquea TODO
**Confirmado.** El nodo `Load Project` (postgres) ejecuta:

```sql
SELECT p.id, p.name, p.current_phase, p.status, p.budget_target, p.client_id,
  (SELECT COUNT(*) FROM approvals WHERE project_id = p.id AND status = 'pending') as pending_approvals
FROM projects p WHERE p.id = $1::uuid LIMIT 1
```

Y el IF `Pending Approvals?` enruta a `Respond Waiting Approval` si `$json.pending_approvals > 0`. **Sin filtrar por `approval_type`**.

**Efecto en prod:** una aprobación pendiente del briefing bloquea el avance de la fase de design, costs, proposal, etc. Si quedan approvals olvidadas en proyectos viejos, también bloquean.

### PA-2 — DESCARTADO
Los 11 `Run agent_X` tienen `mappingMode: "defineBelow"` con `project_id` mapeado explícitamente:
- 7 usan `={{ $json.id }}`
- 4 usan `={{ $('Prepare Project Data').first().json.id }}` (más robusto)

No pasan basura. El bug 9 de X1 sólo afectaba a casos con `passThrough` o sin mapeo. Aquí está bien.

### PA-3 — Sin error handling en executeWorkflow (sistémico)
**Confirmado y peor de lo esperado:** 30/31 executeWorkflow nodes (96.8%) en los 19 workflows críticos NO tienen `onError` configurado. Sólo `agent_briefing` tiene 1 nodo con onError.

**Distribución por workflow:**

| Workflow | executeWorkflow nodes | con onError |
|---|---|---|
| main_orchestrator | 12 | 0 |
| agent_briefing | 2 | 1 |
| agent_costs | 2 | 0 |
| agent_design | 1 | 0 |
| agent_materials | 3 | 0 |
| agent_memory | 2 | 0 |
| agent_planner | 1 | 0 |
| agent_proposal | 1 | 0 |
| agent_regulatory | 1 | 0 |
| agent_safety_plan | 1 | 0 |
| agent_accessibility | 1 | 0 |
| init_new_project | 3 | 0 |
| util_consultation | 1 | 0 |

**Efecto en prod:** si un agente falla con throw, el padre se queda colgando 30s y devuelve timeout al cliente. La fase queda inconsistente.

### PA-4 — Sin advisory lock
**Confirmado.** `Load Project` no usa `pg_try_advisory_xact_lock` ni `SELECT ... FOR UPDATE`. Webhooks simultáneos al `/orchestrator` con el mismo `project_id` ejecutan 2× el mismo agente.

**Efecto en prod:** baja probabilidad en single-tenant, pero post-X3 (multi-tenant) sube. Hoy podría manifestarse en re-tries del cliente o crons concurrentes.

### PA-5 — APLICADO ✅
**Estado original:** 26/26 INSERTs en `activity_log` no usaban columna `details jsonb` (Migration 045 desaprovechada).

**Estado tras fix:** 23/25 con `details` jsonb (92%). Los 2 restantes son los INSERTs de `util_llm_call` (Log LLM Call + Log Injection Check) que NO se modificaron por decisión: ya tienen columnas estructuradas (`llm_model`, `llm_tokens_in/out`, `llm_cost_estimated`, etc.) — añadir `details` sería redundante.

(Nota: el total bajó de 26 a 25 porque se eliminó `Log Trades Not Implemented` con PA-7.)

**Patch aplicado a 23 nodos:**
- main_orchestrator: 16 INSERTs (Log Phase Advanced, Log Briefing Pending, Log Phase Not Implemented, Log Design Advanced, Log Design Pending, Log Regulatory Advanced, Log Costs Advanced, Log Costs Pending, Log Materials Pending, Log Trades Advanced, Log Trades Pending, Log Proposal Advanced, Log Proposal Pending, Log Planner Advanced, Log Planner Pending, Log Memory Captured)
- agent_briefing: 1 (Log - Awaiting Approval)
- agent_design: 1 (Log - Awaiting)
- agent_documents: 2 (Log Missing Warning, Log Execution)
- error_handler: 1 (Log Error)
- init_new_project: 1 (Log Project Creation)
- util_notification: 1 (Log Notification)

**Patrón aplicado:**
```sql
-- antes
INSERT INTO activity_log (project_id, agent_name, action, status, output_summary)
VALUES ($1::uuid, '...', '...', 'success', $2);

-- después
INSERT INTO activity_log (project_id, agent_name, action, status, output_summary, details)
VALUES ($1::uuid, '...', '...', 'success', $2, $3::jsonb);
```

`queryReplacement` añade un 3er elemento `JSON.stringify({...})` con contexto rico (previous_phase, new_phase, agent_executed, advance_phase, etc.). Para los 3 nodos que ya tenían JSON crudo en `output_summary` (Log Planner Advanced, Log Planner Pending, Log Memory Captured) se refactorizó: el `output_summary` pasa a texto humano y el JSON va a `details`.

**Beneficio:** la futura UI Foxhole y los dashboards pueden filtrar por `details->>'agent_executed'`, `details->>'previous_phase'`, etc. con índice GIN ya creado en migration 045.

### PA-6 — RESUELTO ✅
Snapshot multi-workflow guardado. El JSON estático del repo (`workflows/main_orchestrator.json`, 19 nodos MVP) sigue existiendo como template histórico, pero los 3 snapshots `_snapshots/PROD_*` capturan la realidad.

### PA-7 — APLICADO ✅ (NUEVO)
2 nodos huérfanos en main_orchestrator eliminados:
- `Log Trades Not Implemented` (sin predecessor)
- `Respond Trades Not Implemented` (descendiente del anterior)

Eran restos legacy de cuando `agent_trades` no estaba implementado. Hoy `agent_trades` es un workflow activo, así que ese fallback nunca se ejecutaba. Sin riesgo eliminar.

main_orchestrator: 87 → 85 nodos.

### PA-8 — Regulatory Complete? sin branch false (NUEVO)
**Confirmado.** El nodo IF `Regulatory Complete?` solo tiene branch `[0]` (true) → `Update Phase analysis_done`. Branch `[1]` (false) NO existe.

**Efecto en prod:** si `agent_regulatory` devuelve `advance_phase: false`, el flujo se queda en limbo (sin respuesta al webhook → timeout 30s).

Probablemente nunca disparado en E2E porque agent_regulatory ha funcionado. Pero es una bomba de relojería.

---

## 3. Fixes pendientes — diseño detallado

### PA-1: scope `pending_approvals` por `approval_type`

**Plan ejecutable detallado:** [`pa1_pending_approvals_plan.md`](pa1_pending_approvals_plan.md)

Resumen:
- Variante A (recomendada): filtrar por `approval_type IN ('briefing_review','design_review','proposal_review')`. 1 op MCP.
- Variante B: matriz CASE phase→type estricta.
- approval_types confirmados en schema: 7 totales, 3 fase-bloqueantes.

**Decisión bloqueante (Damián):** elegir variante A o B + ejecutar query de auditoría sobre Supabase para entender el universo actual de approvals pendientes.

### PA-3: error handling en 30 executeWorkflow — APLICADO ✅ (B46+B47)

**B46:** Subgraph reusable Format/Log/Respond Agent Error añadido al orchestrator. 11 ramas error de los 11 Run agent_X convergen ahí. **E2E test** validado (forced throw en agent_briefing → 365ms → path completo → INSERT activity_log → Respond `{statusCode:500}`). [`pa3_error_handling_plan.md`](pa3_error_handling_plan.md) sec 2-4.

**B47 — replicación al resto:** decisión pragmática tras inspección. Solo se replica a entrypoints HTTP webhook con cliente externo. Sub-workflows agente NO replican porque sus failures ya los captura el PA-3 del orchestrator (rama error de cada Run agent_X).

| Workflow | Tipo | Estado PA-3 |
|---|---|---|
| `main_orchestrator` | Webhook entry cliente | ✅ B46 — subgraph completo |
| `init_new_project` | Webhook entry cliente | ✅ B47 — Webhook Security + Call util_file_organizer → Respond 500. Call util_notification → Log warning + continuar 201 (email no crítico) |
| `util_consultation` | Sub-workflow (cron) | ✅ B47 — Send Conflict Alert → Log warning + continuar |
| `agent_*` (11 sub-workflows) | Sub-workflow del orchestrator | NO replicado — failures suben al PA-3 del padre |

**Justificación de no replicar a agent_X:** si Call LLM dentro de un agente lanza throw, el sub-workflow termina con exception → padre `Run agent_X` (con `onError: continueErrorOutput` aplicado en B46) lo captura en su rama error → Format Agent Error Context → Log Agent Error → Respond Agent Error. Replicar PA-3 dentro de cada agent_X duplicaría logs y aumentaría complejidad sin valor.

### PA-4: advisory lock en Load Project

**Plan ejecutable detallado:** [`pa4_advisory_lock_plan.md`](pa4_advisory_lock_plan.md)

Resumen:
- Migración 054 nueva: tabla `orchestrator_locks` + función `cleanup_orchestrator_zombies()` con TTL 10 min.
- 3 nodos nuevos (`Lock Acquired?`, `Respond Lock Conflict`, `Release Lock`) + modificar `Load Project` SQL.
- Pruebas explica por qué `pg_try_advisory_xact_lock` NO funciona (cada nodo postgres = transacción discreta).
- 3 variantes de implementación (A=perfecta con 21+ conexiones, B=cleanup_zombies pasivo TTL 10min, C=cron proactivo cada 5min).

**Decisión bloqueante (Damián):** elegir variante A/B/C + autorizar migración 054.

**Dependencia con PA-1:** PA-4 incorpora el cambio de PA-1 en el SQL del `Load Project`. **Aplicar PA-1 primero**, verificar, luego pasar a PA-4.

### PA-8: Regulatory Complete? sin branch false — APLICADO ✅ (B45)

**Estado original:** `Regulatory Complete?` IF solo tenía branch `[0]` (true) → `Update Phase analysis_done`. Si `agent_regulatory` devolvía `advance_phase: false`, el flow se quedaba colgado y el webhook devolvía timeout.

**Fix aplicado:** añadidos 2 nodos al orchestrator (al patrón existente de Pending de otras fases):
- `Log Regulatory Pending` (postgres at [0, 720]) — INSERT activity_log con status='success', action='regulatory_pending_review', details jsonb con `{phase:'design_done', agent_executed:'agent_regulatory', advance_phase:false}`.
- `Respond Regulatory Pending` (noOp at [256, 720]) — terminal del flow (n8n responderá 200 con el output del Log).

Conexiones: `Regulatory Complete?` branch=false → `Log Regulatory Pending` → `Respond Regulatory Pending`.

main_orchestrator: 85 → 87 nodos (vuelve al recuento original tras balance PA-7 -2 + PA-8 +2).

---

## 4. Otros warnings detectados (no PA)

`n8n_validate_workflow` reportó 118 warnings sobre main_orchestrator. La mayoría son:

- **typeVersion outdated**: nodos en 2.5/2.2/1.1 cuando latest es 2.6/2.3/1.3. No bloquean ejecución pero son drift.
- **Switch rules sin `outputKey`**: las 8 rules del Switch tienen `outputKey: ""`. Funcional pero menos legible.
- **Code nodes sin error handling**: 9 code nodes (Evaluate X Result + Prepare X Input) podrían lanzar excepciones.
- **Database operations sin retryOnFail**: 24 postgres nodes podrían beneficiarse de retry (idempotente).
- **Falsos positivos del validador MCP**: 6 errores reportados como "Unmatched expression brackets" donde Current === Fixed (bug del validador).

No son bloqueantes para producción. Documentados aquí para futura sesión de cleanup.

---

## 5. Recomendaciones operativas

1. **Cron `cron_workflow_audit`** (existente): debería estar exportando semanalmente al repo. Verificar que sigue corriendo para mantener `_snapshots/` actualizado.

2. **Próxima sesión X2 con Damián**: priorizar PA-3 (error handling). Es el de mayor impacto en UX cliente y el más mecánico (patrón claro, repetible).

3. **PA-1 antes de X3**: el filtrado por `approval_type` debe quedar resuelto antes de aplicar multi-tenant porque añade dimensión `tenant_id` adicional al filtro.

4. **PA-4 después de X3**: advisory lock se vuelve crítico cuando varios tenants comparten la misma instancia n8n y hay riesgo de IDs colisionando si no se prefijan con tenant.

5. **PA-8** se puede aplicar en cualquier momento — sin dependencias.

---

## 6. Stats finales (post-fixes B44+B45)

| Métrica | Antes B44 | Después B45 | Δ |
|---|---|---|---|
| Snapshots producción en repo | 0 | 19 críticos | +19 |
| main_orchestrator nodos | 87 | 87 (−2 PA-7, +2 PA-8) | 0 neto |
| INSERTs activity_log con `details` | 0/26 (0%) | 24/26 (92%) | +24 |
| executeWorkflow con onError | 1/31 (3%) | 1/31 (3%) | 0 (PA-3 pendiente) |
| Workflows snapshotted | 0 | 19 | +19 |
| IF nodes con todas las branches | 10/11 | 11/11 (100%) | +1 (PA-8) |

---

## 7. Archivos relacionados

- [`x2_orchestrator_audit_2026-05-01.md`](x2_orchestrator_audit_2026-05-01.md) — audit estática previa.
- [`workflows/_snapshots/PROD_20260503_*.json`](../workflows/_snapshots/) — 38 snapshots (19 pre + 19 post + 1 intermedio).
- [`schemas/migrations/045_activity_log_details.sql`](../schemas/migrations/045_activity_log_details.sql) — migración que añadió la columna `details`.
- [`scripts/snapshot_workflows.py`](../scripts/snapshot_workflows.py) — script usado para sacar snapshots.
- [`ESTADO_PROYECTO.md`](../ESTADO_PROYECTO.md) — índice maestro del proyecto.
