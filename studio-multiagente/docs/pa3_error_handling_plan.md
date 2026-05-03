# PA-3 — Plan ejecutable: error handling en executeWorkflow

**Fecha plan:** 2026-05-03 (B45, sesión autónoma)
**Estado:** documentado, **NO aplicado** (requiere review Damián)
**Esfuerzo estimado:** 30 min orchestrator + 4h replicación al resto de workflows.

---

## Por qué este plan no se aplicó autónomamente

PA-3 modifica el comportamiento ante fallos de los 11 sub-workflow calls del orchestrator. Si la implementación tiene un bug, los proyectos que están corriendo ahora pueden quedar en estado inconsistente. Es el cambio más estructural del audit X2: requiere una sesión consciente con Damián y al menos 1 ejecución E2E de validación.

Una vez aprobado el diseño, las 27 operaciones MCP están listas para aplicarse en una sola llamada (atómica) — ver Sección 3.

---

## 1. Diagrama del subgraph "Handle Agent Error"

```
[Run agent_X]  (onError: continueErrorOutput)
   ├── [0] success ──→ [Evaluate X Result] (sigue el flujo normal)
   └── [1] error   ──→ [Format Agent Error Context] ──→ [Log Agent Error] ──→ [Respond Agent Error]
```

Las 11 ramas error de los 11 `Run agent_X` convergen en un único `Format Agent Error Context` reusable. Todas terminan en el mismo `Respond Agent Error` (terminal noOp = HTTP 500 con payload del error).

### Ventajas del diseño

1. **Único punto de manejo de error** — DRY, fácil mantenimiento.
2. **Webhook nunca cuelga** — siempre responde 200 (success) o 500 (error).
3. **Logging consistente** — todos los errores van con misma estructura a `activity_log` con `details` jsonb.
4. **Rollback granular** — si hay que revertir, basta con `removeConnection` de las 11 ramas error y `removeNode` de los 3 nodos nuevos. Las modificaciones de `onError` en los 11 `Run agent_X` no son destructivas (rama error sin conexión = comportamiento original).

---

## 2. Especificación de los 3 nodos nuevos

### Nodo 1 — Format Agent Error Context

```json
{
  "name": "Format Agent Error Context",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [-1056, 1900],
  "parameters": {
    "jsCode": "const err = $input.first().json;\nconst projectId = $('Prepare Project Data').first().json.id;\nconst projectName = $('Prepare Project Data').first().json.name || 'unknown';\nconst currentPhase = $('Prepare Project Data').first().json.current_phase || 'unknown';\n\n// Try to detect which agent failed by inspecting the error context\nconst nodeName = err.error?.node?.name || err.node?.name || 'unknown_agent';\nconst agentName = nodeName.startsWith('Run ') ? nodeName.substring(4) : nodeName;\n\nconst errorMessage = (err.error?.message || err.message || 'Unknown error').toString().substring(0, 500);\nconst errorStack = (err.error?.stack || err.stack || '').toString().substring(0, 4000);\nconst executionId = $execution?.id || null;\n\nreturn [{\n  json: {\n    project_id: projectId,\n    project_name: projectName,\n    phase_at_error: currentPhase,\n    agent_name: agentName,\n    error_message: errorMessage,\n    error_stack: errorStack,\n    execution_id: executionId,\n    timestamp: new Date().toISOString()\n  }\n}];"
  }
}
```

### Nodo 2 — Log Agent Error

```json
{
  "name": "Log Agent Error",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "position": [-800, 1900],
  "parameters": {
    "operation": "executeQuery",
    "query": "INSERT INTO activity_log (project_id, agent_name, action, status, error_message, output_summary, details) VALUES ($1::uuid, $2, 'agent_failed', 'error', $3, $4, $5::jsonb)",
    "options": {
      "queryReplacement": "={{ [$json.project_id, $json.agent_name, $json.error_message, 'Agent ' + $json.agent_name + ' fallo en fase ' + $json.phase_at_error, JSON.stringify({phase_at_error: $json.phase_at_error, agent_name: $json.agent_name, error_message: $json.error_message, error_stack: $json.error_stack, execution_id: $json.execution_id, timestamp: $json.timestamp})] }}"
    }
  },
  "credentials": {
    "postgres": {
      "id": "cfxNZdzy0NB3xkYC",
      "name": "Postgres account"
    }
  }
}
```

### Nodo 3 — Respond Agent Error

```json
{
  "name": "Respond Agent Error",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [-544, 1900],
  "parameters": {
    "jsCode": "// Build HTTP 500-equivalent response. Webhook responds 200 by default; n8n recognizes 'statusCode' field.\nconst err = $input.first().json;\nreturn [{\n  json: {\n    statusCode: 500,\n    status: 'error',\n    project_id: err.project_id,\n    agent: err.agent_name,\n    phase_at_error: err.phase_at_error,\n    error_message: err.error_message,\n    timestamp: err.timestamp\n  }\n}];"
  }
}
```

> **Nota webhook 500**: el orchestrator usa el patrón `noOp` (no respondToWebhook explícito). El último Code node con `statusCode` no garantiza HTTP 500 sin un nodo `respondToWebhook` real. Si se quiere asegurar HTTP 500, reemplazar Respond Agent Error por:
> ```json
> { "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1,
>   "parameters": { "respondWith": "json", "responseCode": 500,
>     "responseBody": "={{ JSON.stringify({status:'error',agent:$json.agent_name,error:$json.error_message}) }}" } }
> ```
> **Pero** esto requiere cambiar el `Orchestrator Entry` webhook a `responseMode:'responseNode'`. Cambio invasivo. Discutir con Damián.

---

## 3. Las 26 operaciones MCP precisas

Lista completa para aplicar en una sola llamada `n8n_update_partial_workflow` con `id="EF5lPbSNlmA3Upt1"` y modo atómico:

```javascript
[
  // 1-3: añadir los 3 nodos nuevos
  {"type":"addNode","node":<<Format Agent Error Context — ver Sección 2>>},
  {"type":"addNode","node":<<Log Agent Error>>},
  {"type":"addNode","node":<<Respond Agent Error>>},

  // 4-14: añadir onError a los 11 Run agent_X
  {"type":"updateNode","nodeName":"Run agent_briefing","updates":{"onError":"continueErrorOutput"}},
  {"type":"updateNode","nodeName":"Run agent_design","updates":{"onError":"continueErrorOutput"}},
  {"type":"updateNode","nodeName":"Run agent_regulatory","updates":{"onError":"continueErrorOutput"}},
  {"type":"updateNode","nodeName":"Run agent_materials","updates":{"onError":"continueErrorOutput"}},
  {"type":"updateNode","nodeName":"Run agent_costs","updates":{"onError":"continueErrorOutput"}},
  {"type":"updateNode","nodeName":"Run agent_documents (diseño)","updates":{"onError":"continueErrorOutput"}},
  {"type":"updateNode","nodeName":"Run agent_documents (propuesta)","updates":{"onError":"continueErrorOutput"}},
  {"type":"updateNode","nodeName":"Run agent_trades","updates":{"onError":"continueErrorOutput"}},
  {"type":"updateNode","nodeName":"Run agent_proposal","updates":{"onError":"continueErrorOutput"}},
  {"type":"updateNode","nodeName":"Run agent_planner","updates":{"onError":"continueErrorOutput"}},
  {"type":"updateNode","nodeName":"Run agent_memory","updates":{"onError":"continueErrorOutput"}},

  // 15-25: conectar las 11 ramas error → Format Agent Error Context
  // (sourceIndex=1 = error branch en executeWorkflow con onError)
  {"type":"addConnection","source":"Run agent_briefing","target":"Format Agent Error Context","sourceIndex":1},
  {"type":"addConnection","source":"Run agent_design","target":"Format Agent Error Context","sourceIndex":1},
  {"type":"addConnection","source":"Run agent_regulatory","target":"Format Agent Error Context","sourceIndex":1},
  {"type":"addConnection","source":"Run agent_materials","target":"Format Agent Error Context","sourceIndex":1},
  {"type":"addConnection","source":"Run agent_costs","target":"Format Agent Error Context","sourceIndex":1},
  {"type":"addConnection","source":"Run agent_documents (diseño)","target":"Format Agent Error Context","sourceIndex":1},
  {"type":"addConnection","source":"Run agent_documents (propuesta)","target":"Format Agent Error Context","sourceIndex":1},
  {"type":"addConnection","source":"Run agent_trades","target":"Format Agent Error Context","sourceIndex":1},
  {"type":"addConnection","source":"Run agent_proposal","target":"Format Agent Error Context","sourceIndex":1},
  {"type":"addConnection","source":"Run agent_planner","target":"Format Agent Error Context","sourceIndex":1},
  {"type":"addConnection","source":"Run agent_memory","target":"Format Agent Error Context","sourceIndex":1},

  // 26-27: conectar la cadena Format → Log → Respond
  {"type":"addConnection","source":"Format Agent Error Context","target":"Log Agent Error"},
  {"type":"addConnection","source":"Log Agent Error","target":"Respond Agent Error"}
]
```

**Total: 27 operations** (3 addNode + 11 updateNode + 13 addConnection).

---

## 4. Plan de validación post-aplicación

### 4.1 Test inmediato (validar estructura, no ejecuta)

```javascript
n8n_validate_workflow({
  id: "EF5lPbSNlmA3Upt1",
  options: { profile: "runtime" }
})
```

**Esperado:**
- `valid: true` o errores que ya estaban antes (los 6 falsos positivos del validador MCP).
- `errorCount` y `warningCount` iguales o inferiores.
- Los 11 warnings "Node has error output connections in main[1] but missing onError: 'continueErrorOutput'" deben **desaparecer**.

### 4.2 Test E2E con proyecto stub (opcional pero recomendado)

Forzar un fallo en `agent_briefing` y verificar que:

1. Webhook responde (no cuelga 30s).
2. Aparece fila en `activity_log` con `status='error'`, `agent_name='agent_briefing'`, `details->>'error_message'` no vacío.
3. `current_phase` del proyecto NO cambia (sigue en `intake`).
4. No hay registros parciales (briefing draft con status='committed' sin briefing real).

**Cómo forzar el fallo**: temporalmente desactivar la credencial OpenAI o introducir un breaking change en el LLM model recommended. Revertir tras el test.

---

## 5. Plan de rollback

### 5.1 Rollback granular (revertir solo PA-3)

```javascript
n8n_update_partial_workflow({
  id: "EF5lPbSNlmA3Upt1",
  intent: "Rollback PA-3 - eliminar handle agent error subgraph y onError",
  operations: [
    // Quitar las 11 conexiones error
    {"type":"removeConnection","source":"Run agent_briefing","target":"Format Agent Error Context","sourceIndex":1,"ignoreErrors":true},
    // ... (10 más, una por agente)

    // Quitar onError de los 11 Run agent_X
    {"type":"updateNode","nodeName":"Run agent_briefing","updates":{"onError":null}},
    // ... (10 más)

    // Eliminar los 3 nodos
    {"type":"removeNode","nodeName":"Respond Agent Error"},
    {"type":"removeNode","nodeName":"Log Agent Error"},
    {"type":"removeNode","nodeName":"Format Agent Error Context"}
  ]
})
```

### 5.2 Rollback completo (volver al snapshot)

Si el rollback granular falla, restaurar desde el snapshot `PROD_20260503_1242_main_orchestrator.json` (el último estable previo a PA-3) con `n8n_update_full_workflow`. Ese snapshot tiene 87 nodos con PA-5/PA-7/PA-8 ya aplicados.

---

## 6. Replicación a otros 7 workflows

Después del orchestrator, los 19 executeWorkflow restantes se reparten así:

| Workflow | executeWorkflow nodes | Esfuerzo |
|---|---|---|
| init_new_project | 3 | 30 min |
| agent_costs | 2 | 20 min |
| agent_materials | 3 | 30 min |
| agent_memory | 2 | 20 min |
| agent_briefing | 1 (1 ya con onError) | 10 min |
| agent_design | 1 | 10 min |
| agent_regulatory | 1 | 10 min |
| agent_planner | 1 | 10 min |
| agent_proposal | 1 | 10 min |
| agent_safety_plan | 1 | 10 min |
| agent_accessibility | 1 | 10 min |
| util_consultation | 1 | 10 min |
| **Total** | **18** | **~3h** |

Patrón a replicar en cada uno: añadir un mini "Handle Sub-error" con 2 nodos (Code + Postgres log error) + onError + 1 conexión error. No requiere Respond porque estos sub-workflows no son entrypoints de webhook (excepto init_new_project).

**Decisión bloqueante:** ¿se quiere mismo estilo en todos o personalizado por agente? Recomendación: mismo patrón, copy-paste. Reduce mantenimiento.

---

## 7. Cómo aplicar este plan

1. **Damián revisa secciones 2 y 3** (los 3 nodos + las 27 operations).
2. **Confirma con un sí o cambios**.
3. Ejecutar la llamada `n8n_update_partial_workflow` con las 27 operations en modo atómico (default).
4. Inmediatamente después: `n8n_validate_workflow({id, options:{profile:'runtime'}})`.
5. Si valida: snapshot `python snapshot_workflows.py --workflow main_orchestrator`.
6. Si E2E test pasa: replicar a los 12 workflows restantes (sección 6).
7. Commit B46 (X2 PA-3 aplicado).
