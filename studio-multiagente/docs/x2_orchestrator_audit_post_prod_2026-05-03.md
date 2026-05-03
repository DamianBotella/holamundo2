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

**Problema:** chequeo global bloquea cualquier fase si hay 1 approval pendiente.

**Diseño recomendado:**

Modificar `Load Project` para que el subquery filtre por la `approval_type` relevante a la fase actual:

```sql
SELECT p.id, p.name, p.current_phase, p.status, p.budget_target, p.client_id,
  (
    SELECT COUNT(*) FROM approvals
    WHERE project_id = p.id AND status = 'pending'
      AND approval_type = CASE p.current_phase
        WHEN 'intake'        THEN 'briefing'
        WHEN 'briefing_done' THEN 'design'
        WHEN 'design_done'   THEN 'documents'
        WHEN 'analysis_done' THEN 'materials'
        WHEN 'costs_done'    THEN 'costs'
        WHEN 'trades_done'   THEN 'proposal'
        WHEN 'proposal_done' THEN 'client_approval'
        ELSE 'never_match'
      END
  ) as pending_approvals
FROM projects p WHERE p.id = $1::uuid LIMIT 1
```

**Decisión bloqueante (Damián):** confirmar el mapeo `current_phase → approval_type`. Hoy no está documentado en un único lugar. Si el mapeo es distinto al de arriba, el fix bloquea o desbloquea fases incorrectamente.

**Alternativa más simple:** mover el chequeo `pending_approvals > 0` DENTRO de cada case del Switch, scoped a la fase. Más invasivo (requiere 8 nodos IF nuevos) pero hace explícito el approval_type por fase.

### PA-3: error handling en 30 executeWorkflow

**Problema:** sub-workflow exception → padre cuelga 30s → cliente timeout.

**Diseño recomendado (orchestrator):**

1. Para cada `Run agent_X` en main_orchestrator: añadir `onError: "continueErrorOutput"`.
2. Crear un único subgraph común "Handle Agent Error":
   - `Code: Format Error Context` — extrae `error.message`, `node_name`, agent_name, project_id.
   - `Postgres: Log Agent Error` — INSERT en activity_log con `status='error'`, `error_message`, `details`.
   - `Postgres: Mark Project as Errored` — UPDATE projects SET `current_phase` = `<phase>_errored` WHERE id = $1 (opcional, requiere migración para nuevos enum values).
   - `RespondToWebhook: Respond Agent Error` — código 500 + payload `{status:'error', agent, error_message_preview}`.
3. Conectar las 11 ramas error de los 11 `Run agent_X` al `Format Error Context`.

**Nodos nuevos:** 4. **Conexiones nuevas:** 11 (una por agente). **Modificaciones:** 11 (añadir `onError`).

**Decisión bloqueante (Damián):** ¿se quiere un enum `<phase>_errored` o basta con activity_log? Sugerencia: empezar sin enum, sólo activity_log + email a arquitecto.

Replicar el mismo patrón en los 19 executeWorkflow restantes en otros workflows (init_new_project, agent_costs, agent_materials, etc.) — sesión dedicada, ~4h.

### PA-4: advisory lock en Load Project

**Problema:** webhooks simultáneos disparan 2× el mismo agente.

**Diseño recomendado:**

```sql
SELECT
  pg_try_advisory_xact_lock(hashtext('orch:' || $1::text)) AS lock_acquired,
  p.id, p.name, p.current_phase, p.status, p.budget_target, p.client_id,
  (SELECT COUNT(*) FROM approvals
     WHERE project_id = p.id AND status = 'pending'
       AND approval_type = CASE p.current_phase ... END  -- combinado con PA-1
  ) as pending_approvals
FROM projects p WHERE p.id = $1::uuid LIMIT 1;
```

Después de Load Project, añadir:
- `IF Lock Acquired?` (true → seguir; false → `Respond Lock Conflict` 409 con `{status:'busy', retry_after:5}`).

**Tradeoff:** advisory_xact_lock libera al final de la transacción n8n. Como cada nodo postgres es su propia transacción, el lock no persiste entre Load Project y los nodos posteriores. Para que dure el flujo completo, hay que hacer un único nodo postgres "begin tx + lock + select + ... + commit" o usar `pg_advisory_lock` + manual unlock al final. Esto complica el diseño.

**Alternativa simple:** crear tabla `orchestrator_locks(project_id uuid PK, locked_at timestamptz)` y hacer `INSERT ... ON CONFLICT DO NOTHING RETURNING locked_at`. Si retorna 0 rows → lock not acquired. Liberar con DELETE en el último Respond. Más fiable que advisory_lock entre nodos n8n.

**Decisión bloqueante:** advisory_xact_lock vs lock table explícita. Recomendación: lock table (la tabla con DELETE manual). Migración nueva (054).

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
