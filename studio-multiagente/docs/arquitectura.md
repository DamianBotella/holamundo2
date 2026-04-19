# BLOQUE 1 — Arquitectura General del Sistema Multiagente en n8n 2.12.x

## Estudio de Arquitectura Técnica y Reformas de Vivienda

**Versión n8n objetivo: 2.12.x (stable)**
**Fecha de referencia: Marzo 2026**

---

## 0. CAMBIOS DE n8n 2.x QUE AFECTAN A ESTA ARQUITECTURA

Antes de entrar en la arquitectura, estos son los cambios de n8n 2.0+ que impactan directamente en nuestro diseño. No son opcionales — condicionan cómo construimos todo.

### 0.1 Draft / Publish (sistema de publicación separado)

En n8n 2.x, guardar un workflow NO lo pone en producción. Existe una separación explícita:

- **Draft**: estado de edición. Se autoguarda cada 1-5 segundos. Los cambios en draft NO afectan a la versión en producción.
- **Published**: versión activa en producción. Solo se actualiza cuando haces clic en "Publish" (o Shift+P).

**Impacto en nuestra arquitectura:**
- Todos los subworkflows de agentes DEBEN estar Published para que el orquestador pueda invocarlos.
- Si editas un agente (por ejemplo, cambias su prompt), los cambios NO afectan producción hasta que publiques.
- Esto es una ventaja enorme: podemos iterar prompts y lógica en draft sin romper el sistema en vivo.
- Debemos establecer un protocolo de publicación: editar → testear → publicar.

### 0.2 Task Runners (aislamiento de Code nodes)

En n8n 2.x, los Code nodes (JavaScript y Python) se ejecutan en entornos aislados (Task Runners) por defecto.

**Restricciones que nos afectan:**
- **No hay acceso a variables de entorno** desde Code nodes por defecto. Si necesitamos leer env vars (por ejemplo, API keys del LLM), debemos usar el sistema de Credentials de n8n, NO env vars en código.
- **No hay acceso al sistema de archivos** desde Code nodes. No se puede hacer `fs.readFile()`. Para manejar archivos, usar nodos dedicados (Google Drive, HTTP Request para descargar, etc.).
- **No se pueden hacer HTTP requests desde Code nodes** directamente. Para llamadas HTTP, usar el nodo HTTP Request, no `fetch()` dentro de un Code node.
- **El nodo ExecuteCommand está deshabilitado** por defecto. No podemos ejecutar comandos shell desde workflows a menos que lo habilitemos explícitamente (no recomendado para producción).

**Impacto en nuestra arquitectura:**
- Las llamadas al LLM se hacen con nodos **HTTP Request**, no con código en Code nodes. Esto ya era nuestra recomendación, ahora es obligatorio de facto.
- La lógica de parsing/transformación de JSON sí puede ir en Code nodes (JavaScript o Python), pero sin hacer llamadas externas.
- Las API keys van en Credentials de n8n (Header Auth o Custom Auth), referenciadas por el nodo HTTP Request.

### 0.3 Fix del Wait node en sub-workflows

Este cambio es CRÍTICO para nuestra arquitectura de aprobaciones.

**Antes (n8n 1.x):** cuando un workflow padre llamaba a un sub-workflow que contenía un Wait node (espera de webhook, formulario, etc.), el padre recibía datos incorrectos o se colgaba. Las aprobaciones human-in-the-loop en sub-workflows eran poco fiables.

**Ahora (n8n 2.x):** el workflow padre se pausa correctamente cuando el sub-workflow entra en estado "waiting". Cuando el humano completa la acción (aprueba/rechaza), los datos fluyen de vuelta al padre de forma limpia.

**Impacto en nuestra arquitectura:**
- Las aprobaciones humanas PUEDEN vivir dentro de los sub-workflows de cada agente. Esto simplifica enormemente el diseño.
- El orquestador puede llamar a un agente, ese agente puede incluir un Wait node para aprobación, y cuando el humano responde, el resultado vuelve limpio al orquestador.
- **Requisito:** los sub-workflows con Wait DEBEN estar Published.

### 0.4 Nombres de nodos actualizados (n8n 2.12.x)

| Nombre oficial actual | Tipo interno | Nota |
|---|---|---|
| **Execute Sub-workflow** | `n8n-nodes-base.executeWorkflow` | Llama a otro workflow. Antes se llamaba "Execute Workflow" |
| **Execute Sub-workflow Trigger** | `n8n-nodes-base.executeWorkflowTrigger` | Trigger del sub-workflow (alias: "When Executed by Another Workflow") |
| **Wait** | `n8n-nodes-base.wait` | Pausa ejecución. Soporta: tiempo, webhook, formulario |
| **HTTP Request** | `n8n-nodes-base.httpRequest` | Llamadas HTTP/API |
| **Code** | `n8n-nodes-base.code` | JavaScript o Python (aislado en Task Runner) |
| **If** | `n8n-nodes-base.if` | Condicional binario (true/false) |
| **Switch** | `n8n-nodes-base.switch` | Condicional múltiple (N ramas) |
| **Webhook** | `n8n-nodes-base.webhook` | Recibe HTTP requests externos |
| **Edit Fields (Set)** | `n8n-nodes-base.set` | Transforma/mapea campos JSON |
| **Merge** | `n8n-nodes-base.merge` | Combina datos de múltiples ramas |
| **Postgres** | `n8n-nodes-base.postgres` | Operaciones SQL directas |
| **Google Drive** | `n8n-nodes-base.googleDrive` | Operaciones con archivos en Drive |
| **Gmail** | `n8n-nodes-base.gmail` | Envío/lectura de email |
| **Schedule Trigger** | `n8n-nodes-base.scheduleTrigger` | Cron / trigger periódico |
| **Error Trigger** | `n8n-nodes-base.errorTrigger` | Se activa cuando un workflow falla |
| **AI Agent** | `@n8n/n8n-nodes-langchain.agent` | Nodo LangChain (solo Tools Agent desde v1.82+) |
| **MCP Client** | (disponible desde nov 2025) | Conecta con servidores MCP remotos |

---

## 1. VISIÓN GLOBAL

El sistema es una **oficina digital operativa** implementada como red de workflows en n8n 2.12.x. Cada agente es un sub-workflow independiente con su propio prompt, lógica y permisos. Un workflow orquestador central gobierna el flujo del proyecto a través de fases, invocando agentes según el estado actual y recogiendo aprobaciones humanas antes de cualquier acción externa.

**Principio de diseño:** el proyecto es la unidad central. Todo gira en torno a un `project_id`. Cada agente lee el estado del proyecto de la base de datos, ejecuta su tarea, escribe sus resultados de vuelta, y devuelve el control al orquestador.

**Patrón de ejecución:**

```
[Trigger] → [Orquestador] → [Lee estado (Postgres)] → [Switch por fase] → [Execute Sub-workflow del agente]
     ↑                                                                              ↓
     └──────── [Actualiza estado (Postgres)] ← [Agente escribe resultados en BD] ←──┘
```

El orquestador opera en **ciclos**. Cada ciclo:
1. Lee el estado actual del proyecto desde PostgreSQL
2. Evalúa qué agente(s) necesita ejecutar (Switch node)
3. Ejecuta el sub-workflow del agente correspondiente (Execute Sub-workflow node con "Wait for Sub-Workflow Completion" = ON)
4. Recibe el output del agente (funciona correctamente en 2.x incluso si el agente tiene Wait nodes)
5. Actualiza el estado del proyecto en PostgreSQL
6. Decide si hay siguiente paso, si necesita aprobación humana, o si el ciclo termina

---

## 2. COMPONENTES PRINCIPALES

### 2.1 Capa de Orquestación (n8n 2.12.x)

| Componente | Implementación | Función |
|---|---|---|
| Orquestador | Workflow principal (Published) | Gobierna el flujo, decide agentes, gestiona estados |
| Agentes (x11) | Sub-workflows independientes (Published) | Cada uno con prompt propio, inputs/outputs definidos |
| Aprobaciones | Wait node (modo webhook o formulario) dentro del sub-workflow del agente | Pausa el agente hasta que el humano responde |
| Triggers | Webhook + Schedule Trigger + Manual | Arranque de proyecto, ciclos periódicos, acciones manuales |
| Manejo de errores | Error Trigger workflow dedicado | Captura fallos de cualquier workflow y notifica |

### 2.2 Capa de Datos (Supabase / PostgreSQL)

| Componente | Función |
|---|---|
| Tablas de estado del proyecto | Estado actual, fase, briefing, propuestas, costes, etc. |
| Tablas de trazabilidad | Logs de actividad por agente, timestamps, inputs/outputs |
| Tablas de memoria del estudio | Casos cerrados, patrones, decisiones reutilizables |
| Tablas de aprobaciones | Solicitudes pendientes, respuestas, quién aprobó qué |

**Acceso desde n8n:** mediante el nodo **Postgres** nativo. Supabase expone PostgreSQL estándar, compatible con el nodo Postgres de n8n sin problemas. También se puede usar la API REST de Supabase vía HTTP Request si se prefiere, pero el nodo Postgres es más directo para SQL.

### 2.3 Capa de Almacenamiento de Archivos (Google Drive)

| Componente | Función |
|---|---|
| Carpeta por proyecto | Estructura estandarizada: /planos, /fotos, /docs, /presupuestos |
| Versionado | Nombres con fecha + sufijo de versión |
| Clasificación | El agente documental mantiene la estructura |

**Acceso desde n8n:** nodo **Google Drive** nativo. Requiere credencial OAuth2 configurada en n8n Credentials.

### 2.4 Capa de Razonamiento (LLMs)

| Componente | Implementación en n8n 2.12.x |
|---|---|
| Llamadas a LLM | Nodo **HTTP Request** a la API del LLM |
| Autenticación | Credentials de n8n tipo "Header Auth" (para API key del LLM) |
| Prompts por agente | Almacenados en tabla `agent_prompts` en PostgreSQL |
| Contexto | Inyectado dinámicamente con Code node (parseo/preparación) + HTTP Request (llamada) |
| Parsing de respuesta | Code node (JavaScript) para extraer JSON estructurado de la respuesta del LLM |

**Decisión: HTTP Request vs nodo AI Agent de n8n**

n8n 2.12.x incluye un nodo AI Agent basado en LangChain. Lo descarto como componente principal por estas razones:

1. **El nodo AI Agent está diseñado para agentes conversacionales autónomos** (tipo chatbot que decide qué tools usar). Nuestros agentes no son conversacionales: reciben un input estructurado, razonan, y devuelven un output estructurado.
2. **Menor control del prompt.** El nodo AI Agent gestiona el prompt internamente con el formato de LangChain. Con HTTP Request, controlamos el prompt exacto, la temperatura, el formato de respuesta, y los reintentos.
3. **Los nodos de LangChain en n8n cambian con frecuencia** (el propio nodo AI Agent eliminó los tipos de agente en v1.82, dejando solo "Tools Agent"). HTTP Request es estable.
4. **Debugging más claro.** Con HTTP Request vemos la request y response exactas. Con AI Agent, la lógica está dentro de una caja negra.

**Excepción:** si en el futuro un agente necesita herramientas dinámicas (por ejemplo, el agente de normativa buscando en web), podríamos usar el nodo AI Agent con tools. Pero eso es V2+, no MVP.

**Credenciales del LLM en n8n 2.x:**
```
Tipo de credential: Header Auth
Header Name: x-api-key (Anthropic) o Authorization (OpenAI)
Header Value: sk-ant-... o Bearer sk-...
```
El nodo HTTP Request referencia esta credential. No tocamos env vars (que están bloqueadas en Code nodes por defecto).

### 2.5 Capa de Comunicación Externa (futura, post-MVP)

| Canal | Implementación | Control |
|---|---|---|
| Email | Nodo **Gmail** de n8n | Solo tras aprobación humana |
| WhatsApp | API de WhatsApp Business vía **HTTP Request** | Solo tras aprobación humana |
| Llamadas | No automatizable; el sistema prepara guiones | Siempre manual |

---

## 3. CÓMO SE COMUNICAN LOS AGENTES ENTRE SÍ

Los agentes **nunca se comunican directamente entre sí**. Toda la comunicación pasa por dos canales:

### Canal 1: La base de datos (estado compartido)

Cada agente lee datos del proyecto y escribe sus resultados en tablas específicas. El siguiente agente lee esos resultados cuando le toca.

```
Agente Briefing → escribe en tabla "briefings" (nodo Postgres) →
Agente Distribución lee de "briefings" (nodo Postgres)
```

### Canal 2: El orquestador (control de flujo)

El orquestador decide qué agente ejecutar y le pasa el `project_id` mediante el nodo **Execute Sub-workflow**. El agente ejecuta, devuelve un resultado estructurado (JSON), y el orquestador decide el siguiente paso.

```
Orquestador → [Execute Sub-workflow: "agent_briefing"] con {project_id: "uuid-123"}
              ← recibe {status: "complete", missing_info: [...], briefing_id: "uuid-45"}
Orquestador → [Switch] evalúa resultado → decide siguiente agente
```

### Mecanismo técnico en n8n 2.12.x

**En el workflow padre (orquestador):**
- Nodo **Execute Sub-workflow**: configurado con "Wait for Sub-Workflow Completion" = ON. Esto permite que si el agente contiene un Wait node (para aprobación humana), el orquestador se pause correctamente hasta recibir el resultado final.
- Input: se pasa como JSON al sub-workflow. Mínimo: `{project_id, action, context}`.
- Output: el sub-workflow devuelve JSON con el resultado de la ejecución del agente.

**En cada sub-workflow (agente):**
- Nodo trigger: **Execute Sub-workflow Trigger** (alias "When Executed by Another Workflow"). Recibe los datos del orquestador.
- Input data mode: "Define using fields below" para definir explícitamente qué campos espera el agente (`project_id`, `action`, etc.). Esto da validación y documentación implícita.
- El último nodo del sub-workflow devuelve el JSON de resultado, que n8n pasa automáticamente al workflow padre.

**Importante (n8n 2.x):** los sub-workflows DEBEN estar **Published** para que Execute Sub-workflow los pueda invocar en producción. Si un sub-workflow está solo en Draft, la llamada usará la última versión publicada (o fallará si nunca se publicó).

---

## 4. WORKFLOWS PRINCIPALES

### 4.1 Workflow: ORQUESTADOR PRINCIPAL (`main_orchestrator`)

**Trigger:** Webhook (nuevo proyecto o acción manual) + Schedule Trigger (revisión periódica de proyectos activos)

**Función:** Lee el estado del proyecto, decide qué hacer, ejecuta agentes, gestiona transiciones de fase.

**Nodos principales (secuencia simplificada):**

```
[Webhook / Schedule Trigger]
    ↓
[Postgres: SELECT * FROM projects WHERE id = $project_id]
    ↓
[Switch: por current_phase]
    ├── "intake"         → [Execute Sub-workflow: agent_briefing]
    ├── "briefing_done"  → [Execute Sub-workflow: agent_design]
    ├── "design_done"    → [Execute Sub-workflow: agent_regulatory]
    │                      + [Execute Sub-workflow: agent_materials] (paralelo con Merge)
    ├── "analysis_done"  → [Execute Sub-workflow: agent_costs]
    ├── "costs_done"     → [Execute Sub-workflow: agent_trades]
    ├── "trades_done"    → [Execute Sub-workflow: agent_proposal]
    ├── "proposal_done"  → (espera aceptación del cliente — manual)
    ├── "approved"       → [Execute Sub-workflow: agent_planner]
    └── "completed"      → [Execute Sub-workflow: agent_memory]
    ↓
[Code: evaluar resultado del agente]
    ↓
[Postgres: UPDATE projects SET current_phase = $next_phase]
    ↓
[Postgres: INSERT INTO activity_log (...)]
    ↓
[If: ¿hay siguiente paso inmediato?]
    ├── Sí → Loop back (o trigger del siguiente ciclo)
    └── No → Fin del ciclo
```

**Nota sobre ejecución paralela:** cuando normativa y materiales se ejecutan en paralelo, se usan dos nodos Execute Sub-workflow conectados desde la misma rama del Switch, y luego un nodo **Merge** (modo "Wait for Both") antes de continuar.

### 4.2 Sub-workflows de Agentes

Cada agente es un sub-workflow separado en n8n. Todos siguen la misma estructura interna base:

```
[Execute Sub-workflow Trigger]
    ↓
[Postgres: leer datos relevantes del proyecto]
    ↓
[Code: preparar prompt (inyectar datos del proyecto en el template)]
    ↓
[HTTP Request: llamar al LLM con el prompt preparado]
    ↓
[Code: parsear respuesta del LLM → extraer JSON estructurado]
    ↓
[If: ¿respuesta válida?]
    ├── Sí → [Postgres: escribir resultados en tabla del agente]
    └── No → [HTTP Request: retry al LLM] → (máx 2 reintentos)
    ↓
(Si el agente requiere aprobación →)
[Wait: modo formulario o webhook — pausa hasta que el humano responda]
    ↓
[Code: procesar respuesta de aprobación]
    ↓
[Edit Fields: preparar output final del agente]
    ↓
[Fin → retorna JSON al orquestador]
```

| # | Sub-workflow | Nombre en n8n | Estado mínimo para que funcione |
|---|---|---|---|
| 1 | Orquestador | `main_orchestrator` | Published + Webhook activo |
| 2 | Briefing | `agent_briefing` | Published |
| 3 | Distribución / Anteproyecto | `agent_design` | Published |
| 4 | Normativa / Tramitación | `agent_regulatory` | Published |
| 5 | Documental | `agent_documents` | Published |
| 6 | Materiales / Proveedores | `agent_materials` | Published |
| 7 | Costes | `agent_costs` | Published |
| 8 | Oficios / Presupuestos Ext. | `agent_trades` | Published |
| 9 | Propuesta / Presupuesto | `agent_proposal` | Published |
| 10 | Planificador | `agent_planner` | Published |
| 11 | Memoria del Estudio | `agent_memory` | Published |

### 4.3 Workflows Auxiliares

| Workflow | Función | Trigger | Nodos clave |
|---|---|---|---|
| `util_notification` | Envía notificaciones al arquitecto | Llamado por Execute Sub-workflow | Gmail, Edit Fields |
| `util_llm_call` | Wrapper reutilizable para llamadas al LLM con retry y logging | Llamado por Execute Sub-workflow | HTTP Request, Code, If, Postgres (log) |
| `util_file_organizer` | Mueve archivos a Drive según estructura estándar | Llamado por agent_documents | Google Drive, Code |
| `cron_project_review` | Revisa proyectos activos buscando bloqueos | Schedule Trigger (diario) | Postgres, If, Execute Sub-workflow (notificación) |
| `error_handler` | Captura errores de cualquier workflow | Error Trigger | Postgres (log error), Gmail (alerta) |

**Sobre `util_llm_call`:** este wrapper es clave. Centraliza:
- La llamada HTTP al LLM (con Credentials de n8n para la API key)
- Retry automático (hasta 2 reintentos si falla)
- Logging de cada llamada en `activity_log` (prompt enviado, tokens usados, tiempo de respuesta)
- Parsing básico de la respuesta
- Todos los agentes lo llaman en lugar de tener cada uno su propia lógica de llamada al LLM

---

## 5. DÓNDE SE GUARDA EL ESTADO DEL PROYECTO

### Base de datos: PostgreSQL (Supabase)

El estado del proyecto vive en la base de datos, no en n8n. n8n es stateless por diseño: los workflows se ejecutan y terminan. El estado persistente está en PostgreSQL.

**Acceso:** nodo **Postgres** de n8n, conectado a la instancia PostgreSQL de Supabase con credencial tipo "Postgres" en n8n Credentials.

**Tabla central: `projects`**

```
projects
├── id (UUID, PK)
├── client_id (UUID, FK → clients)
├── name (text)
├── current_phase (text: intake | briefing_done | design_done | analysis_done |
│                        costs_done | trades_done | proposal_done | approved |
│                        planning_done | completed | archived)
├── status (text: active | paused | blocked | completed)
├── budget_target (numeric)
├── location (text)
├── project_type (text: reforma | redistribucion | cambio_uso | adecuacion | otro)
├── created_at (timestamptz)
├── updated_at (timestamptz)
└── metadata (jsonb — datos flexibles sin schema fijo)
```

`current_phase` es el campo que el orquestador lee (con nodo Postgres: `SELECT current_phase FROM projects WHERE id = $1`) para decidir qué agente ejecutar via Switch node.

**Tablas de output por agente** (cada una vinculada a `project_id`):

```
briefings          → briefing generado por el agente
design_options     → opciones de redistribución
regulatory_tasks   → trámites detectados
documents          → expediente documental
material_items     → materiales y precios
cost_estimates     → estimación de costes
trade_requests     → solicitudes a oficios
external_quotes    → presupuestos recibidos
proposals          → propuesta comercial
project_plans      → plan de proyecto
```

---

## 6. DÓNDE SE GUARDA LA MEMORIA DEL ESTUDIO

### 6.1 Tabla `memory_cases` (PostgreSQL)

```
memory_cases
├── id (UUID)
├── project_id (UUID, FK)
├── project_type (text)
├── location_zone (text)
├── summary (text)
├── decisions_made (jsonb)
├── cost_final (numeric)
├── cost_deviation_pct (numeric)
├── duration_days (int)
├── trades_used (jsonb)
├── materials_used (jsonb)
├── lessons_learned (jsonb)
├── patterns (jsonb)
├── tags (text[])
├── embedding (vector — para búsqueda semántica futura con pgvector)
├── created_at (timestamptz)
```

### 6.2 Búsqueda en memoria

**MVP:** búsqueda por tags + tipo de proyecto + zona. Consulta SQL filtrada con nodo Postgres.

**V2:** embeddings vectoriales con pgvector (extensión nativa de Supabase). El agente de memoria genera un embedding del proyecto actual (vía HTTP Request al LLM con modelo de embeddings) y busca los N casos más similares.

### 6.3 Cuándo se escribe / lee

- **Escritura:** agente de memoria, al cierre de cada proyecto completado.
- **Lectura:** agentes de distribución y costes, al inicio de su ejecución, para encontrar proyectos similares como referencia.

---

## 7. DÓNDE Y CÓMO ENTRAN LAS APROBACIONES HUMANAS

### 7.1 Mecanismo técnico en n8n 2.12.x

Gracias al fix de Wait nodes en sub-workflows de n8n 2.0, las aprobaciones pueden vivir **dentro** del sub-workflow de cada agente. Esto simplifica enormemente la arquitectura.

**Flujo de aprobación (dentro del sub-workflow del agente):**

```
[Agente completa su análisis]
    ↓
[Postgres: INSERT INTO approvals (project_id, type, summary, status='pending', webhook_token=uuid)]
    ↓
[Execute Sub-workflow: util_notification — envía email/Slack al arquitecto con:]
    - Resumen de lo que se quiere hacer
    - Enlace APROBAR: {webhook_url}/approve?token={uuid}
    - Enlace RECHAZAR: {webhook_url}/reject?token={uuid}
    ↓
[Wait: modo "On Webhook Call" — pausa hasta recibir respuesta]
    ↓
[Code: validar webhook_token contra tabla approvals]
    ↓
[Postgres: UPDATE approvals SET status='approved'|'rejected', decided_at=now()]
    ↓
[If: ¿aprobado?]
    ├── Sí → continúa la ejecución del agente
    └── No → retorna al orquestador con status "rejected"
```

**¿Por qué funciona ahora?** En n8n 2.x, cuando el sub-workflow del agente entra en Wait, el workflow padre (orquestador) se pausa correctamente. Cuando el humano hace clic en aprobar/rechazar, el webhook reactiva el sub-workflow, que completa su ejecución y devuelve el resultado limpio al orquestador.

### 7.2 Alternativa: Wait con formulario

Para aprobaciones que necesiten más que un simple sí/no (por ejemplo, seleccionar una opción de distribución, añadir notas), el Wait node tiene modo **"On Form Submitted"**. Esto presenta un formulario web al humano directamente, sin necesidad de construir UI.

```
[Wait: modo "On Form Submitted"]
    - Campo: "Decisión" (dropdown: Aprobar / Rechazar / Pedir cambios)
    - Campo: "Notas" (texto libre)
    - Campo: "Opción seleccionada" (dropdown, si aplica)
```

Esto es particularmente útil para el review del briefing y la selección de opción de distribución.

### 7.3 Puntos de aprobación definidos

| Punto | Qué se aprueba | Dónde vive el Wait | Modo del Wait |
|---|---|---|---|
| Briefing finalizado | Ficha de proyecto correcta | `agent_briefing` | Formulario |
| Propuesta de distribución | Opción de redistribución seleccionada | `agent_design` | Formulario |
| Contacto con ayuntamiento | Antes de consultar normativa externamente | `agent_regulatory` | Webhook (sí/no) |
| Solicitud de presupuesto a oficios | Antes de enviar paquetes de consulta | `agent_trades` | Formulario |
| Propuesta comercial | Antes de enviar al cliente | `agent_proposal` | Formulario |
| Cierre de proyecto | Antes de archivar y escribir memoria | `main_orchestrator` | Webhook (sí/no) |

### 7.4 Tabla `approvals`

```
approvals
├── id (UUID, PK)
├── project_id (UUID, FK)
├── approval_type (text: briefing_review | design_review | external_contact |
│                        trade_request | proposal_send | project_close)
├── requested_by (text: nombre del agente/workflow)
├── summary (text)
├── details (jsonb: datos completos para revisión)
├── status (text: pending | approved | rejected)
├── decided_by (text)
├── decided_at (timestamptz)
├── notes (text)
├── webhook_token (UUID, único)
├── created_at (timestamptz)
```

### 7.5 Timeouts de aprobación

Los Wait nodes deben tener **Limit Wait Time** activado para evitar ejecuciones huérfanas:
- Aprobaciones normales: 72 horas de timeout
- Aprobaciones urgentes: 24 horas
- Si expira: el workflow `cron_project_review` detecta approvals pendientes expiradas y envía recordatorio o escala

---

## 8. DIAGRAMA DE FLUJO GENERAL DEL PROYECTO

```
FASE 1: INTAKE
  └─ Se crea el proyecto (Webhook → Postgres INSERT)
  └─ Se sube información inicial (Google Drive)
  └─ Orquestador → Execute Sub-workflow: agent_briefing
  └─ Dentro de agent_briefing:
     └─ Genera briefing (HTTP Request → LLM)
     └─ Wait (formulario) → arquitecto revisa y aprueba
     └─ Si aprobado → retorna {status: "complete", phase: "briefing_done"}
     └─ Si rechazado → itera con correcciones

FASE 2: ANTEPROYECTO
  └─ Orquestador → Execute Sub-workflow: agent_design
  └─ Dentro de agent_design:
     └─ Lee briefing de BD (Postgres)
     └─ Genera opciones de redistribución (HTTP Request → LLM)
     └─ Wait (formulario) → arquitecto selecciona opción
     └─ Si aprobado → retorna {status: "complete", selected_option: X}
  └─ Orquestador → Execute Sub-workflow: agent_documents (organiza archivos)

FASE 3: ANÁLISIS (normativa + materiales, pueden ser paralelos)
  └─ Orquestador → agent_regulatory + agent_materials (paralelo con Merge)
  └─ Ambos escriben resultados en BD
  └─ Si normativa requiere contacto externo → Wait (aprobación dentro del agente)

FASE 4: COSTES
  └─ Orquestador → Execute Sub-workflow: agent_costs
  └─ Lee distribución + materiales + normativa de BD
  └─ Si sobrecoste → alerta en el output

FASE 5: OFICIOS
  └─ Orquestador → Execute Sub-workflow: agent_trades
  └─ Prepara paquetes de consulta
  └─ Wait (formulario) → aprobación antes de enviar solicitudes

FASE 6: PROPUESTA
  └─ Orquestador → Execute Sub-workflow: agent_proposal
  └─ Wait (formulario) → aprobación antes de enviar al cliente

FASE 7: PLANIFICACIÓN (post-aceptación del cliente)
  └─ Orquestador → Execute Sub-workflow: agent_planner

FASE 8: CIERRE Y MEMORIA
  └─ Orquestador → Execute Sub-workflow: agent_memory
```

---

## 9. STACK TECNOLÓGICO CONFIRMADO (n8n 2.12.x)

| Capa | Tecnología | Nodo n8n | Justificación |
|---|---|---|---|
| Orquestación | n8n 2.12.x self-hosted | — | Motor de workflows, sub-workflows, Wait nodes |
| Base de datos | Supabase (PostgreSQL 15+) | Postgres | Estado, trazabilidad, memoria |
| Archivos | Google Drive | Google Drive | Familiar, nodo nativo, compartir fácil |
| LLM | API de Anthropic o OpenAI | HTTP Request + Header Auth credential | Control total del prompt |
| Notificaciones | Email (Gmail) | Gmail | Aprobaciones y alertas |
| Logs | Tabla `activity_log` en PostgreSQL | Postgres | Trazabilidad completa |
| Manejo de errores | Error Trigger workflow | Error Trigger | Captura fallos globales |

**Sobre n8n self-hosted vs cloud:**
- **Self-hosted (recomendado para MVP):** Docker con PostgreSQL como BD de n8n (NO SQLite en producción). Permite instalar community nodes si hace falta, sin restricciones de ejecución.
- **n8n Cloud:** más fácil de arrancar, pero tiene límites de ejecuciones mensuales según plan. Si el sistema crece, el coste sube rápido.
- **Recomendación:** empezar self-hosted con Docker Compose. Supabase vive fuera del servidor de n8n.

**Docker Compose mínimo para n8n 2.12.x:**
```yaml
services:
  n8n:
    image: n8nio/n8n:2.12.1  # Pinear versión exacta
    ports:
      - "5678:5678"
    environment:
      - WEBHOOK_URL=https://tu-dominio.com/  # Obligatorio para webhooks/Wait
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=n8n-db
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=xxx
      - N8N_RUNNERS_ENABLED=true  # Task Runners activos (default en 2.x)
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - n8n-db

  n8n-db:
    image: postgres:15
    environment:
      - POSTGRES_DB=n8n
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=xxx
    volumes:
      - n8n_pg_data:/var/lib/postgresql/data
```

**Nota:** esta BD es para la metadata interna de n8n (workflows, credenciales, ejecuciones). La BD de datos del negocio (proyectos, briefings, etc.) va en Supabase, que es una instancia PostgreSQL separada.

---

## 10. DECISIONES DE DISEÑO Y JUSTIFICACIONES

**¿Por qué sub-workflows y no un solo workflow gigante?**
Porque un workflow de 200 nodos es inmantenible. Cada agente como sub-workflow se puede testear en draft, debuggear con datos reales, y publicar de forma independiente. Además, n8n 2.x con el sistema Draft/Publish está diseñado exactamente para este patrón.

**¿Por qué HTTP Request para LLM y no el nodo AI Agent?**
El nodo AI Agent es un wrapper de LangChain pensado para chatbots con tools dinámicos. Nuestros agentes no son chatbots: reciben input estructurado, aplican un prompt fijo, y devuelven output estructurado. HTTP Request da control total, es estable entre versiones, y es debuggeable.

**¿Por qué las aprobaciones viven dentro de los sub-workflows?**
Porque en n8n 2.x el Wait node dentro de sub-workflows funciona correctamente. Esto permite que cada agente gestione su propia aprobación sin necesidad de workflows auxiliares de aprobación separados. Simplicidad máxima.

**¿Por qué Supabase y no PostgreSQL pelado?**
Supabase da: PostgreSQL managed + API REST automática + Auth + Storage + pgvector + dashboard de administración. Todo gratis en tier inicial. Si en V2 necesitamos una UI mínima para el panel de aprobaciones, la API REST de Supabase nos la da sin código backend extra.

**¿Por qué un solo agente de oficios y no microagentes?**
El proceso es idéntico para todos los oficios: detectar necesidad → preparar paquete → redactar mensaje → aprobación → enviar → recoger → comparar. El contenido cambia, la lógica no. Un agente parametrizado por tipo de oficio es más simple.

**¿Por qué el agente documental es transversal?**
La organización documental ocurre continuamente. El orquestador puede invocar `agent_documents` después de cualquier agente que genere archivos. En el MVP, puede ser simplemente una función de nombrado y movimiento a carpeta de Drive.

---

## 11. PROTOCOLO DE TRABAJO CON DRAFT / PUBLISH

Dado que n8n 2.x separa Draft de Published, establecemos este protocolo:

1. **Desarrollo/cambios:** siempre en Draft. Editar el sub-workflow del agente, cambiar prompt, ajustar lógica.
2. **Testing:** ejecutar manualmente el sub-workflow en modo draft con datos de prueba (usar "Pin data" en el Execute Sub-workflow Trigger para simular input).
3. **Publicación:** cuando el agente funciona correctamente en draft, hacer Publish. Solo entonces se usa en producción.
4. **Rollback:** si algo falla en producción, abrir Version History, seleccionar la versión anterior, y restaurar + publicar.
5. **Regla de oro:** nunca publicar un sub-workflow sin haberlo testeado con al menos 1 proyecto real o simulado.

---

## 12. RIESGOS Y LIMITACIONES DEL MVP

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Prompts mal calibrados | Outputs de baja calidad | Iterar con proyectos reales, logging exhaustivo en `activity_log` |
| Wait nodes con timeout largo | Ejecuciones huérfanas si n8n reinicia | Limit Wait Time en todos los Wait nodes + cron_project_review |
| Coste de LLM | Cada agente hace 1-3 llamadas API | Haiku/GPT-4o-mini para tareas simples, Claude/GPT-4 para razonamiento complejo |
| Code node en Task Runner | Limitaciones de acceso (no HTTP, no env vars, no filesystem) | Toda la lógica de I/O en nodos dedicados, Code solo para transformación de datos |
| Sub-workflows no publicados | Orquestador falla silenciosamente | Checklist de publicación + test automatizado con cron |
| n8n self-hosted: disponibilidad | Si Docker cae, sistema se detiene | Docker restart: always + BD en Supabase (externa) + alertas de health check |
| Concurrent editing | Solo 1 persona puede editar un workflow a la vez | Protocolo de equipo: quién edita qué, cuándo |

---

## 13. RESUMEN EJECUTIVO DE LA ARQUITECTURA

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CAPA DE INTERFAZ                             │
│  (MVP: email + formularios Wait node)  (Futuro: panel web Supabase) │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                  CAPA DE ORQUESTACIÓN (n8n 2.12.x)                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │              main_orchestrator (Published)                    │    │
│  │  [Webhook/Schedule] → [Postgres: lee estado] → [Switch]      │    │
│  │       → [Execute Sub-workflow: agente] → [Postgres: update]  │    │
│  └──────────────────────────┬───────────────────────────────────┘    │
│                             │                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │ agent_   │ │ agent_   │ │ agent_   │ │ agent_   │  ...x11       │
│  │ briefing │ │ design   │ │ regulat. │ │ costs    │  (Published)  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘               │
│       │            │            │            │                       │
│  Cada sub-workflow:                                                  │
│  [Execute Sub-workflow Trigger] → [Postgres: lee datos]             │
│  → [Code: prepara prompt] → [HTTP Request: LLM]                    │
│  → [Code: parsea respuesta] → [Wait: aprobación si necesario]      │
│  → [Postgres: escribe resultado] → [Return al orquestador]         │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  AUXILIARES: util_llm_call, util_notification,                │    │
│  │  util_file_organizer, cron_project_review, error_handler      │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                        CAPA DE DATOS                                │
│                                                                      │
│  ┌─────────────────────┐  ┌──────────────────┐                      │
│  │  Supabase/PostgreSQL │  │  Google Drive     │                     │
│  │  (nodo Postgres)     │  │  (nodo GDrive)    │                     │
│  │  - projects          │  │  - /proyecto_X/   │                     │
│  │  - briefings         │  │    - /planos      │                     │
│  │  - design_options    │  │    - /fotos       │                     │
│  │  - regulatory_tasks  │  │    - /docs        │                     │
│  │  - material_items    │  │    - /presupuestos│                     │
│  │  - cost_estimates    │  │                   │                     │
│  │  - trade_requests    │  └──────────────────┘                      │
│  │  - proposals         │                                            │
│  │  - project_plans     │  ┌──────────────────┐                      │
│  │  - approvals         │  │  LLM API          │                     │
│  │  - activity_log      │  │  (HTTP Request +   │                    │
│  │  - memory_cases      │  │   Header Auth cred) │                   │
│  │  - agent_prompts     │  └──────────────────┘                      │
│  └─────────────────────┘                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

*Documento: BLOQUE 1 — Arquitectura General del Sistema Multiagente*
*Versión n8n: 2.12.x (stable)*
*Siguiente: BLOQUE 2 — Modelo de datos mínimo del MVP*
