# BLOQUE 3 — Mapa Completo de Workflows de n8n

## Sistema Multiagente para Estudio de Arquitectura Técnica y Reformas

**n8n: 2.12.x (stable)**
**Total de workflows: 17** (1 orquestador + 11 agentes + 5 auxiliares)

---

## CONVENCIONES DE ESTE DOCUMENTO

**Nomenclatura de nodos:** uso los nombres oficiales de n8n 2.12.x entre corchetes. Ejemplo: `[Postgres]`, `[HTTP Request]`, `[Code]`, `[Switch]`, `[If]`, `[Wait]`, `[Execute Sub-workflow]`, `[Edit Fields]`, `[Merge]`.

**Formato de cada workflow:**
- Nombre y ID sugerido
- Objetivo en una línea
- Trigger
- Secuencia de nodos con nombre descriptivo
- Decisiones condicionales
- Qué lee y escribe en BD
- Qué devuelve (si es sub-workflow)
- Qué sub-workflows llama
- Notas operativas

**"→" indica conexión directa entre nodos.** Las ramas se indican con sangría.

---

## ÍNDICE DE WORKFLOWS

| # | Nombre | Tipo | Trigger |
|---|---|---|---|
| 1 | `main_orchestrator` | Principal | Webhook + Schedule |
| 2 | `agent_briefing` | Agente | Execute Sub-workflow Trigger |
| 3 | `agent_design` | Agente | Execute Sub-workflow Trigger |
| 4 | `agent_regulatory` | Agente | Execute Sub-workflow Trigger |
| 5 | `agent_documents` | Agente | Execute Sub-workflow Trigger |
| 6 | `agent_materials` | Agente | Execute Sub-workflow Trigger |
| 7 | `agent_costs` | Agente | Execute Sub-workflow Trigger |
| 8 | `agent_trades` | Agente | Execute Sub-workflow Trigger |
| 9 | `agent_proposal` | Agente | Execute Sub-workflow Trigger |
| 10 | `agent_planner` | Agente | Execute Sub-workflow Trigger |
| 11 | `agent_memory` | Agente | Execute Sub-workflow Trigger |
| 12 | `util_llm_call` | Auxiliar | Execute Sub-workflow Trigger |
| 13 | `util_notification` | Auxiliar | Execute Sub-workflow Trigger |
| 14 | `util_file_organizer` | Auxiliar | Execute Sub-workflow Trigger |
| 15 | `cron_project_review` | Auxiliar | Schedule Trigger |
| 16 | `error_handler` | Auxiliar | Error Trigger |
| 17 | `init_new_project` | Auxiliar | Webhook |

---

## 1. WORKFLOW: `main_orchestrator`

### Objetivo
Cerebro del sistema. Lee el estado de un proyecto, decide qué agente ejecutar, lanza la ejecución, recoge el resultado, actualiza el estado y decide el siguiente paso.

### Trigger
- **Webhook** (POST): recibe `{project_id, action}` para avanzar un proyecto concreto.
  - `action`: `"advance"` (avanzar a siguiente fase), `"retry"` (reintentar fase actual), `"force_phase"` (forzar fase específica).
- **Schedule Trigger** (cada 4 horas en MVP): revisa todos los proyectos activos y avanza los que puedan avanzar.

### Secuencia de nodos

```
[Webhook: "Orchestrator Entry"]
    ↓
[Postgres: "Load Project"]
  → SELECT p.*, b.status as briefing_status, 
    (SELECT COUNT(*) FROM approvals WHERE project_id = p.id AND status = 'pending') as pending_approvals
    FROM projects p
    LEFT JOIN briefings b ON b.project_id = p.id AND b.status = 'approved'
    WHERE p.id = {{ $json.project_id }}
    ↓
[If: "Project Active?"]
  → Condición: $json.status == 'active'
  ├── FALSE → [Edit Fields: "Return Inactive"] → FIN
  └── TRUE ↓

[If: "Pending Approvals?"]
  → Condición: $json.pending_approvals > 0
  ├── TRUE → [Edit Fields: "Return Waiting Approval"] → FIN
  └── FALSE ↓

[Switch: "Route by Phase"]
  → Campo: $json.current_phase
  │
  ├── "intake" →
  │   [Execute Sub-workflow: agent_briefing]
  │     Input: {project_id, action: "generate"}
  │     Wait for completion: ON
  │   ↓
  │   [Code: "Evaluate Briefing Result"]
  │   ↓
  │   [If: "Briefing Approved?"]
  │   ├── YES → [Postgres: "Update Phase → briefing_done"]
  │   └── NO → [Edit Fields: "Return Pending Review"]
  │
  ├── "briefing_done" →
  │   [Execute Sub-workflow: agent_design]
  │     Input: {project_id, action: "generate_options"}
  │     Wait for completion: ON
  │   ↓
  │   [Code: "Evaluate Design Result"]
  │   ↓
  │   [If: "Design Option Selected?"]
  │   ├── YES → [Postgres: "Update Phase → design_done"]
  │   └── NO → [Edit Fields: "Return Pending Selection"]
  │
  ├── "design_done" →
  │   [Execute Sub-workflow: agent_regulatory]
  │     Input: {project_id}
  │     Wait for completion: ON
  │   ↓
  │   [Execute Sub-workflow: agent_materials]
  │     Input: {project_id}
  │     Wait for completion: ON
  │   ↓
  │   [Postgres: "Update Phase → analysis_done"]
  │   
  │   NOTA: En el MVP, regulatory y materials se ejecutan en secuencia,
  │   no en paralelo. Para paralelo real, usar dos Execute Sub-workflow
  │   desde la misma rama + nodo Merge (modo "Wait for Both").
  │   Se implementa en V2.
  │
  ├── "analysis_done" →
  │   [Execute Sub-workflow: agent_costs]
  │     Input: {project_id}
  │     Wait for completion: ON
  │   ↓
  │   [Code: "Evaluate Cost Result"]
  │   ↓
  │   [If: "Critical Overbudget?"]
  │   ├── YES → [Execute Sub-workflow: util_notification]
  │   │           Input: {project_id, type: "alert", message: "Sobrecoste crítico: X%"}
  │   └── (continúa en ambos casos)
  │   ↓
  │   [Postgres: "Update Phase → costs_done"]
  │
  ├── "costs_done" →
  │   [Execute Sub-workflow: agent_trades]
  │     Input: {project_id, action: "prepare_packages"}
  │     Wait for completion: ON
  │   ↓
  │   [Code: "Evaluate Trades Result"]
  │   ↓
  │   [Postgres: "Update Phase → trades_done"]
  │
  ├── "trades_done" →
  │   [Execute Sub-workflow: agent_proposal]
  │     Input: {project_id}
  │     Wait for completion: ON
  │   ↓
  │   [Code: "Evaluate Proposal Result"]
  │   ↓
  │   [Postgres: "Update Phase → proposal_done"]
  │
  ├── "proposal_done" →
  │   [Edit Fields: "Return Awaiting Client Response"]
  │   → El proyecto queda aquí hasta que el arquitecto marca
  │     manualmente que el cliente aceptó (vía webhook con
  │     action: "client_accepted")
  │
  ├── "approved" →
  │   [Execute Sub-workflow: agent_planner]
  │     Input: {project_id}
  │     Wait for completion: ON
  │   ↓
  │   [Postgres: "Update Phase → planning_done"]
  │
  ├── "planning_done" →
  │   [Execute Sub-workflow: agent_memory]
  │     Input: {project_id}
  │     Wait for completion: ON
  │   ↓
  │   [Postgres: "Update Phase → completed, status → completed"]
  │
  └── DEFAULT →
      [Edit Fields: "Return Unknown Phase"] → FIN

[Postgres: "Log Orchestrator Action"]
  → INSERT INTO activity_log (project_id, agent_name, action, phase_at_time, status)
  ↓
[Edit Fields: "Return Result"]
  → FIN
```

### Decisiones IF/Switch
- **If "Project Active?"**: descarta proyectos pausados/bloqueados/completados.
- **If "Pending Approvals?"**: no avanza si hay aprobaciones pendientes sin resolver.
- **Switch "Route by Phase"**: 11 ramas, una por fase posible.
- **If "Briefing Approved?"**: evalúa si el agente de briefing completó con aprobación.
- **If "Design Option Selected?"**: evalúa si hay una opción marcada como seleccionada.
- **If "Critical Overbudget?"**: alerta si la desviación supera el 30%.

### Qué lee de BD
- `projects` (estado actual, fase, presupuesto)
- `approvals` (si hay pendientes)
- Indirectamente vía los agentes: todas las tablas de output

### Qué escribe en BD
- `projects.current_phase` (actualización de fase)
- `projects.status` (si se completa)
- `activity_log` (registro de cada ciclo del orquestador)

### Qué devuelve
JSON con: `{project_id, previous_phase, new_phase, agent_executed, result_status, message}`

### Sub-workflows que llama
- `agent_briefing`, `agent_design`, `agent_regulatory`, `agent_materials`, `agent_costs`, `agent_trades`, `agent_proposal`, `agent_planner`, `agent_memory`
- `util_notification` (para alertas)

---

## 2. WORKFLOW: `agent_briefing`

### Objetivo
Convertir la información inicial del proyecto (notas, descripción, fotos, datos del cliente) en un briefing estructurado. Si se requiere aprobación, pausar con Wait node hasta que el arquitecto lo revise.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{project_id, action}`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger: "Input"]
  → Campos definidos: project_id (string), action (string)
    ↓
[Postgres: "Load Project + Client"]
  → SELECT p.*, c.name as client_name, c.address, c.city, c.notes as client_notes
    FROM projects p JOIN clients c ON c.id = p.client_id
    WHERE p.id = $1
    ↓
[Postgres: "Load Existing Briefing"]
  → SELECT * FROM briefings WHERE project_id = $1 ORDER BY version DESC LIMIT 1
    ↓
[Postgres: "Load Agent Prompt"]
  → SELECT content, model_recommended, temperature 
    FROM agent_prompts 
    WHERE agent_name = 'agent_briefing' AND prompt_type = 'system' AND is_active = true
    ↓
[Code: "Prepare LLM Payload"]
  → Construye el mensaje para el LLM:
    - System prompt (de agent_prompts)
    - Datos del proyecto y cliente como contexto
    - Instrucción de output en formato JSON estructurado
    - Si hay briefing previo rechazado, incluirlo como contexto de iteración
    ↓
[Execute Sub-workflow: util_llm_call]
  → Input: {prompt, model, temperature, project_id, agent_name: "agent_briefing"}
    ↓
[Code: "Parse Briefing Response"]
  → Extrae JSON del LLM: summary, client_needs, objectives, constraints,
    style_preferences, rooms_affected, missing_info, open_questions
  → Valida que los campos obligatorios estén presentes
    ↓
[If: "Valid Response?"]
  ├── FALSE →
  │   [Execute Sub-workflow: util_llm_call] (retry con prompt de corrección)
  │   → Si falla 2 veces: log error + return {status: "error"}
  └── TRUE ↓

[Postgres: "Save Briefing"]
  → INSERT INTO briefings (project_id, version, summary, client_needs, objectives,
    constraints, style_preferences, rooms_affected, missing_info, open_questions, status)
  → status = 'pending_review'
    ↓
[Postgres: "Create Approval"]
  → INSERT INTO approvals (project_id, approval_type, requested_by, summary, 
    details, related_entity, related_entity_id, status, webhook_token, expires_at)
  → approval_type = 'briefing_review'
  → expires_at = now() + interval '72 hours'
    ↓
[Execute Sub-workflow: util_notification]
  → Input: {project_id, type: "approval_request", approval_id, 
    subject: "Briefing listo para revisión", summary: ...}
    ↓
[Wait: "Wait for Approval"]
  → Resume: On Webhook Call
  → HTTP Method: POST
  → Limit Wait Time: ON → 72 horas
  → Webhook Suffix: "briefing-review"
    ↓
[Code: "Process Approval Response"]
  → Lee la respuesta del webhook: {action: "approve"|"reject", notes: "..."}
  → Valida webhook_token contra tabla approvals
    ↓
[Switch: "Approval Decision"]
  ├── "approve" →
  │   [Postgres: "Update Briefing → approved"]
  │   [Postgres: "Update Approval → approved"]
  │   [Edit Fields: "Return Success"]
  │     → {status: "complete", briefing_id, phase: "briefing_done"}
  │
  ├── "reject" →
  │   [Postgres: "Update Briefing → revision_requested"]
  │   [Postgres: "Update Approval → rejected"]
  │   [Edit Fields: "Return Revision Needed"]
  │     → {status: "revision_needed", notes: $json.notes}
  │
  └── TIMEOUT (Wait expiró) →
      [Postgres: "Update Approval → expired"]
      [Edit Fields: "Return Timeout"]
        → {status: "timeout"}
```

### Decisiones IF/Switch
- **If "Valid Response?"**: valida que el LLM devolvió JSON parseable con campos obligatorios.
- **Switch "Approval Decision"**: aprobado / rechazado / timeout.

### Qué lee de BD
- `projects` + `clients` (datos del proyecto)
- `briefings` (versión anterior si existe, para iteración)
- `agent_prompts` (prompt activo del agente)

### Qué escribe en BD
- `briefings` (nuevo registro)
- `approvals` (solicitud de aprobación)

### Qué devuelve
`{status, briefing_id, phase}` al orquestador.

### Sub-workflows que llama
- `util_llm_call` (1-2 veces: generación + posible retry)
- `util_notification` (envío de solicitud de aprobación)

---

## 3. WORKFLOW: `agent_design`

### Objetivo
Generar 2-3 opciones de redistribución/anteproyecto basadas en el briefing. Pausar para que el arquitecto seleccione una opción.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{project_id, action}`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger]
    ↓
[Postgres: "Load Project"]
[Postgres: "Load Approved Briefing"]
  → WHERE project_id = $1 AND status = 'approved' ORDER BY version DESC LIMIT 1
[Postgres: "Load Memory Cases"]
  → SELECT * FROM memory_cases 
    WHERE project_type = $project_type AND location_zone ILIKE $zone
    ORDER BY created_at DESC LIMIT 3
[Postgres: "Load Agent Prompt"]
    ↓
[Code: "Prepare Design Prompt"]
  → Inyecta: briefing completo, datos del proyecto, casos similares de memoria
  → Pide al LLM: generar 2-3 opciones con título, descripción, pros/cons,
    complejidad estimada, puntos de conflicto
    ↓
[Execute Sub-workflow: util_llm_call]
    ↓
[Code: "Parse Design Options"]
  → Extrae array de opciones del JSON de respuesta
  → Valida que haya al menos 2 opciones
    ↓
[If: "Valid Options?"]
  ├── FALSE → retry o error
  └── TRUE ↓

[Code: "Loop Prepare"] → prepara array para inserción
    ↓
[Postgres: "Save Design Options"]
  → INSERT múltiple en design_options (una fila por opción)
  → Todas con is_selected = false
    ↓
[Postgres: "Create Approval"]
  → approval_type = 'design_review'
    ↓
[Execute Sub-workflow: util_notification]
    ↓
[Wait: "Wait for Selection"]
  → Resume: On Form Submitted
  → Campos del formulario:
    - "Opción seleccionada" (dropdown: Opción 1 / Opción 2 / Opción 3 / Ninguna)
    - "Notas del arquitecto" (texto libre)
    - "Acción" (dropdown: Aprobar opción / Pedir nuevas opciones / Pausar)
  → Limit Wait Time: ON → 72 horas
    ↓
[Switch: "Selection Decision"]
  ├── "Aprobar opción" →
  │   [Postgres: "Mark Option as Selected"]
  │     → UPDATE design_options SET is_selected = true WHERE id = $selected_option_id
  │   [Postgres: "Update Approval → approved"]
  │   [Edit Fields: "Return Success"]
  │     → {status: "complete", selected_option_id, phase: "design_done"}
  │
  ├── "Pedir nuevas opciones" →
  │   [Postgres: "Update Approval → rejected"]
  │   [Edit Fields: "Return Retry"]
  │     → {status: "revision_needed", notes}
  │
  └── "Pausar" / TIMEOUT →
      [Edit Fields: "Return Paused"]
```

### Qué lee de BD
- `projects`, `briefings` (aprobado), `memory_cases` (casos similares), `agent_prompts`

### Qué escribe en BD
- `design_options` (2-3 registros nuevos)
- `approvals` (solicitud de revisión)

### Qué devuelve
`{status, selected_option_id, phase}`

### Sub-workflows que llama
- `util_llm_call`, `util_notification`

---

## 4. WORKFLOW: `agent_regulatory`

### Objetivo
Detectar trámites, permisos y documentación administrativa potencialmente necesarios. Preparar checklist, borradores de consulta y pasos a seguir. Si necesita contacto externo, solicitar aprobación.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{project_id}`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger]
    ↓
[Postgres: "Load Project"]
[Postgres: "Load Selected Design Option"]
  → WHERE project_id = $1 AND is_selected = true
[Postgres: "Load Briefing"]
[Postgres: "Load Agent Prompt"]
    ↓
[Code: "Prepare Regulatory Prompt"]
  → Inyecta: tipo de intervención, localización (ciudad, provincia),
    propuesta de distribución seleccionada, alcance del proyecto
  → Pide al LLM: detectar trámites necesarios con tipo, entidad,
    documentos requeridos, prioridad, plazo estimado, borrador de consulta
    ↓
[Execute Sub-workflow: util_llm_call]
    ↓
[Code: "Parse Regulatory Tasks"]
  → Extrae array de trámites del JSON
    ↓
[Postgres: "Save Regulatory Tasks"]
  → INSERT múltiple en regulatory_tasks
  → Todos con status = 'detected'
    ↓
[Code: "Check External Contact Needed"]
  → Evalúa si algún trámite requiere consulta externa (priority = 'critico')
    ↓
[If: "External Contact Needed?"]
  ├── FALSE →
  │   [Edit Fields: "Return Complete"]
  │     → {status: "complete", tasks_count: N, critical_count: N}
  │
  └── TRUE →
      [Postgres: "Create Approval for External Contact"]
        → approval_type = 'external_contact'
      [Execute Sub-workflow: util_notification]
        → Notifica que hay trámites críticos que pueden requerir consulta externa
      [Wait: "Wait for Contact Approval"]
        → Resume: On Webhook Call → 72h timeout
      ↓
      [Code: "Process Contact Decision"]
      [If: "Approved?"]
        ├── YES → marca tasks como 'confirmed'
        └── NO → mantiene como 'detected'
      ↓
      [Edit Fields: "Return Complete"]
```

### Qué lee de BD
- `projects`, `design_options` (seleccionada), `briefings`, `agent_prompts`

### Qué escribe en BD
- `regulatory_tasks` (múltiples registros)
- `approvals` (solo si hay contacto externo necesario)

### Qué devuelve
`{status, tasks_count, critical_count, external_contact_approved}`

### Sub-workflows que llama
- `util_llm_call`, `util_notification` (solo si hay aprobación)

---

## 5. WORKFLOW: `agent_documents`

### Objetivo
Organizar el expediente documental del proyecto. Clasificar documentos existentes, detectar faltantes, mantener estructura en Google Drive. Este agente es transversal: puede invocarse después de cualquier otro agente.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{project_id, trigger_agent}`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger]
    ↓
[Postgres: "Load Project"]
[Postgres: "Load Existing Documents"]
  → SELECT * FROM documents WHERE project_id = $1 AND status = 'active'
[Postgres: "Load Agent Prompt"]
    ↓
[Google Drive: "List Files in Project Folder"]
  → Lista archivos en /proyectos/{project_name}/
    ↓
[Code: "Compare Drive vs DB"]
  → Detecta archivos en Drive no registrados en BD
  → Detecta registros en BD sin archivo en Drive
  → Genera lista de acciones: registrar nuevos, marcar faltantes
    ↓
[If: "New Files to Register?"]
  ├── TRUE →
  │   [Code: "Classify New Files"]
  │     → Determina doc_type por extensión y nombre
  │     → Asigna tags básicos
  │   [Postgres: "Insert New Documents"]
  └── FALSE → continúa
    ↓
[Code: "Detect Missing Documents"]
  → Según el project_type y la fase actual, genera lista de documentos
    que deberían existir pero no existen
  → Ejemplo: si es reforma integral y hay briefing aprobado,
    debería haber al menos: plano actual, fotos estado actual, mediciones
    ↓
[If: "Missing Documents?"]
  ├── TRUE →
  │   [Postgres: "Save Missing Doc Alerts"]
  │     → INSERT en documents con status = 'missing' (o en activity_log como warning)
  └── FALSE → continúa
    ↓
[Edit Fields: "Return Result"]
  → {status: "complete", new_registered: N, missing_detected: N, total_docs: N}
```

### Qué lee de BD
- `projects`, `documents`

### Qué escribe en BD
- `documents` (nuevos registros para archivos encontrados en Drive)
- `activity_log` (warnings de documentos faltantes)

### Qué devuelve
`{status, new_registered, missing_detected, total_docs}`

### Sub-workflows que llama
- Ninguno (no necesita LLM en el MVP; la clasificación es por reglas).

### Nota
- En V2, la clasificación podría usar LLM para analizar contenido de documentos.
- En el MVP, clasifica por nombre de archivo y extensión con lógica en Code node.

---

## 6. WORKFLOW: `agent_materials`

### Objetivo
Buscar materiales, acabados, precios y alternativas para el proyecto. Alimentar al agente de costes con datos reales o estimados.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{project_id}`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger]
    ↓
[Postgres: "Load Project + Briefing + Selected Design"]
[Postgres: "Load Memory Cases Materials"]
  → SELECT materials_notable FROM memory_cases 
    WHERE project_type = $type ORDER BY created_at DESC LIMIT 3
[Postgres: "Load Agent Prompt"]
    ↓
[Code: "Prepare Materials Prompt"]
  → Inyecta: propuesta de distribución, estancias afectadas,
    preferencias de estilo del briefing, presupuesto objetivo,
    materiales de proyectos similares (de memoria)
  → Pide al LLM: lista de materiales por categoría con nombre, marca,
    precio estimado, gama, alternativas, y estancia donde aplica
    ↓
[Execute Sub-workflow: util_llm_call]
    ↓
[Code: "Parse Materials Response"]
  → Extrae array de materiales
  → Calcula total_estimated = unit_price × quantity para cada uno
  → Marca alternativas con is_alternative = true
    ↓
[Postgres: "Save Material Items"]
  → INSERT múltiple en material_items
  → Si hay alternativas, guarda con alternative_to apuntando al material principal
    ↓
[Code: "Calculate Materials Summary"]
  → Total de materiales estimado
  → Desglose por categoría
  → Alertas si algún material supera gama esperada por presupuesto
    ↓
[Edit Fields: "Return Result"]
  → {status: "complete", items_count, total_materials_cost, alerts: [...]}
```

### Qué lee de BD
- `projects`, `briefings`, `design_options`, `memory_cases`, `agent_prompts`

### Qué escribe en BD
- `material_items` (múltiples registros)

### Qué devuelve
`{status, items_count, total_materials_cost, alerts}`

### Sub-workflows que llama
- `util_llm_call`

---

## 7. WORKFLOW: `agent_costs`

### Objetivo
Convertir la propuesta de distribución + materiales + trámites en una estimación económica. Detectar si entra en presupuesto y proponer ajustes si no.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{project_id}`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger]
    ↓
[Postgres: "Load Project"]
[Postgres: "Load Selected Design"]
[Postgres: "Load Materials"]
  → SELECT * FROM material_items WHERE project_id = $1 AND status != 'rejected'
[Postgres: "Load Regulatory Tasks"]
  → Solo las confirmed o detected con priority critico/importante
[Postgres: "Load Memory Cases Costs"]
  → SELECT cost_estimated, cost_final, cost_deviation_pct, summary
    FROM memory_cases WHERE project_type = $type LIMIT 5
[Postgres: "Load Agent Prompt"]
    ↓
[Code: "Prepare Cost Prompt"]
  → Inyecta todo: distribución, materiales con precios, trámites con costes,
    superficie, tipo de inmueble, zona, presupuesto objetivo
  → Inyecta costes de proyectos similares como referencia
  → Pide al LLM: desglose por partidas, total, desviación vs presupuesto,
    ajustes sugeridos si hay sobrecoste, escenarios (económico/estándar/premium)
    ↓
[Execute Sub-workflow: util_llm_call]
    ↓
[Code: "Parse Cost Estimate"]
  → Extrae: breakdown, total, scenarios, adjustments
  → Calcula deviation_pct = ((total - budget_target) / budget_target) * 100
  → Determina deviation_status:
    - <= 0%: "within_budget"
    - 1-15%: "slight_over"
    - 16-30%: "over_budget"
    - > 30%: "critical_over"
    ↓
[Postgres: "Save Cost Estimate"]
  → INSERT en cost_estimates con todos los campos calculados
    ↓
[If: "Over Budget?"]
  ├── deviation_status IN ("over_budget", "critical_over") →
  │   [Code: "Prepare Adjustment Suggestions"]
  │   → Genera recomendaciones concretas de ajuste
  │   [Edit Fields: "Return with Warnings"]
  │     → {status: "complete", total, deviation_pct, deviation_status, has_warnings: true}
  │
  └── ELSE →
      [Edit Fields: "Return OK"]
        → {status: "complete", total, deviation_pct, deviation_status, has_warnings: false}
```

### Qué lee de BD
- `projects`, `design_options`, `material_items`, `regulatory_tasks`, `memory_cases`, `agent_prompts`

### Qué escribe en BD
- `cost_estimates` (1 registro)

### Qué devuelve
`{status, total, deviation_pct, deviation_status, has_warnings}`

### Sub-workflows que llama
- `util_llm_call`

---

## 8. WORKFLOW: `agent_trades`

### Objetivo
Detectar oficios necesarios, preparar paquetes de consulta, redactar mensajes y solicitar aprobación para enviarlos. Tras envío (manual o automatizado), recoger y comparar respuestas.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{project_id, action}`
- `action`: `"prepare_packages"` | `"compare_quotes"`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger]
    ↓
[Switch: "Action Router"]
  │
  ├── "prepare_packages" →
  │   [Postgres: "Load Everything"]
  │     → project, design_option, materials, cost_estimate, regulatory_tasks
  │   [Postgres: "Load Agent Prompt"]
  │       ↓
  │   [Code: "Prepare Trades Prompt"]
  │     → Pide al LLM: detectar oficios necesarios, para cada oficio generar
  │       scope, alcance, medidas relevantes, materiales aplicables,
  │       mensaje de solicitud de presupuesto listo para enviar
  │       ↓
  │   [Execute Sub-workflow: util_llm_call]
  │       ↓
  │   [Code: "Parse Trade Requests"]
  │     → Extrae array de oficios con sus paquetes
  │       ↓
  │   [Postgres: "Save Trade Requests"]
  │     → INSERT múltiple en trade_requests, todos con status = 'prepared'
  │       ↓
  │   [Postgres: "Create Approval"]
  │     → approval_type = 'trade_request_send'
  │   [Execute Sub-workflow: util_notification]
  │     → Envía resumen de oficios detectados + enlace para aprobar envío
  │       ↓
  │   [Wait: "Wait for Send Approval"]
  │     → Resume: On Form Submitted
  │     → Campos:
  │       - "Oficios a enviar" (checkboxes: lista de oficios detectados)
  │       - "Contactos a usar" (texto por oficio, pre-rellenado si hay)
  │       - "Acción" (Aprobar envío / Editar primero / Cancelar)
  │     → Timeout: 72h
  │       ↓
  │   [Switch: "Send Decision"]
  │     ├── "Aprobar envío" →
  │     │   [Postgres: "Update Selected Trades → approved_to_send"]
  │     │   [Postgres: "Update Approval → approved"]
  │     │   [Edit Fields: "Return Ready to Send"]
  │     │     → {status: "complete", trades_prepared: N, approved_to_send: N}
  │     │   
  │     │   NOTA: El envío real en MVP es MANUAL.
  │     │   El sistema deja los mensajes listos, el arquitecto los copia y envía.
  │     │   En V2 se puede automatizar con Gmail/WhatsApp.
  │     │
  │     ├── "Editar primero" →
  │     │   [Edit Fields: "Return Needs Edit"]
  │     │
  │     └── TIMEOUT →
  │         [Edit Fields: "Return Timeout"]
  │
  └── "compare_quotes" →
      [Postgres: "Load Trade Requests + Quotes"]
        → SELECT tr.*, eq.* FROM trade_requests tr
          LEFT JOIN external_quotes eq ON eq.trade_request_id = tr.id
          WHERE tr.project_id = $1
          ↓
      [Code: "Prepare Comparison Prompt"]
        → Para cada oficio con múltiples quotes, pide comparativa al LLM
          ↓
      [Execute Sub-workflow: util_llm_call]
          ↓
      [Code: "Parse Comparison"]
          ↓
      [Postgres: "Update Quotes with Comparison Notes"]
          ↓
      [Edit Fields: "Return Comparison"]
        → {status: "complete", trades_compared: N, best_options: [...]}
```

### Qué lee de BD
- `projects`, `design_options`, `material_items`, `cost_estimates`, `regulatory_tasks`, `trade_requests`, `external_quotes`, `agent_prompts`

### Qué escribe en BD
- `trade_requests` (nuevos registros o updates de status)
- `approvals` (solicitud de aprobación de envío)
- `external_quotes` (updates con comparison_notes)

### Qué devuelve
`{status, trades_prepared, approved_to_send}` o `{status, trades_compared, best_options}`

### Sub-workflows que llama
- `util_llm_call`, `util_notification`

---

## 9. WORKFLOW: `agent_proposal`

### Objetivo
Montar la propuesta comercial final combinando todo el trabajo de los agentes anteriores. Solicitar aprobación antes de enviar al cliente.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{project_id}`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger]
    ↓
[Postgres: "Load All Project Data"]
  → project, briefing, selected design, regulatory_tasks, materials,
    cost_estimate (latest), trade_requests + quotes, agent_prompts
    ↓
[Code: "Prepare Proposal Prompt"]
  → Inyecta TODO el contexto del proyecto
  → Pide al LLM: generar propuesta comercial con executive_summary,
    scope, phases, price_breakdown, exclusions, inclusions,
    payment_conditions, warnings, optional_items
    ↓
[Execute Sub-workflow: util_llm_call]
    ↓
[Code: "Parse Proposal"]
    ↓
[Postgres: "Save Proposal"]
  → INSERT en proposals con status = 'draft'
    ↓
[Postgres: "Create Approval"]
  → approval_type = 'proposal_review'
[Execute Sub-workflow: util_notification]
    ↓
[Wait: "Wait for Review"]
  → Resume: On Form Submitted
  → Campos: Acción (Aprobar / Pedir cambios / Rechazar), Notas
  → Timeout: 72h
    ↓
[Switch: "Review Decision"]
  ├── "Aprobar" →
  │   [Postgres: "Update Proposal → approved_internal"]
  │   [Postgres: "Update Approval → approved"]
  │       ↓
  │   [Postgres: "Create Send Approval"]
  │     → approval_type = 'proposal_send' (segunda aprobación: para enviar)
  │   [Execute Sub-workflow: util_notification]
  │     → "Propuesta aprobada internamente. ¿Enviar al cliente?"
  │       ↓
  │   [Wait: "Wait for Send Confirmation"]
  │     → Resume: On Webhook Call → 48h timeout
  │       ↓
  │   [If: "Send Approved?"]
  │     ├── YES →
  │     │   [Postgres: "Update Proposal → sent_to_client"]
  │     │   [Edit Fields: "Return Sent"]
  │     │     → {status: "complete", proposal_id, phase: "proposal_done"}
  │     └── NO →
  │         [Edit Fields: "Return Hold"]
  │
  ├── "Pedir cambios" →
  │   [Edit Fields: "Return Revision Needed"]
  │
  └── TIMEOUT →
      [Edit Fields: "Return Timeout"]
```

### Nota
- Este agente tiene DOBLE aprobación: primero revisión interna, luego confirmación de envío al cliente. Esto es deliberado: el arquitecto primero valida que la propuesta es correcta, y después decide cuándo la envía.

### Qué lee de BD
- Todas las tablas del proyecto.

### Qué escribe en BD
- `proposals` (1 registro)
- `approvals` (2 registros: review + send)

### Qué devuelve
`{status, proposal_id, phase}`

### Sub-workflows que llama
- `util_llm_call`, `util_notification`

---

## 10. WORKFLOW: `agent_planner`

### Objetivo
Transformar el proyecto aprobado en un plan operativo con fases, tareas, dependencias, hitos y cronograma.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{project_id}`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger]
    ↓
[Postgres: "Load All Project Data"]
  → project, proposal (accepted), design, trades (selected), 
    regulatory_tasks (confirmed), agent_prompts
    ↓
[Code: "Prepare Planner Prompt"]
  → Inyecta: alcance aprobado, oficios confirmados con sus plazos,
    trámites pendientes, restricciones de acceso/calendario
  → Pide al LLM: plan de proyecto con phases, tasks, dependencies,
    milestones, critical_path, blockers, total_duration
    ↓
[Execute Sub-workflow: util_llm_call]
    ↓
[Code: "Parse Plan"]
  → Extrae JSON estructurado
  → Calcula end_date = start_date + total_duration_days
    ↓
[Postgres: "Save Project Plan"]
  → INSERT en project_plans
    ↓
[Edit Fields: "Return Result"]
  → {status: "complete", plan_id, total_duration_days, start_date, end_date}
```

### Qué lee de BD
- `projects`, `proposals`, `design_options`, `trade_requests`, `regulatory_tasks`, `agent_prompts`

### Qué escribe en BD
- `project_plans` (1 registro)

### Qué devuelve
`{status, plan_id, total_duration_days, start_date, end_date}`

### Sub-workflows que llama
- `util_llm_call`

---

## 11. WORKFLOW: `agent_memory`

### Objetivo
Extraer las lecciones, patrones y datos clave del proyecto completado y guardarlos como caso reutilizable en la memoria del estudio.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{project_id}`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger]
    ↓
[Postgres: "Load Complete Project Data"]
  → project, briefing, design, regulatory, materials, costs,
    trades + quotes, proposal, plan, activity_log (summary)
    ↓
[Code: "Calculate Final Metrics"]
  → cost_estimated vs cost_final (si está disponible)
  → duration_estimated vs duration_actual
  → count of trades used, materials notable
    ↓
[Code: "Prepare Memory Prompt"]
  → Inyecta todo el historial del proyecto
  → Pide al LLM: generar resumen del caso, decisiones clave,
    lecciones aprendidas, problemas encontrados, patrones detectados,
    tags sugeridos para búsqueda futura
    ↓
[Execute Sub-workflow: util_llm_call]
    ↓
[Code: "Parse Memory Case"]
    ↓
[Postgres: "Save Memory Case"]
  → INSERT en memory_cases
    ↓
[Execute Sub-workflow: agent_documents]
  → Trigger final de organización documental del expediente completo
    ↓
[Edit Fields: "Return Result"]
  → {status: "complete", memory_case_id}
```

### Qué lee de BD
- Todas las tablas del proyecto.

### Qué escribe en BD
- `memory_cases` (1 registro)

### Qué devuelve
`{status, memory_case_id}`

### Sub-workflows que llama
- `util_llm_call`, `agent_documents`

---

## 12. WORKFLOW: `util_llm_call`

### Objetivo
Wrapper centralizado para todas las llamadas al LLM. Maneja autenticación, retry, logging de tokens y coste. Todos los agentes usan este workflow en lugar de tener su propia lógica de llamada.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{prompt_system, prompt_user, model, temperature, project_id, agent_name, max_retries}`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger]
  → Campos: prompt_system, prompt_user, model (default: "claude-sonnet-4-20250514"),
    temperature (default: 0.3), project_id, agent_name, max_retries (default: 2)
    ↓
[Edit Fields: "Set Defaults"]
  → Aplica defaults si no vienen en el input
    ↓
[HTTP Request: "Call LLM API"]
  → Method: POST
  → URL: https://api.anthropic.com/v1/messages 
    (o https://api.openai.com/v1/chat/completions según modelo)
  → Authentication: Predefined Credential (Header Auth con API key)
  → Headers: content-type: application/json, anthropic-version: 2023-06-01
  → Body (JSON):
    {
      "model": "{{ $json.model }}",
      "max_tokens": 4096,
      "temperature": {{ $json.temperature }},
      "system": "{{ $json.prompt_system }}",
      "messages": [{"role": "user", "content": "{{ $json.prompt_user }}"}]
    }
  → Timeout: 120000 (2 minutos)
  → On Error: Continue (para manejar errores nosotros)
    ↓
[If: "Success?"]
  → Condición: HTTP status 200 Y response.content existe
  ├── TRUE →
  │   [Code: "Extract Response"]
  │     → text = response.content[0].text
  │     → tokens_in = response.usage.input_tokens
  │     → tokens_out = response.usage.output_tokens
  │       ↓
  │   [Postgres: "Log LLM Call"]
  │     → INSERT INTO activity_log (project_id, agent_name, action, 
  │       llm_model, llm_tokens_in, llm_tokens_out, llm_cost_estimated,
  │       duration_ms, status)
  │     → action = 'llm_call'
  │     → llm_cost_estimated = cálculo basado en modelo y tokens
  │       ↓
  │   [Edit Fields: "Return Success"]
  │     → {status: "success", text, tokens_in, tokens_out, model}
  │
  └── FALSE →
      [Code: "Increment Retry Counter"]
          ↓
      [If: "Retries Left?"]
        ├── YES →
        │   [Wait: "Backoff"]
        │     → After Time Interval: 5 seconds
        │   → Loop back a "Call LLM API" 
        │     (en n8n: duplicar la rama HTTP Request con retry)
        │
        └── NO →
            [Postgres: "Log LLM Error"]
              → INSERT INTO activity_log (..., status: 'error', error_message)
            [Edit Fields: "Return Error"]
              → {status: "error", error_message, retries_attempted}
```

### Nota sobre retry en n8n
n8n 2.x soporta retry nativo en el nodo HTTP Request (Settings → Retry on Fail, Max Tries, Wait Between Tries). Usar esa opción nativa en lugar de construir el loop manualmente. Configurar: Max Tries = 3, Wait Between Tries = 5000ms.

### Qué lee de BD
- Nada directamente (recibe todo por input).

### Qué escribe en BD
- `activity_log` (1 registro por llamada, exitosa o fallida)

### Qué devuelve
`{status, text, tokens_in, tokens_out, model}` o `{status: "error", error_message}`

### Sub-workflows que llama
- Ninguno.

---

## 13. WORKFLOW: `util_notification`

### Objetivo
Enviar notificaciones al arquitecto. Centraliza el envío de emails, alertas y solicitudes de aprobación.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{project_id, type, subject, message, approval_id, recipient}`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger]
  → Campos: project_id, type (approval_request | alert | info),
    subject, message, approval_id (optional), recipient (optional, default: arquitecto principal)
    ↓
[Postgres: "Load Project Name"]
  → SELECT name FROM projects WHERE id = $1
    ↓
[Code: "Build Notification Content"]
  → Construye el cuerpo del email:
    - Si type = "approval_request": incluye enlaces de aprobar/rechazar
      con webhook URL + token
    - Si type = "alert": incluye urgencia y resumen
    - Si type = "info": solo informativo
    ↓
[Gmail: "Send Notification"]
  → To: {{ $json.recipient || 'botelladesdeel98@gmail.com' }}
  → Subject: [Studio AI] {{ $json.subject }} — {{ $json.project_name }}
  → Body: HTML con contenido construido
    ↓
[Postgres: "Log Notification"]
  → INSERT INTO activity_log (project_id, agent_name, action, status)
  → agent_name = 'util_notification', action = 'email_sent'
    ↓
[Edit Fields: "Return Result"]
  → {status: "sent", channel: "email"}
```

### Qué lee de BD
- `projects` (nombre del proyecto)

### Qué escribe en BD
- `activity_log` (registro del envío)

### Qué devuelve
`{status: "sent", channel}`

### Sub-workflows que llama
- Ninguno.

---

## 14. WORKFLOW: `util_file_organizer`

### Objetivo
Crear la estructura de carpetas estándar en Google Drive para un proyecto nuevo, y mover archivos a su carpeta correspondiente.

### Trigger
`[Execute Sub-workflow Trigger]` — Input: `{project_id, action}`
- `action`: `"create_structure"` | `"move_file"`

### Secuencia de nodos

```
[Execute Sub-workflow Trigger]
    ↓
[Switch: "Action"]
  │
  ├── "create_structure" →
  │   [Postgres: "Load Project"]
  │   [Google Drive: "Create Root Folder"]
  │     → Name: "{project_name}_{project_id_short}"
  │     → Parent: /proyectos/
  │   [Google Drive: "Create Subfolder: planos"]
  │   [Google Drive: "Create Subfolder: fotos"]
  │   [Google Drive: "Create Subfolder: docs"]
  │   [Google Drive: "Create Subfolder: presupuestos"]
  │   [Google Drive: "Create Subfolder: propuestas"]
  │   [Google Drive: "Create Subfolder: administrativo"]
  │   [Postgres: "Save Drive Folder IDs"]
  │     → UPDATE projects SET metadata = metadata || 
  │       '{"drive_root_id": "...", "drive_folders": {...}}'
  │   [Edit Fields: "Return Structure Created"]
  │
  └── "move_file" →
      [Postgres: "Load Document Record"]
      [Google Drive: "Move File to Correct Folder"]
      [Postgres: "Update Document drive_path"]
      [Edit Fields: "Return File Moved"]
```

### Qué lee de BD
- `projects`, `documents`

### Qué escribe en BD
- `projects.metadata` (IDs de carpetas de Drive)
- `documents.drive_path` y `documents.drive_file_id`

### Qué devuelve
`{status, root_folder_id}` o `{status, file_moved}`

### Sub-workflows que llama
- Ninguno.

---

## 15. WORKFLOW: `cron_project_review`

### Objetivo
Revisión periódica automática de todos los proyectos activos. Detecta bloqueos, aprobaciones expiradas, proyectos parados, y envía recordatorios.

### Trigger
`[Schedule Trigger]` — Cada 8 horas (configurable)

### Secuencia de nodos

```
[Schedule Trigger: "Every 8 Hours"]
    ↓
[Postgres: "Load Active Projects"]
  → SELECT p.id, p.name, p.current_phase, p.updated_at,
      (SELECT COUNT(*) FROM approvals a 
       WHERE a.project_id = p.id AND a.status = 'pending') as pending_approvals,
      (SELECT MAX(created_at) FROM activity_log al 
       WHERE al.project_id = p.id) as last_activity
    FROM projects p WHERE p.status = 'active'
    ↓
[Code: "Analyze Projects"]
  → Para cada proyecto evalúa:
    - ¿Tiene aprobaciones pendientes > 48h? → recordatorio
    - ¿Última actividad > 5 días? → alerta de inactividad
    - ¿Hay aprobaciones expiradas? → marcar como expired
    ↓
[If: "Issues Found?"]
  ├── FALSE → FIN
  └── TRUE ↓

[Postgres: "Expire Old Approvals"]
  → UPDATE approvals SET status = 'expired' 
    WHERE status = 'pending' AND expires_at < now()
    ↓
[Code: "Build Summary"]
  → Genera resumen de todos los issues encontrados
    ↓
[Execute Sub-workflow: util_notification]
  → type: "alert"
  → subject: "Revisión diaria: X proyectos requieren atención"
  → message: resumen con lista de proyectos y sus issues
    ↓
[Postgres: "Log Review"]
  → INSERT INTO activity_log (agent_name: 'cron_project_review', ...)
```

### Qué lee de BD
- `projects`, `approvals`, `activity_log`

### Qué escribe en BD
- `approvals` (expirar las vencidas)
- `activity_log` (registro de la revisión)

### Qué devuelve
No aplica (no es sub-workflow).

### Sub-workflows que llama
- `util_notification`

---

## 16. WORKFLOW: `error_handler`

### Objetivo
Capturar errores de cualquier workflow del sistema, registrarlos y alertar.

### Trigger
`[Error Trigger]` — Se activa cuando cualquier workflow configurado falla.

### Secuencia de nodos

```
[Error Trigger: "On Workflow Error"]
  → Recibe: workflow name, execution id, error message, node that failed
    ↓
[Code: "Extract Error Details"]
  → Parsea la info del error: workflow, nodo, mensaje, timestamp
  → Intenta extraer project_id si está disponible en los datos de ejecución
    ↓
[Postgres: "Log Error"]
  → INSERT INTO activity_log (
    project_id: $project_id_if_available,
    agent_name: $workflow_name,
    action: 'workflow_error',
    status: 'error',
    error_message: $error_details,
    execution_id: $execution_id
  )
    ↓
[If: "Critical Workflow?"]
  → Condición: workflow_name IN ('main_orchestrator', 'agent_proposal', 'agent_trades')
  ├── TRUE →
  │   [Gmail: "Send Critical Error Alert"]
  │     → Subject: [CRITICAL] Error en {{ workflow_name }}
  │     → Body: detalles del error
  └── FALSE →
      [Gmail: "Send Error Notice"]
        → Subject: [ERROR] {{ workflow_name }} falló
```

### Qué lee de BD
- Nada.

### Qué escribe en BD
- `activity_log` (registro del error)

### Qué devuelve
No aplica.

### Sub-workflows que llama
- Ninguno (usa Gmail directamente para evitar dependencia circular).

---

## 17. WORKFLOW: `init_new_project`

### Objetivo
Punto de entrada para crear un nuevo proyecto en el sistema. Recibe los datos iniciales, crea el registro en BD, prepara la estructura en Drive, y dispara el orquestador.

### Trigger
`[Webhook]` (POST) — Recibe datos iniciales del proyecto.

### Secuencia de nodos

```
[Webhook: "New Project"]
  → Recibe: {client_name, client_email, client_phone, project_name,
    project_type, location_address, location_city, location_province,
    property_type, property_area_m2, budget_target, urgency, notes}
    ↓
[Code: "Validate Input"]
  → Verifica campos obligatorios: client_name, project_name, project_type
  → Si faltan campos → return error
    ↓
[Postgres: "Find or Create Client"]
  → SELECT id FROM clients WHERE email = $email
  → Si no existe: INSERT INTO clients (...) RETURNING id
    ↓
[Postgres: "Create Project"]
  → INSERT INTO projects (client_id, name, project_type, budget_target,
    location_address, location_city, location_province, property_type,
    property_area_m2, urgency, current_phase, status, metadata)
  → current_phase = 'intake'
  → status = 'active'
  → metadata = {notes: $notes}
  → RETURNING id
    ↓
[Execute Sub-workflow: util_file_organizer]
  → Input: {project_id, action: "create_structure"}
    ↓
[Postgres: "Log Project Creation"]
  → INSERT INTO activity_log (project_id, agent_name: 'init_new_project',
    action: 'project_created', status: 'success')
    ↓
[Execute Sub-workflow: util_notification]
  → Input: {project_id, type: "info", 
    subject: "Nuevo proyecto creado",
    message: "Se ha creado el proyecto {name}. Sube la documentación inicial a Drive."}
    ↓
[Code: "Trigger Orchestrator"]
  → Prepara payload para disparar el orquestador
    ↓
[HTTP Request: "Call Orchestrator Webhook"]
  → POST al webhook del main_orchestrator
  → Body: {project_id, action: "advance"}
    ↓
[Edit Fields: "Return Project Created"]
  → Devuelve al webhook caller:
    {project_id, project_name, status: "created", drive_folder: "...", 
     message: "Proyecto creado. El sistema comenzará a procesar cuando haya datos iniciales."}
```

### Qué lee de BD
- `clients` (buscar existente)

### Qué escribe en BD
- `clients` (crear si no existe)
- `projects` (nuevo registro)
- `activity_log`

### Qué devuelve
`{project_id, project_name, status, drive_folder, message}` al caller del webhook.

### Sub-workflows que llama
- `util_file_organizer`, `util_notification`
- Dispara `main_orchestrator` vía HTTP Request al webhook.

---

## RESUMEN: MAPA DE DEPENDENCIAS ENTRE WORKFLOWS

```
init_new_project
  ├── util_file_organizer
  ├── util_notification
  └── main_orchestrator (vía HTTP)
        │
        ├── agent_briefing
        │     ├── util_llm_call
        │     └── util_notification
        │
        ├── agent_design
        │     ├── util_llm_call
        │     └── util_notification
        │
        ├── agent_regulatory
        │     ├── util_llm_call
        │     └── util_notification (solo si contacto externo)
        │
        ├── agent_materials
        │     └── util_llm_call
        │
        ├── agent_documents
        │     └── (sin dependencias)
        │
        ├── agent_costs
        │     └── util_llm_call
        │
        ├── agent_trades
        │     ├── util_llm_call
        │     └── util_notification
        │
        ├── agent_proposal
        │     ├── util_llm_call
        │     └── util_notification
        │
        ├── agent_planner
        │     └── util_llm_call
        │
        ├── agent_memory
        │     ├── util_llm_call
        │     └── agent_documents
        │
        └── util_notification (alertas directas)

cron_project_review (independiente)
  └── util_notification

error_handler (independiente)
  └── (Gmail directo, sin dependencias)
```

---

## ORDEN DE CONSTRUCCIÓN RECOMENDADO

Para construir estos workflows de forma incremental y testeable:

```
SEMANA 1: Infraestructura
  1. util_llm_call        ← testeable de forma aislada
  2. util_notification    ← testeable con email real
  3. error_handler        ← captura errores desde el día 1

SEMANA 2: Entrada y primer agente
  4. init_new_project     ← crea proyectos
  5. util_file_organizer  ← estructura Drive
  6. agent_briefing       ← primer agente con aprobación
  7. main_orchestrator    ← versión mínima (solo fase intake → briefing)

SEMANA 3: Diseño y análisis
  8. agent_design         ← segundo agente con aprobación
  9. agent_regulatory     ← detección de trámites
  10. agent_materials     ← búsqueda de materiales
  11. agent_documents     ← organización documental

SEMANA 4: Costes, oficios, propuesta
  12. agent_costs         ← estimación económica
  13. agent_trades        ← oficios y presupuestos
  14. agent_proposal      ← propuesta comercial

SEMANA 5: Planificación y cierre
  15. agent_planner       ← plan operativo
  16. agent_memory        ← cierre y memoria
  17. cron_project_review ← revisión automática

  → Ampliar main_orchestrator para cubrir todas las fases
```

---

## NOTA SOBRE PUBLICACIÓN (n8n 2.x)

Todos los sub-workflows DEBEN estar Published para funcionar en producción. Orden de publicación:

1. Primero publicar los auxiliares: `util_llm_call`, `util_notification`, `error_handler`, `util_file_organizer`
2. Luego los agentes: cada uno según se vaya construyendo
3. Finalmente el orquestador: `main_orchestrator`
4. Y `init_new_project` como último paso

Si se modifica un agente, editar en Draft → testear → publicar. El orquestador seguirá usando la versión publicada anterior hasta que publiques la nueva.

---

*Documento: BLOQUE 3 — Mapa Completo de Workflows de n8n*
*Total: 17 workflows (1 orquestador + 11 agentes + 5 auxiliares)*
*Siguiente: BLOQUE 4 — Detalle de implementación por agente*
