# Handoff v2 — Studio Multiagente (20 abril 2026)

Este documento resume todo el contexto del proyecto para que una nueva sesión pueda continuar sin perder nada. Actualiza `handoff_v1.md` si existía.

---

## Qué es esto

Sistema multiagente en **n8n 2.12.x** para un estudio de arquitectura técnica y reformas de vivienda. El sistema toma un proyecto ya captado (cliente existe) y lo procesa automáticamente: briefing → diseño → normativa → materiales → documentación → costes → oficios → propuesta → planificación. Todo coordinado por un orquestador.

**No es ecommerce. No es SaaS. Es el backend de un estudio de arquitectura.**

---

## Infraestructura

| Componente | Detalle |
|---|---|
| n8n | Self-hosted 2.12.x en EasyPanel — `https://n8n-n8n.zzeluw.easypanel.host` |
| Base de datos | Supabase (PostgreSQL 15+) — Transaction Pooler port 6543 |
| LLM | Anthropic Claude (preferido) o OpenAI GPT-4 — via HTTP Request o util_llm_call |
| Email | Gmail OAuth2 — para notificaciones y aprobaciones humanas |
| Credencial Postgres | ID: `cfxNZdzy0NB3xkYC` — nombre: "Postgres account" |
| Credencial Gmail | ID: `Y829iKHZi6Lh660e` — nombre: "Gmail DamianDomeya@" |

**Regla de trabajo**: Claude Code crea y actualiza todos los workflows via MCP. El usuario solo asigna credenciales en la UI de n8n y pulsa "Publish".

---

## IDs de workflows en n8n

| Workflow | ID | Estado |
|---|---|---|
| util_llm_call | `JoKqGZ8pDzhJohV2` | ✅ publicado |
| util_notification | `ks2CqrtJCxLJTPdV` | ✅ publicado |
| error_handler | `qfQWaGSpyjgdeFt5` | ✅ publicado |
| util_file_organizer | `QFEaO5gJEC7c0wvf` | ✅ publicado |
| init_new_project | `HzPLldZVJGFjKbuc` | ✅ publicado |
| main_orchestrator | `EF5lPbSNlmA3Upt1` | ✅ publicado (v1 mínimo) |
| agent_briefing | `uq3GQWSdmoIV4ZdR` | ✅ publicado |
| agent_design | `sMGf7e8CSnsBQa1q` | ✅ publicado |
| agent_regulatory | `QbRMmQs0oyVHplgE` | ✅ publicado |
| util_normativa_fetch | `4a03tQ7Q5nmtBpnI` | ✅ publicado |
| agent_normativa_refresh | `0Cyeaa85uLS7c8EE` | ✅ publicado (cache warmer) |
| agent_materials | `SOJW7SgCrJebLRP8` | ⚙️ creado — pendiente setup usuario |

---

## Tablas Supabase creadas

| Tabla | Descripción |
|---|---|
| `projects` | Tabla central. Campo `current_phase` gobierna el orquestador |
| `briefings` | Briefings de proyecto. Campos: `execution_id`, `exec_status` |
| `design_options` | Opciones de diseño. Campos: `execution_id`, `exec_status` |
| `regulatory_tasks` | Trámites normativos. Campos: `execution_id`, `exec_status`, `citation_url` |
| `materials` | Lista de materiales ← **pendiente crear** (ver SQL abajo) |
| `agent_prompts` | Prompts de sistema de cada agente. Campo `agent_name` |
| `agent_executions` | Log de ejecuciones. Patrón Draft/Commit |
| `normativa_sources` | Directorio de fuentes normativas oficiales (URLs) |
| `normativa_knowledge` | Cache/fallback de normativa fetched |
| `municipalities` | Localización para filtrar fuentes municipales |

### SQL pendiente — tabla `materials`

```sql
CREATE TABLE materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  execution_id uuid,
  exec_status text DEFAULT 'confirmed',
  category text,
  name text NOT NULL,
  description text,
  specification text,
  quantity numeric,
  unit text,
  estimated_unit_cost numeric,
  room text,
  priority text,
  notes text,
  status text DEFAULT 'identified',
  created_at timestamptz DEFAULT NOW()
);
```

---

## Patrón Draft/Commit (implementado en todos los agentes)

**Problema resuelto**: si un agente falla a mitad de ejecución, los datos parciales no contaminen el proyecto.

**Implementación**:
1. Al inicio: `INSERT INTO agent_executions (project_id, agent_name, status) VALUES (..., 'running')` → obtiene `execution_id`
2. Cada INSERT de datos: incluye `execution_id` y `exec_status = 'draft'`
3. Al final (éxito): `UPDATE materials SET exec_status = 'confirmed' WHERE execution_id = $1`
4. Completar ejecución: `UPDATE agent_executions SET status = 'completed', finished_at = NOW()`
5. Los SELECT de agentes downstream: siempre filtran `WHERE exec_status = 'confirmed'`

**Resultado**: el arquitecto/proyecto nunca ve datos parciales. Los `drafts` huérfanos los limpiará `cron_project_review` (pendiente de construir).

---

## Arquitectura normativa (3 capas)

**Problema resuelto**: la cache pre-procesada por LLM tenía alucinaciones embebidas.

**Solución**: el agente consulta fuentes oficiales **en tiempo real** en cada proyecto.

| Capa | Elemento | Rol |
|---|---|---|
| 1 | `normativa_sources` | Directorio: sabe QUÉ URL consultar por categoría |
| 2 | `util_normativa_fetch` | Fetcha fuentes via Jina AI Reader (`https://r.jina.ai/{url}`), devuelve texto oficial con citas |
| 3 | `normativa_knowledge` | Cache: SOLO fallback si los sitios están offline. Nunca fuente primaria |

**Confidence logic**:
- `"high"` → fuente live (texto oficial fresco)
- `"medium"` → desde cache (fallback)
- `"low"` → sin fuente (LLM solo, fuerza `consultation_required: true`)

Cada tarea regulatoria incluye `citation_url` para que el arquitecto verifique en la fuente oficial.

---

## Lógica de consulta al arquitecto (agent_regulatory)

Cuatro casos:

| Caso | Descripción | `consultation_reason` |
|---|---|---|
| A | Única solución normativa clara, alta confianza | — (autónomo, sin consulta) |
| B | Agente detecta mejora extra-normativa | `"proactive_recommendation"` |
| C | Múltiples soluciones válidas según contexto desconocido | `"ambiguous_context"` |
| D | Decisión podría chocar con directrices del estudio | `"directive_conflict"` |

`normativa_confidence: "low"` fuerza `consultation_required: true` automáticamente.

---

## Descripción de cada workflow

### util_llm_call
Wrapper centralizado para llamadas LLM. Recibe `prompt_system`, `prompt_user`, `model`, `temperature`. Devuelve `content` (respuesta del LLM). Todos los agentes lo llaman via Execute Sub-Workflow.

### util_notification
Envía emails via Gmail. Recibe `project_id`, `agent`, `message`, `type`.

### error_handler
Captura errores globales de n8n.

### util_file_organizer
Crea estructura de carpetas en Google Drive para cada proyecto.

### init_new_project
Punto de entrada. Registra un proyecto nuevo en Supabase y dispara el orquestador.

### main_orchestrator (v1 mínimo)
Lee `projects.current_phase` y despacha al agente correspondiente. Actualmente cubre: `intake → briefing_done → design_done`.

### agent_briefing
Extrae del input del proyecto (descripción, fotos, notas) la información estructurada: `rooms_affected`, `constraints`, objetivos. Guarda en `briefings`. Crea aprobación humana via Gmail/Wait node.

### agent_design
Genera 3 opciones de diseño basadas en el briefing. Guarda en `design_options`. El arquitecto selecciona una opción.

### agent_regulatory
Analiza el proyecto y la opción de diseño seleccionada. Llama a `util_normativa_fetch` para obtener normativa oficial en tiempo real. Genera lista de trámites en `regulatory_tasks`. Consulta al arquitecto en los 4 casos descritos arriba.

### util_normativa_fetch
Recibe `normativa_categories` + `location_province`. Fetcha las fuentes relevantes via Jina AI Reader. Devuelve `normativa_context` (texto oficial), `sources_fetched`, `all_live`, `fetch_timestamp`. Actualiza la cache tras cada fetch.

### agent_normativa_refresh
Cache warmer que el arquitecto activa manualmente cuando quiere. Su rol es garantizar que la cache esté disponible como fallback si los sitios oficiales caen. NO es la fuente de verdad.

### agent_materials
Genera la lista de materiales necesarios para ejecutar la opción de diseño seleccionada. Output: `category`, `name`, `specification`, `quantity`, `unit`, `estimated_unit_cost`, `room`, `priority`. Guarda en tabla `materials`.

---

## Setup pendiente para agent_materials

El usuario debe hacer en n8n y Supabase:

1. **Supabase**: ejecutar el SQL de creación de tabla `materials` (arriba)
2. **n8n**: abrir el workflow `agent_materials` (ID: `SOJW7SgCrJebLRP8`)
3. Asignar credencial Postgres ("Postgres account") a los 6 nodos Postgres
4. **Supabase** `agent_prompts`: insertar fila con `agent_name = 'agent_materials'` y el prompt de sistema
5. **n8n**: publicar el workflow

---

## Agentes pendientes de construir

En este orden estricto:

1. `agent_documents` — genera la documentación técnica del proyecto (determinista, sin LLM en MVP)
2. `agent_costs` — calcula presupuesto basado en materiales, oficios y zona geográfica
3. `agent_trades` — gestiona los oficios (albañilería, fontanería, electricidad, etc.)
4. `agent_proposal` — genera la propuesta comercial final con pre-flight checklist cross-agent
5. `agent_planner` — genera la planificación de obra (cronograma, fases, hitos)
6. `agent_memory` — gestiona el contexto y aprendizajes del estudio a lo largo del tiempo
7. `cron_project_review` — limpia drafts huérfanos, revisa proyectos bloqueados, envía recordatorios

---

## Visión futura — módulo 3D + RAG (post-MVP)

**Discutido pero NO se construye hasta terminar todos los agentes MVP.**

El usuario quiere un agente que se integre con software de diseño 3D (SketchUp, Blender) para generar modelos arquitectónicos. Arquitectura propuesta:

- **`agent_3d_design`**: genera geometría/instrucciones 3D usando LLM con razonamiento espacial. Puede conectarse via API/MCP a SketchUp o Blender.
- **Colaboración en tiempo real** con `agent_normativa`: mientras diseña, consulta si el diseño cumple normativa.
- **RAG especializado** en normativas (CTE, accesibilidad, urbanismo local).
- **Agente de "términos espaciales"**: knowledge base de conceptos de ergonomía, confort, proporciones — para que el LLM razone si algo es cómodo/funcional más allá de lo normativo.

**Chat sidebar + directives system** (también post-MVP):
- UI lateral de chat donde el arquitecto da instrucciones a los agentes en tiempo real.
- **Sistema de directrices**: preferencias del arquitecto almacenadas en Supabase (ej: "siempre proponer encimera de granito", "evitar carpintería de PVC"). Los agentes las consultan antes de decidir → si hay conflicto con normativa → `consultation_reason: "directive_conflict"`.
- Comunicación bidireccional arquitecto↔agente en tiempo real.

---

## Fases del proyecto (campo `projects.current_phase`)

```
intake → briefing_done → design_done → analysis_done → costs_done 
      → trades_done → proposal_done → approved → planning_done 
      → completed → archived
```

---

## Gotchas técnicos importantes

| Problema | Solución |
|---|---|
| IF node v2.2 con operador unario (boolean) | Requiere `conditions.options.version: 2` y `operator.singleValue: true` |
| jsCode con strings multilínea | Usar template literals (backticks). Las comillas simples con `\n` dan error de sintaxis |
| `updateNode` en `n8n_update_partial_workflow` | Formato: `{type: "updateNode", nodeName: "...", updates: {"dot.path.key": value}}` |
| `alwaysOutputData: true` en Postgres | Necesario en nodos donde el SELECT puede devolver 0 filas (evita que el flujo se detenga) |
| Sub-workflows deben estar publicados | En n8n 2.x, un Execute Workflow falla si el sub-workflow está inactivo |
| Postgres typeVersion | Usar 2.5 |
| SplitInBatches + loop | Output[0] → proceso → vuelve a SplitInBatches. Output[1] → done path |

---

## Estructura de archivos del proyecto

```
studio-multiagente/
├── CLAUDE.md                    ← contexto principal para Claude Code
├── handoff_v2.md                ← ESTE ARCHIVO
├── docs/
│   ├── arquitectura.md
│   ├── modelo_datos.md
│   ├── mapa_workflows.md
│   ├── agentes.md
│   └── plan_fases.md
├── schemas/
│   └── mvp_schema.sql
├── prompts/
│   └── agent_prompts.md
├── workflows/
│   └── (JSONs de n8n si se guardan localmente)
└── references/
    └── n8n_node_types.md
```

---

## Para continuar en una nueva sesión

1. Leer este archivo (`handoff_v2.md`)
2. Leer `CLAUDE.md` para las reglas de construcción
3. El siguiente agente a construir es **`agent_documents`**
4. Verificar que el usuario haya completado el setup de `agent_materials` (tabla SQL + credenciales + prompt + publicar)
5. Usar `n8n_list_workflows()` para confirmar el estado actual de los workflows en n8n
