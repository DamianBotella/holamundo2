# X2 — Auditoría main_orchestrator (audit estática)

**Fecha**: 2026-05-01 (B36+)
**Versión auditada**: `studio-multiagente/workflows/main_orchestrator.json` (commit 3bbc6fa)
**Estado**: ⚠️ Audit estática parcial. La versión de producción tiene **87 nodos**; el archivo del repo tiene **19 nodos** (MVP v1). Mucha funcionalidad está en producción y no en el repo.

---

## TL;DR

El orchestrator del repo es la versión MVP v1 (`intake → briefing_done` sólo). Producción ya gestiona las 11 fases (87 nodos según plan). Esta auditoría:

1. **Encuentra patrones de error en lo que SÍ está** (que probablemente se replican en los 30+ nodos similares de producción).
2. **Lista lo que falta del repo** — drift workflow vs realidad.
3. **Genera un checklist** para cuando el MCP n8n vuelva y se pueda exportar producción.

**Hallazgos críticos** (probablemente afectan producción):
- 🔴 **PA-1**: `pending_approvals` bloquea TODAS las fases globalmente — antipatrón.
- 🔴 **PA-2**: `executeWorkflow` no setea input explícito → bug 9 de X1 confirmado en este flujo.
- 🟡 **PA-3**: sin error handler en sub-workflow calls → cliente recibe timeout si agente falla.
- 🟡 **PA-4**: race condition: dos webhooks simultáneos pueden disparar 2× el mismo agente.
- 🟡 **PA-5**: `activity_log` INSERT no usa columna `details` (migration 045 no aprovechada).
- 🟢 **PA-6**: drift severo entre repo y producción (19 vs 87 nodos) — el repo no es source-of-truth del orchestrator.

---

## 1. Inventario del JSON local

### Estructura de nodos (19 total)

| Posición flow | Nombre | Tipo | Notas |
|---|---|---|---|
| Entrada | Orchestrator Entry | webhook | POST `/orchestrator` |
| 1 | Extract Input | code | Lee `project_id`, `action` del body |
| 2 | Load Project | postgres | SELECT projects + COUNT(approvals pending) |
| 3 | Prepare Project Data | code | Merge + parseInt pending_approvals |
| 4 | Project Active? | if | status=='active' |
| 4-no | Respond Inactive | respondToWebhook | 200 + skipped |
| 5 | Pending Approvals? | if | pending_approvals > 0 |
| 5-yes | Respond Waiting Approval | respondToWebhook | 200 + waiting |
| 6 | Route by Phase | switch (v3) | 1 case (intake) + fallback |
| 6-intake | Run agent_briefing | executeWorkflow | placeholder ID |
| 7 | Evaluate Briefing Result | code | Lee `status === 'complete'` |
| 8 | Briefing Complete? | if | advance_phase == true |
| 8-yes | Update Phase briefing_done | postgres | UPDATE phase |
| 9 | Log Phase Advanced | postgres | INSERT activity_log |
| 10 | Respond Phase Advanced | respondToWebhook | 200 + advanced |
| 8-no | Log Briefing Pending | postgres | INSERT activity_log |
| 11 | Respond Pending Review | respondToWebhook | 200 + pending |
| 6-fallback | Log Phase Not Implemented | postgres | placeholder log |
| 12 | Respond Not Implemented | respondToWebhook | 200 + not_implemented |

### Conexiones

Lineales hasta `Route by Phase`. Después: split en 2 (intake | fallback). Ambas ramas terminan en respondToWebhook.

---

## 2. Hallazgos por severidad

### 🔴 PA-1 — `pending_approvals` bloquea TODAS las fases

**Línea**: nodos `Pending Approvals?` + flow.
**Patrón**: el orchestrator chequea `COUNT(approvals WHERE status='pending')` ANTES del Route by Phase. Si hay > 0, devuelve `waiting` y NO ejecuta ninguna fase.

**Por qué es bug**:
- Una aprobación pendiente del briefing **bloquea el avance de proposal** o cualquier fase posterior.
- En realidad cada fase tiene su propio set de aprobaciones (briefing approval, design approval, proposal approval). El orchestrator debería filtrar:
  ```sql
  COUNT(*) FROM approvals
  WHERE project_id = p.id
    AND status = 'pending'
    AND approval_type = '<phase-specific>'
  ```
- O directamente: la lógica pending_approvals debería estar **dentro** de cada rama del Switch, no global.

**Impacto en producción**: si la versión de 87 nodos replica este chequeo global, hay proyectos que se bloquean por aprobaciones de fases anteriores ya cerradas. Verificar:
```sql
SELECT id, name, current_phase,
  (SELECT count(*) FROM approvals WHERE project_id = projects.id AND status='pending') as pending
FROM projects WHERE status='active' AND current_phase != 'archived';
```
Si hay proyectos con `pending > 0` y `current_phase` posterior a la fase de la aprobación, este bug los está bloqueando.

**Fix recomendado**: mover el chequeo de pending_approvals DENTRO de cada case del Switch, scoped a la fase actual.

---

### 🔴 PA-2 — `executeWorkflow` no setea input explícito (Bug 9 X1)

**Línea**: `Run agent_briefing` (id 000010).
**Estado**: parámetros del executeWorkflow son sólo `workflowId` + `waitForSubWorkflow`. **NO hay `inputs` definidos** explícitamente.

**Por qué es bug**:
- En X1 (commit 973bbe6) se documentó este bug: cuando `executeWorkflow` no define explícitamente sus inputs, n8n pasa el JSON completo del nodo previo. Si el nodo previo tiene campos como `state`, `pending_approvals`, etc., el sub-workflow recibe basura.
- El agente esperaba sólo `project_id`. Recibió `{ id, name, current_phase, status, budget_target, client_id, pending_approvals, action }` — y su SELECT inicial falla con "no rows" porque busca por `body.project_id` que no existe.

**Fix aplicado en X1**: precede con un nodo Set que mapea sólo `project_id`.

**Para auditoría producción**: buscar TODOS los `executeWorkflow` en main_orchestrator y verificar:
1. ¿Tiene un nodo Set inmediatamente antes que limita los campos?
2. ¿O tiene `inputs` explícitos en sus parámetros?

Si ninguna de las dos → el agente recibe basura. Producción tiene **13 sub-workflow calls** (uno por agente) — al menos 1 ya está bug-fixed (briefing tras X1), faltan 12 por verificar.

---

### 🟡 PA-3 — Sin error handling en `Run agent_briefing`

**Línea**: `Run agent_briefing` con `waitForSubWorkflow: true`.

**Por qué es problema**:
- Si el agente falla con throw, n8n propaga el error al orchestrator.
- El orchestrator NO tiene error connection ni try/catch.
- El webhook nunca responde → cliente cuelga 30s → timeout.
- Postgres updates posteriores no se ejecutan → estado inconsistente.

**Fix recomendado**:
- Añadir error output al `executeWorkflow` (n8n soporta `onError: continueErrorOutput`).
- Branch error → `INSERT INTO activity_log (..., status='failed', details=jsonb_build_object('error', $1))` + `Respond Error` (respondToWebhook código 500).
- Replicar en los 13 executeWorkflow de producción.

---

### 🟡 PA-4 — Race condition: webhooks simultáneos

**Línea**: flow general.

**Escenario**: dos POST `/orchestrator` con el mismo `project_id` llegan en < 1s. Ambos pasan `Load Project` → `Project Active?` → `Pending Approvals?` → `Route by Phase` → 2× `Run agent_briefing` en paralelo. La BD acaba con 2 briefings cuando sólo debía haber 1.

**Fix recomendado**: advisory lock en `Load Project`:
```sql
SELECT pg_try_advisory_xact_lock(hashtext($1::text)) AS lock_acquired,
       p.id, p.name, p.current_phase, ...
FROM projects p WHERE p.id = $1::uuid LIMIT 1;
```
Si `lock_acquired = false` → ya hay otro orchestrator corriendo este proyecto → respond `409 conflict`.

Alternativa: SELECT FOR UPDATE en transacción explícita.

---

### 🟡 PA-5 — `activity_log` INSERT sin `details` jsonb

**Línea**: `Log Phase Advanced` (000014), `Log Briefing Pending` (000016), `Log Phase Not Implemented` (000018).

**Estado**: INSERT usa columnas `(project_id, agent_name, action, status, output_summary)`.

**Por qué es problema**:
- Migration 045 añadió `details jsonb` para contexto rico (qué fase venía de, qué error fue, etc.).
- Estos INSERTs no la usan → la UI Foxhole pierde contexto al pintar el timeline.

**Fix recomendado**:
```sql
INSERT INTO activity_log (project_id, agent_name, action, status, output_summary, details)
VALUES ($1::uuid, 'main_orchestrator', 'phase_advanced', 'success', $2,
  jsonb_build_object(
    'previous_phase', $3,
    'new_phase', $4,
    'agent_executed', $5,
    'execution_id', $6
  )
);
```

---

### 🟢 PA-6 — Drift severo repo vs producción

**Estado del archivo `studio-multiagente/workflows/main_orchestrator.json`**:
- 19 nodos vs 87 en producción.
- Sólo 1 fase implementada (intake) vs 11.
- IDs literales `PLACEHOLDER` (workflowId, credentials, errorWorkflow).

**Por qué es problema**:
- El repo NO es source-of-truth del orchestrator.
- Si alguien re-importa este JSON en n8n, **rompe producción**.
- El audit completo SOLO se puede hacer con MCP exportando producción.

**Fix recomendado** (ya planeado):
- Cron `cron_workflow_audit` exporta semanalmente todos los workflows de producción al repo.
- Añadir warning explícito al JSON del orchestrator: `"_warning": "MVP v1 — DO NOT IMPORT — production has 87 nodes"`.
- O renombrar a `.template` para que quede claro que es plantilla histórica.

---

## 3. Lo que probablemente está en producción y no en el repo

Según `plan_pre_interfaz_foxhole.md` y commits B26-B34:

| Funcionalidad | En repo? | En producción? |
|---|---|---|
| Switch case `intake` → briefing | ✅ | ✅ |
| Switch case `briefing_done` → design | ❌ | ✅ |
| Switch case `design_done` → documents+regulatory | ❌ | ✅ |
| Switch case `analysis_done` → materials | ❌ | ✅ |
| Switch case `costs_done` → trades | ❌ | ✅ |
| Switch case `trades_done` → proposal | ❌ | ⚠️ Bug 7 X1 (false alarm, sí ejecuta) |
| Switch case `proposal_done` → approved | ❌ | ✅ |
| Switch case `approved` → planner+memory+safety+accessibility | ❌ | ✅ |
| Switch case `planning_done` → completed | ❌ | ⚠️ "no avanza" según evidence X1 |
| Update Phase + Log per fase | parcial | ✅ |
| executeWorkflow Set node prepended (Bug 9 fix) | ❌ | parcial |

---

## 4. Checklist para auditar producción cuando el MCP vuelva

```bash
# 1. Exportar el orchestrator real
n8n_get_workflow({ id: "<main_orchestrator_id>", mode: "full" })
```

Verificar nodo a nodo:

### Para CADA case del Switch (1 por fase):
- [ ] El executeWorkflow del agente tiene un Set node inmediatamente antes que mapea SÓLO `project_id` (Bug 9 X1 fix).
- [ ] El executeWorkflow tiene `onError: continueErrorOutput` o equivalente.
- [ ] La rama error tiene un INSERT en activity_log con status='failed' y details jsonb del error.
- [ ] La rama success hace UPDATE projects SET current_phase = '<next>' atómicamente.
- [ ] El UPDATE projects está PROTEGIDO con `WHERE current_phase = '<expected_current>'` (idempotency).
- [ ] El INSERT activity_log incluye columna `details jsonb` (migration 045).

### Globalmente:
- [ ] El chequeo `pending_approvals > 0` está scoped a la fase actual (no global).
- [ ] `Load Project` usa advisory lock o SELECT FOR UPDATE.
- [ ] El flow tiene `errorWorkflow` apuntado a un `error_handler` real (no PLACEHOLDER).
- [ ] **Tenant context**: tras X3 aplicado, primer Postgres node debe ser `SELECT set_tenant_context($tenant_id)` derivado de `resolve_tenant_from_project($project_id)`.

### Especificos detectados en X1:
- [ ] Case `trades_done → proposal`: VERIFICAR conexión existe (Bug 7 fue falsa alarma, pero re-confirmar).
- [ ] Case `planning_done → completed`: investigar por qué evidence X1 reportó "no avanza".
- [ ] Bug 9 fix aplicado en TODOS los executeWorkflow (no sólo agent_briefing).

---

## 5. Recomendación de orden de trabajo X2

Cuando el MCP n8n vuelva:

1. **Snapshot inmediato**: `n8n_get_workflow({id, mode:"full"})` → guardar a `workflows/main_orchestrator.PROD_<fecha>.json` con prefijo `PROD_` para diferenciar del MVP del repo.
2. **Aplicar checklist arriba** sobre el snapshot. Documentar findings en `docs/x2_orchestrator_audit_findings.md`.
3. **Fixes prioritarios** (en orden):
   - PA-2 (Bug 9 fix replicado a 12 agentes faltantes) — más crítico, afecta runtime.
   - PA-3 (error handling) — afecta UX cliente.
   - PA-1 (pending_approvals scope) — afecta proyectos bloqueados.
   - PA-5 (details jsonb) — calidad de logs.
   - PA-4 (race condition) — riesgo bajo en single-tenant, sube post-X3.
4. **Cleanup workflows abandonados** (parte de X2 original):
   ```sql
   SELECT id, name, active, updatedAt FROM execution_entity
   WHERE workflowId IN (SELECT id FROM workflow WHERE active=true);
   ```
   Identificar workflows `active=true` sin ejecuciones >30d → archivar.
5. **Cron `cron_workflow_audit`**: que exporte semanalmente los workflows críticos al repo para evitar el drift PA-6.

---

## 6. Archivos relacionados

- `studio-multiagente/workflows/main_orchestrator.json` — versión MVP v1 auditada.
- `docs/e2e_evidence_FINAL_2026-04-29.md` — bugs B30-B34 que validan PA-1, PA-2.
- `docs/x3_multi_tenant_design.md` — patrón que el orchestrator debe adoptar post-X3.
- `docs/plan_pre_interfaz_foxhole.md` — plan global X1-X6.
