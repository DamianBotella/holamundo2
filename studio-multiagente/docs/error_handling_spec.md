# Error Handling — Specification

**Versión**: 2 (B42).
**Estado**: 📐 spec del comportamiento esperado. `error_handler_v2.json` es el JSON ready-to-import.

---

## Filosofía

1. **Cada error se loggea**, sin excepciones — incluso los silent.
2. **No spam**: el mismo error en la misma ubicación dentro de 60min sólo manda 1 email. Los demás se cuentan vía `details->>'error_hash'`.
3. **Categorización en 8 buckets** para alertas y triage rápido.
4. **Severidad implícita**: crítico si workflow es crítico **o** si la categoría es crítica (ej. `rls_violation`).
5. **Todo lo estructurado va a `details jsonb`**, no a `output_summary` plano (PA-5 X2).

---

## Categorías de error

| Categoría | Patrón regex (lower-case) | Severidad por defecto |
|---|---|---|
| `network` | timeout / etimedout / socket hang up / econnreset / enetunreach | warning |
| `rls_violation` | row.level.security / rls / new row violates row.level security | **critical** |
| `tenant_missing` | tenant_id .* null / current_tenant.*null | **critical** |
| `database` | postgres / relation .* does not exist / column .* does not exist / syntax error / constraint / unique violation / foreign key | warning |
| `llm` | openai / anthropic / rate limit / insufficient_quota / model_not_found / context_length / api[_ ]key | warning |
| `auth` | unauthorized / forbidden / invalid token / jwt / auth | warning |
| `parse` | json / parse / invalid expression / unmatched | warning |
| `unknown` | (default) | warning |

---

## Severidad

```
isCritical = workflowName ∈ {main_orchestrator, agent_proposal, agent_trades, init_new_project}
          ∨ category ∈ {rls_violation, tenant_missing}
```

Las dos categorías "tenant" son críticas porque indican fallo de seguridad (alguien intentando bypass RLS o un workflow no setea tenant context — ambos son bugs urgentes).

---

## Estructura de `details jsonb` en activity_log

```json
{
  "workflow_id":       "wf_xyz",
  "workflow_name":     "agent_briefing",
  "execution_id":      "exec_abc",
  "error_node":        "Parse Briefing Response",
  "error_name":        "TypeError",
  "error_message":     "Cannot read properties of undefined (reading 'text')",
  "error_stack":       "TypeError: ...\n    at /...\n    at ...",
  "error_category":    "parse",
  "error_hash":        "a3f9b1c2d4e5",
  "is_critical":       false,
  "project_id_source": "Load Project",
  "url_to_execution":  "https://n8n-n8n.zzeluw.easypanel.host/workflow/wf_xyz/executions/exec_abc"
}
```

`error_message`, `error_stack` truncados a 2000 chars cada uno.

---

## Vista de consumo: `v_recent_errors`

Definida en migration `052_api_views.sql.draft`:

```sql
SELECT
  id, created_at, project_id, workflow_name,
  error_node, error_category, error_hash, is_critical,
  error_message, execution_id, url_to_execution,
  duplicate_count_24h
FROM v_recent_errors
ORDER BY created_at DESC
LIMIT 50;
```

La UI Foxhole consume esto en una pestaña "Errores Sistema" (admin only).

---

## Dedup behavior

```sql
SELECT count(*)::int
  FROM activity_log
 WHERE action = 'workflow_error'
   AND created_at > now() - interval '60 minutes'
   AND details->>'error_hash' = $1
```

Si `count > 1` → suprimir email (ya hay uno en los últimos 60min con misma hash).

`error_hash` se computa de `workflowName + '|' + errorNode + '|' + first 200 chars of message`. Esto agrupa errores idénticos pero diferencia errores en el mismo workflow pero distinto nodo.

---

## Silent workflows

Workflows que matchean `/(_TEMP$|^debug|^test_|TEMP|migration_)/i` se loguean pero **NO mandan email**. Útil para workflows experimentales que no deben spamear.

---

## Plan de migración v1 → v2

1. **Pre-req**: migration 045 (`activity_log.details jsonb`) ya aplicada (✓ en B30).
2. Importar `error_handler_v2.json` en n8n como workflow nuevo (con un nombre temporal `error_handler_v2_test`).
3. Smoke test: forzar un error en un workflow de prueba apuntando a `error_handler_v2_test` como `errorWorkflow`.
4. Verificar:
   - Fila en `activity_log` con `action='workflow_error'` y `details` poblado.
   - Email recibido si NO es duplicado.
   - SELECT * FROM `v_recent_errors` muestra el error.
5. Una vez validado, renombrar:
   - `error_handler` → `error_handler_v1_archive` (deactivate, no delete).
   - `error_handler_v2_test` → `error_handler`.
6. Actualizar `errorWorkflow` setting de los workflows críticos al nuevo ID si cambió.

Dado que el `errorWorkflow` se referencia por ID, el rename sin cambio de ID no requiere tocar nada más.

---

## Tests manuales recomendados

### Test 1 — error simple (no critical)

Forzar en agent_briefing un `throw new Error('test parse error')` en el nodo Parse. Verificar:
- `activity_log` insertado con `error_category='unknown'` (no matchea ningún patrón).
- Email "[ERROR] agent_briefing falló" recibido.
- `details->>'is_critical' = 'false'`.

### Test 2 — error crítico por workflow

Forzar throw en `main_orchestrator`. Verificar:
- `details->>'is_critical' = 'true'`.
- Subject del email empieza con "[CRÍTICO]".

### Test 3 — error crítico por categoría (RLS)

Tras X3 aplicado, llamar un workflow que NO setea tenant context y hace UPDATE → debería fallar con `new row violates row-level security policy`. Verificar:
- `error_category = 'rls_violation'`.
- `is_critical = true` (aunque el workflow no esté en la lista hardcoded).

### Test 4 — dedup

Forzar el mismo error 5 veces seguidas en 30s. Verificar:
- 5 filas en `activity_log` (todas se loggean).
- 1 email enviado (los 4 siguientes suprimidos).
- `SELECT duplicate_count_24h FROM v_recent_errors WHERE error_hash = '...'` devuelve 5.

### Test 5 — silent workflow

Crear workflow temporal `debug_test_TEMP` que lanza error. Verificar:
- Fila en `activity_log` (sí se loggea).
- NO email (`is_silent = true`).

---

## Observabilidad futura

Cuando el sistema escale, considerar:

1. **Sentry integration**: añadir nodo HTTP Request al final del extract que postea a `https://sentry.io/api/...` con el payload del error. Soporta proyectos múltiples y agrupa por hash automáticamente.

2. **PagerDuty para criticals**: si `is_critical && category in (rls_violation, tenant_missing)`, mandar trigger PagerDuty además del email.

3. **Métricas**: cron diario que cuenta errores por categoría y los manda a `system_health_score`. Si alguna categoría sube > 10/día, alerta.

4. **Auto-recovery**: para `network` errors, considerar retry automático con backoff exponencial dentro del workflow original (no en error_handler).

---

## Workflows que deben referenciar error_handler

Todos los workflows productivos. Setear el campo `settings.errorWorkflow` al ID del `error_handler`:

```json
"settings": {
  "executionOrder": "v1",
  "errorWorkflow": "<error_handler_id>"
}
```

Lista de obligatorios:
- `main_orchestrator`
- Los 13 agentes (`agent_briefing`, etc.).
- Los `util_*` (notification, llm_call, consultation, etc.).
- Todos los `cron_*`.
- Todos los `api_*` (cuando se construyan).

`init_new_project` también, aunque es webhook con respuesta — el error_handler se ejecuta en paralelo al respondToWebhook de error.

---

## Archivos relacionados

- `workflows/error_handler.json` — versión 1 actual.
- `workflows/error_handler_v2.json` — versión 2 con `details jsonb` (B42).
- `schemas/migrations/045_activity_log_details.sql` — añade `details` column.
- `schemas/migrations/052_api_views.sql.draft` — define `v_recent_errors`.
- `docs/x2_orchestrator_audit_2026-05-01.md` — PA-5 que motiva v2.
