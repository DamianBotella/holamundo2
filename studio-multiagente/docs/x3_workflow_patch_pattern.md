# X3 — Patrón correcto para parchar workflows con `set_tenant_context`

**Fecha**: 2026-05-03 (B50)
**Aprendizaje empírico**: en sesión X3 se intentó añadir un nodo separado `Set Tenant Context` al inicio de cada workflow. **NO funciona** — el item de la query SQL solo lleva `{tenant_id}` y los nodos siguientes pierden los datos del trigger.

---

## TL;DR

**NO HACER**: añadir un nodo Postgres separado entre el trigger y el primer nodo de negocio.

```
WRONG:
[Receive Project] → [Set Tenant Context (postgres)] → [Load Project Data]
   {project_id}        OUTPUT: {tenant_id}              EXPECTS: $json.project_id  ← FALLA
```

**HACER**: combinar `set_config` dentro del primer Postgres del workflow usando un CTE para que sea single-statement.

```
RIGHT:
[Receive Project] → [Load Project Data (modified)]
   {project_id}        Query con CTE _ts → preserva todos los campos del SELECT
```

---

## Patrón correcto: combinar set_config en CTE

### Caso 1 — primer Postgres es SELECT

Antes:
```sql
SELECT id, name, current_phase
FROM projects
WHERE id = $1::uuid
```

Después:
```sql
WITH _ts AS (
  SELECT set_config(
    'app.current_tenant',
    COALESCE(resolve_tenant_from_project($1::uuid)::text, ''),
    false
  ) AS tenant_id_set
)
SELECT p.id, p.name, p.current_phase
FROM projects p, _ts
WHERE p.id = $1::uuid
```

Cross join con `_ts` garantiza que el CTE se ejecute (Postgres optimiza fuera CTEs no referenciados). El SELECT principal devuelve los mismos campos que antes, **sin** la columna del set_config.

### Caso 2 — primer Postgres es INSERT/UPDATE/DELETE

Postgres node de n8n con `executeQuery` ejecuta el statement tal cual. Para combinar set_config con DML:

```sql
WITH _ts AS (
  SELECT set_config('app.current_tenant', COALESCE(resolve_tenant_from_project($1::uuid)::text, ''), false)
)
INSERT INTO ... (...) 
SELECT ... FROM _ts, ... 
RETURNING ...
```

Si el INSERT no necesita JOIN, basta con un `, _ts` decorativo en FROM o usar:

```sql
WITH _ts AS (...)
SELECT * FROM (
  INSERT INTO ... RETURNING *
) sub, _ts
```

### Caso 3 — workflow donde el primer postgres NO recibe project_id

Algunos workflows reciben otro tipo de input (init_new_project recibe webhook body, no project_id). Para ellos: **hardcoded a tenant baseline** en MVP (`(SELECT id FROM tenants WHERE slug='damian-mtnz')`). En multi-tenant V2: derivar de JWT.

---

## Workflows que necesitan parche en próxima sesión X3 paso 3b v2

Tras B50, **solo el `main_orchestrator` está parchado correctamente**. Los demás 17 workflows críticos NO tienen `set_tenant_context` y necesitan parche siguiendo este patrón antes de aplicar 050.

| Workflow | Primer Postgres | Patrón |
|---|---|---|
| main_orchestrator | Load Project | ✅ APLICADO (Caso 1 con CTE) |
| init_new_project | Find Existing Client | Caso 1 (resolver desde tenant baseline porque no hay project_id aún) |
| init_new_project · Create Project | Caso 2 | ✅ Hardcoded `(SELECT id FROM tenants WHERE slug='damian-mtnz')` aplicado en B50 |
| init_new_project · Create Client | Caso 2 | ✅ Hardcoded aplicado en B50 |
| agent_briefing | Load Architect Email | Caso 1 |
| agent_design | Load Architect Email | Caso 1 |
| agent_regulatory | Load Architect Email | Caso 1 |
| agent_proposal | Load Architect Email | Caso 1 |
| agent_costs | Load Project | Caso 1 |
| agent_documents | Load Project | Caso 1 |
| agent_materials | Load Project | Caso 1 |
| agent_trades | Load Project | Caso 1 |
| agent_planner | Load Project Data | Caso 1 |
| agent_safety_plan | Load Project Data | Caso 1 |
| agent_accessibility | Load Project Data | Caso 1 |
| agent_memory | Load All Project Data | Caso 1 |
| util_consultation | Load Architect Email | Caso 1 |
| util_llm_call | Log Injection Check (CASE para project_id='no_project') | Caso especial |
| util_notification | Load Architect Email | Caso especial (project_id puede ser '') |
| util_architect_presence | Load Architect Email | Caso especial (webhook body) |
| error_handler | Load Architect Email | Caso 3 (hardcoded baseline en MVP) |

---

## Por qué el approach de nodo separado NO funcionó

n8n Postgres node devuelve el resultado del SELECT como nuevo item. Si la query es:
```sql
SELECT set_tenant_context(...) AS tenant_id
```
el output del nodo siguiente recibe `{tenant_id: 'uuid'}` y pierde los campos del trigger.

Para preservar el item original, habría que:
1. Modificar la query para devolver TODOS los campos del trigger (impráctico).
2. Añadir un nodo Code después que recupere `$('Trigger').first().json` (añade complejidad innecesaria).
3. **Combinar set_config en la query existente** ← elegido.

---

## Validación empírica

Test ejecutado en sesión B50:
- Workflow temporal `_test_session_persistence_X3` con dos nodos Postgres distintos.
- Nodo 1: `SELECT set_config('app.current_tenant', '<uuid>', false)` 
- Nodo 2: `SELECT current_setting('app.current_tenant', true)`

Resultado: el setting persistió ✅. n8n reutiliza la connection del pool dentro del mismo workflow execution.

Test orchestrator B50:
- `Load Project` query modificada con CTE `_ts` que llama `set_config(false)`.
- Execution 3245: `lock_acquired:false`, `tenant_id: 'bbf3f07e-...'` (correcto, baseline tenant).
- El item se preservó completo (id, name, current_phase, status, budget_target, client_id, tenant_id, pending_approvals).

---

## Plan próxima sesión (~3-4h)

1. Para cada uno de los 17 workflows pendientes:
   - Identificar el primer Postgres node post-trigger.
   - Aplicar Caso 1 (resolve_tenant_from_project) o caso especial según trigger.
2. Snapshot todos.
3. Aplicar migración 050 (RLS enable).
4. Smoke test E2E (init_new_project → orchestrator → agent_briefing → ...) con RLS activo.
5. Crear 2do tenant test + verificar aislamiento (segun checklist `x3_multi_tenant_design.md` sec 7).
6. Commit B51.
