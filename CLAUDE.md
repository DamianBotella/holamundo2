# n8n Workflow Builder — Workspace de Claude

## Propósito del proyecto

Este workspace está configurado para construir workflows profesionales en n8n con asistencia de IA. Claude tiene acceso a herramientas especializadas para buscar nodos, consultar documentación, validar workflows y desplegarlos directamente en la instancia n8n del usuario.

### Tipos de workflows que se construyen aquí

- **Agentes de IA**: workflows con AI Agent, LLMs, RAG, herramientas encadenadas, memoria
- **Automatización de datos**: ETL, sincronización entre APIs, transformación y limpieza de datos
- **Notificaciones y alertas**: Slack, email, Telegram, WhatsApp, webhooks, disparadores automáticos
- **Integraciones de negocio**: CRM, ERP, e-commerce, facturación, bases de datos
- **Aplicaciones con IA generativa**: interfaces interactivas con arquitectura multi-agente n8n en el backend

---

## Herramientas disponibles

### n8n-MCP Server

Servidor MCP conectado a la instancia n8n. Expone 20 herramientas divididas en dos grupos:

**Búsqueda y documentación (no requieren credenciales n8n):**
| Herramienta | Uso |
|---|---|
| `tools_documentation` | Documentación del propio servidor MCP |
| `search_nodes` | Búsqueda full-text de nodos con filtros |
| `get_node` | Detalles completos de un nodo (propiedades, versiones, docs) |
| `validate_node` | Validar configuración de un nodo individual |
| `validate_workflow` | Validar workflow completo incluyendo agentes de IA |
| `search_templates` | Buscar workflows de plantilla en el catálogo |
| `get_template` | Obtener el JSON completo de una plantilla |

**Gestión de workflows vía API n8n (requieren `N8N_API_URL` + `N8N_API_KEY`):**

Incluyen herramientas para listar, crear, actualizar, activar/desactivar y eliminar workflows; gestionar credenciales; ejecutar workflows; y consultar el estado de la instancia.

### n8n-Skills activos

Siete skills especializados que guían la construcción correcta de workflows:

| Skill | Cuándo se activa |
|---|---|
| **MCP Tools Expert** | Siempre — guía el uso correcto de las herramientas MCP |
| **Workflow Patterns** | Al diseñar la arquitectura de un workflow |
| **Expression Syntax** | Al escribir expresiones `{{ }}` |
| **Node Configuration** | Al configurar nodos con operaciones complejas |
| **Validation Expert** | Al interpretar errores de validación |
| **Code JavaScript** | Al usar nodos Code con JS |
| **Code Python** | Al usar nodos Code con Python |

**Mapa de skills por tarea:**

| Tarea | Skill | Archivo principal |
|-------|-------|-------------------|
| Buscar nodos, usar MCP | n8n-mcp-tools-expert | `SKILL.md`, `WORKFLOW_GUIDE.md` |
| Arquitectura de workflow | n8n-workflow-patterns | `SKILL.md`, `ai_agent_workflow.md` |
| Configurar nodo | n8n-node-configuration | `SKILL.md` |
| Escribir expresiones | n8n-expression-syntax | `SKILL.md`, `COMMON_MISTAKES.md` |
| Código JavaScript | n8n-code-javascript | `SKILL.md`, `ERROR_PATTERNS.md` |
| Código Python | n8n-code-python | `SKILL.md` |
| Errores de validación | n8n-validation-expert | `SKILL.md`, `ERROR_CATALOG.md` |

---

## Configuración e instalación

### Paso 1 — n8n-MCP Server

Hay tres métodos de instalación. El método NPX es el recomendado.

#### Método 1 — NPX (recomendado, sin instalación permanente)

Crea el archivo `.mcp.json` en la raíz del proyecto con tus credenciales reales:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["-y", "n8n-mcp"],
      "env": {
        "MCP_API_KEY": "<tu API key de dashboard.n8n-mcp.com>",
        "N8N_API_URL": "<URL de tu instancia n8n, ej: https://mi-n8n.ejemplo.com>",
        "N8N_API_KEY": "<API key de tu instancia n8n>"
      }
    }
  }
}
```

NPX descarga y ejecuta `n8n-mcp` automáticamente. Requiere Node.js ≥ 18 instalado.

**Fix Windows** — si NPX no responde, usar el path completo:
```json
"command": "C:\\Program Files\\nodejs\\npx.cmd"
```

#### Método 2 — Instalación local con npm

```bash
npm install -g n8n-mcp
```

Luego en `.mcp.json` reemplazar `"command": "npx"` y `"args": ["-y", "n8n-mcp"]` por:
```json
"command": "n8n-mcp"
```
Útil en entornos sin acceso a internet en tiempo de ejecución.

#### Método 3 — Docker

```bash
docker run --rm \
  -e MCP_API_KEY=tu-key \
  -e N8N_API_URL=https://tu-instancia.n8n.cloud \
  -e N8N_API_KEY=tu-n8n-key \
  czlonkowski/n8n-mcp
```

En `.mcp.json` usar `"command": "docker"` con args correspondientes.

#### Verificación post-instalación

Después de editar `.mcp.json` y reiniciar Claude Code:

```javascript
// 1. Verificar servidor MCP (no requiere credenciales n8n)
tools_documentation()
// → Debe retornar la documentación del servidor

// 2. Verificar búsqueda de nodos
search_nodes({ query: "slack", limit: 3 })
// → Debe retornar nodos de Slack

// 3. Verificar conexión a la instancia n8n
n8n_health_check()
// → Debe retornar { status: "ok" }
// Si falla el paso 3 pero 1 y 2 funcionan → problema con N8N_API_URL o N8N_API_KEY
```

### Paso 2 — n8n-Skills

Ejecuta este comando en Claude Code:

```
/plugin install czlonkowski/n8n-skills
```

**Verificar que los 7 skills se activaron:**

Después de instalar, inicia una nueva conversación. Deberías ver estos skills disponibles:
- `n8n-mcp-tools-expert`
- `n8n-workflow-patterns`
- `n8n-expression-syntax`
- `n8n-node-configuration`
- `n8n-validation-expert`
- `n8n-code-javascript`
- `n8n-code-python`

Los skills se activan automáticamente según la tarea detectada. No es necesario invocarlos manualmente.

**Si los skills no aparecen:**
1. Reiniciar Claude Code completamente (no solo recargar)
2. Ejecutar `/plugin list` para verificar que el plugin está instalado
3. Si no aparece: `/plugin uninstall czlonkowski/n8n-skills` y volver a instalar
4. Verificar conexión a internet durante la instalación

---

## Credenciales necesarias

Antes de ejecutar o desplegar workflows, asegúrate de tener configuradas estas tres credenciales en `.mcp.json`:

| Variable | Dónde obtenerla |
|---|---|
| `MCP_API_KEY` | Regístrate en dashboard.n8n-mcp.com — 100 llamadas gratis/día |
| `N8N_API_URL` | La URL base de tu instancia n8n (sin barra final) |
| `N8N_API_KEY` | En tu instancia n8n: **Settings > n8n API > Create an API key** |

---

## Flujo de trabajo (OBLIGATORIO)

**ANTES de cualquier trabajo con n8n:** leer el skill relevante en `n8n-skills/skills/` y seguir este flujo completo:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CONSULTAR SKILL                                              │
│    Leer n8n-skills/skills/[skill]/SKILL.md según la tarea      │
├─────────────────────────────────────────────────────────────────┤
│ 2. DISEÑAR                                                      │
│    - Clarificar objetivo, triggers, fuentes de datos y output   │
│    - Identificar patrón (webhook/API/DB/AI Agent/schedule)      │
│    - search_nodes() para encontrar nodos                        │
│    - get_node() para ver configuración requerida                │
│    - search_templates() para reutilizar workflows similares     │
├─────────────────────────────────────────────────────────────────┤
│ 3. IMPLEMENTAR                                                  │
│    - n8n_create_workflow o n8n_update_partial_workflow          │
│    - Usar smart parameters (branch="true", case=0)              │
│    - Incluir intent en cada operación                           │
│    - NUNCA inventar propiedades — siempre consultar el MCP      │
├─────────────────────────────────────────────────────────────────┤
│ 4. VERIFICAR (después de CADA cambio)                           │
│    - n8n_get_workflow({id, mode: "structure"})                  │
│    - Confirmar que los campos cambiaron                         │
│    - Si no cambió → reportar y corregir                         │
├─────────────────────────────────────────────────────────────────┤
│ 5. VALIDAR                                                      │
│    - n8n_validate_workflow({id, options: {profile: "runtime"}}) │
│    - Ciclo: validar → leer error → corregir → validar           │
│    - Normal: 2-3 iteraciones                                    │
├─────────────────────────────────────────────────────────────────┤
│ 6. ACTIVAR                                                      │
│    - operations: [{type: "activateWorkflow"}]                   │
│    - Monitorear primeras ejecuciones                            │
└─────────────────────────────────────────────────────────────────┘
```

### 5 patrones de workflow

| Patrón | Estructura | Cuándo usar |
|--------|-----------|-------------|
| **Webhook Processing** (35%) | Webhook → Validar → Transformar → Acción → Responder | Recibir datos externos: forms, pagos, chat |
| **HTTP API Integration** (45%) | Trigger → HTTP Request → Transform → Store/Notify | Sincronizar con APIs externas |
| **Database Operations** | Schedule → Query → Transform → Write → Verify | ETL, sincronización de datos |
| **AI Agent Workflow** | Trigger → AI Agent ← Model + Memory + Tools → Output | Chatbots, asistentes con acceso a datos |
| **Scheduled Tasks** (28%) | Schedule → Fetch → Process → Deliver → Log | Reportes, tareas recurrentes |

---

## Ejemplos de workflows

### Ejemplo 1 — Webhook Processing + Slack Notification

**Objetivo**: Recibir datos de un formulario externo, validarlos y notificar a Slack.

```
[Webhook] → [IF: validar campos requeridos]
               ├─ true  → [Set: transformar datos] → [Slack: enviar notif] → [Respond: 200 OK]
               └─ false → [Respond: 400 + mensaje de error]
```

Nodos clave:
- `n8n-nodes-base.webhook` — recibe POST, datos en `$json.body.*`
- `n8n-nodes-base.if` — condición: `{{ $json.body.email !== undefined }}`
- `n8n-nodes-base.set` — construir payload limpio
- `n8n-nodes-base.slack` (typeVersion 2.2) — resource: `message`, operation: `post`
- `n8n-nodes-base.respondToWebhook` — statusCode 200 o 400

Reglas críticas:
- Todos los datos del webhook viven en `$json.body.*`
- `respondToWebhook` debe estar en TODAS las ramas (éxito y error)

---

### Ejemplo 2 — Scheduled Data Sync

**Objetivo**: Sincronizar datos de una API externa a Google Sheets cada hora.

```
[Schedule Trigger: cada 1h]
    → [HTTP Request: GET /api/data]
    → [Code: transformar + añadir timestamp]
    → [Google Sheets: appendOrUpdate]
    → [Slack: log resultado]
```

Nodos clave:
- `n8n-nodes-base.scheduleTrigger` — `rule: { interval: [{ field: "hours", hoursInterval: 1 }] }`
- `n8n-nodes-base.httpRequest` — typeVersion: **4.2**, método GET
- `n8n-nodes-base.code` — `return items.map(i => ({ json: { ...i.json, synced_at: new Date().toISOString() } }))`
- `n8n-nodes-base.googleSheets` — operation: `appendOrUpdate`, campo `range: "Hoja!A:Z"` obligatorio
- `n8n-nodes-base.slack` — `{{ $json.updatedRows }} filas actualizadas`

Reglas críticas:
- HTTP Request typeVersion **4.2** (nunca 4.4)
- Google Sheets `appendOrUpdate` requiere campo `range`
- Code node retorna `[{ json: {...} }]` por ítem

---

### Ejemplo 3 — AI Agent Workflow

**Objetivo**: Chatbot que consulta Google Calendar y responde citas disponibles.

```
[Chat Trigger]
    → [AI Agent]
         ├── [OpenAI Chat Model: gpt-4o]    → sourceOutput: "ai_languageModel"
         ├── [Window Buffer Memory]          → sourceOutput: "ai_memory"
         └── [Google Calendar Tool]          → sourceOutput: "ai_tool"
```

Nodos clave:
- `@n8n/n8n-nodes-langchain.chatTrigger` — activa el agente vía chat
- `@n8n/n8n-nodes-langchain.agent` — tipo: `conversationalAgent`
- `@n8n/n8n-nodes-langchain.lmChatOpenAi` — model: `gpt-4o`, typeVersion: 1.2
- `@n8n/n8n-nodes-langchain.memoryBufferWindow` — windowSize: 10
- `n8n-nodes-base.googleCalendarTool` — typeVersion: 1.3, `$fromAI()` en timeMin/timeMax

Conexiones AI requeridas:
```javascript
{ source: "OpenAI Chat Model",   target: "AI Agent", sourceOutput: "ai_languageModel" }
{ source: "Window Buffer Memory", target: "AI Agent", sourceOutput: "ai_memory" }
{ source: "Google Calendar Tool", target: "AI Agent", sourceOutput: "ai_tool" }
```

Reglas críticas:
- `toolDescription` en cada tool es OBLIGATORIO
- `windowSize` ≤ 20 para no saturar el contexto
- Nunca usar `sourceOutput: "main"` para conexiones AI

---

## Reglas técnicas críticas

### 1. nodeType: DOS FORMATOS distintos

```javascript
// Para search_nodes, get_node, validate_node:
"nodes-base.slack"
"nodes-langchain.agent"

// Para n8n_create_workflow, n8n_update_partial_workflow:
"n8n-nodes-base.slack"
"@n8n/n8n-nodes-langchain.agent"
```

### 2. Webhook: datos siempre en `.body`

```javascript
// ❌ NUNCA funciona
{{ $json.email }}

// ✅ SIEMPRE así
{{ $json.body.email }}
```

### 3. Code Node: formato de retorno obligatorio

```javascript
// ✅ CORRECTO
return [{ json: { field: "value" } }];

// ❌ INCORRECTO — falta el array
return { json: { field: "value" } };
```

### 4. Expresiones mixtas: empezar con `=`

```javascript
// ❌ INCORRECTO — se interpreta como texto literal
"Hola {{ $json.name }}"

// ✅ CORRECTO
"=Hola {{ $json.body.name }}"
```

### 5. Conexiones AI: 8 tipos de sourceOutput

```javascript
"ai_languageModel"  // Model → Agent
"ai_tool"           // Tool → Agent
"ai_memory"         // Memory → Agent
"ai_outputParser"   // Parser → Agent
"ai_embedding"      // Embeddings → Vector Store
"ai_vectorStore"    // Vector Store → Agent/Retrieval
"ai_document"       // Document Loader → Vector Store
"ai_textSplitter"   // Text Splitter → Document Loader
```

### 6. HTTP Request: typeVersion 4.2 (NUNCA 4.4)

```javascript
// ⚠️ CRÍTICO: typeVersion 4.4 corrompe el nodo
// El nodo aparece como "Install this node to use it"

// ❌ NUNCA usar
{ type: "n8n-nodes-base.httpRequest", typeVersion: 4.4 }

// ✅ SIEMPRE usar
{ type: "n8n-nodes-base.httpRequest", typeVersion: 4.2 }
```

### 7. Google Sheets Update: requiere campo `range`

```javascript
// ❌ INCORRECTO — falta range
{ operation: "update", documentId: {...}, sheetName: {...}, columns: {...} }

// ✅ CORRECTO
{
  operation: "update",
  documentId: {...},
  sheetName: {...},
  columns: {...},
  range: "NombreHoja!A:Z"  // ⚠️ REQUERIDO para update
}
```

---

## Nodos especiales

Configuraciones de nodos no cubiertos por los skills estándar:

### Evolution API (WhatsApp)

```javascript
{
  type: "n8n-nodes-evolution-api.evolutionApi",
  typeVersion: 1,
  parameters: {
    resource: "messages-api",
    instanceName: "={{ $json.instanceName }}",
    remoteJid: "={{ $json.phone }}@s.whatsapp.net",
    messageText: "={{ $json.text }}",  // ⚠️ REQUERIDO
    options_message: {}
  }
}
```

### `$fromAI()` para herramientas de AI Agent

```javascript
// Sintaxis: $fromAI('nombre', 'descripcion', 'tipo')

// En Calendar Tool:
timeMin: "={{ $fromAI('After', 'Fecha ISO', 'string') }}"

// En Sheets Tool:
lookupValue: "={{ $fromAI('telefono', 'Teléfono a buscar', 'string') }}"

// Con manipulación de fecha:
start: "={{ DateTime.fromISO($fromAI('Start', '', 'string')).plus({hours: 1}).toISO() }}"
```

### Google Sheets Tool (para AI Agent)

```javascript
{
  type: "n8n-nodes-base.googleSheetsTool",
  typeVersion: 4.5,
  parameters: {
    descriptionType: "manual",
    toolDescription: "Busca pacientes por teléfono",  // ⚠️ REQUERIDO
    documentId: { __rl: true, value: "SHEET_ID", mode: "id" },
    sheetName: { __rl: true, value: "Pacientes", mode: "name" },
    filtersUI: {
      values: [{
        lookupColumn: "Telefono",
        lookupValue: "={{ $fromAI('telefono', 'Teléfono', 'string') }}"
      }]
    }
  }
}
```

### Google Calendar Tool (para AI Agent)

```javascript
{
  type: "n8n-nodes-base.googleCalendarTool",
  typeVersion: 1.3,
  parameters: {
    toolDescription: "Ver/crear citas",  // ⚠️ REQUERIDO
    operation: "getAll",  // o "create", "delete"
    calendar: { __rl: true, value: "email@gmail.com", mode: "list" },
    timeMin: "={{ $fromAI('After', '', 'string') }}",
    timeMax: "={{ $fromAI('Before', '', 'string') }}"
  }
}
```

### Guardrails LangChain

```javascript
{
  type: "@n8n/n8n-nodes-langchain.guardrails",
  typeVersion: 2,
  parameters: {
    operation: "sanitize",
    text: "={{ $json.output }}",
    guardrails: {
      pii: { value: { type: "all" } },
      secretKeys: { value: { permissiveness: "balanced" } }
    }
  }
}
// ⚠️ Tiene 2 outputs: [0] = sanitizado, [1] = rechazado
```

---

## Herramientas MCP — uso eficiente

### Búsqueda y detalles de nodos

```javascript
// 1. Buscar
search_nodes({ query: "slack", limit: 10 })

// 2. Ver detalles (standard cubre el 95% de casos)
get_node({ nodeType: "nodes-base.slack" })

// 3. Solo si necesitas propiedades específicas:
get_node({ nodeType: "nodes-base.slack", mode: "search_properties", propertyQuery: "auth" })
```

### Validación

```javascript
// Nodo individual
validate_node({
  nodeType: "nodes-base.slack",
  config: { ... },
  profile: "runtime"  // SIEMPRE especificar
})

// Workflow completo
n8n_validate_workflow({
  id: "workflow-id",
  options: { profile: "runtime" }
})
```

### Actualización con smart parameters

```javascript
n8n_update_partial_workflow({
  id: "workflow-id",
  intent: "Conectar IF a handlers",  // SIEMPRE incluir
  operations: [
    {
      type: "addConnection",
      source: "IF",
      target: "Éxito Handler",
      branch: "true"   // En lugar de sourceIndex: 0
    },
    {
      type: "addConnection",
      source: "IF",
      target: "Error Handler",
      branch: "false"  // En lugar de sourceIndex: 1
    }
  ]
})
```

### Conexiones AI con sourceOutput correcto

```javascript
// ✅ CORRECTO
{ type: "addConnection", source: "OpenAI Chat Model", target: "AI Agent", sourceOutput: "ai_languageModel" }
{ type: "addConnection", source: "Mi Herramienta",    target: "AI Agent", sourceOutput: "ai_tool" }
{ type: "addConnection", source: "Window Buffer",     target: "AI Agent", sourceOutput: "ai_memory" }

// ❌ INCORRECTO — "main" no funciona para nodos AI
{ type: "addConnection", source: "OpenAI Chat Model", target: "AI Agent", sourceOutput: "main" }
```

---

## Verificación post-cambio (OBLIGATORIO)

Después de cada `n8n_update_partial_workflow`, verificar que el cambio se aplicó:

```javascript
// 1. Aplicar cambio
n8n_update_partial_workflow({
  id: "xyz",
  intent: "Añadir messageText al nodo de envío",
  operations: [{
    type: "updateNode",
    nodeName: "Enviar texto",
    updates: { parameters: { messageText: "={{ $json.text }}" } }
  }]
})

// 2. VERIFICAR inmediatamente
const wf = n8n_get_workflow({ id: "xyz", mode: "structure" })
const node = wf.nodes.find(n => n.name === "Enviar texto")

// 3. Confirmar o corregir
// ✅ node.parameters.messageText existe → cambio aplicado
// ❌ no existe → investigar y corregir antes de continuar
```

---

## Checklist pre-activación

```
□ Consulté el skill relevante en n8n-skills/
□ Usé el patrón correcto (webhook/API/DB/AI Agent/schedule)
□ Todos los nodos tienen typeVersion definido
□ HTTP Request usa typeVersion 4.2 (NO 4.4)
□ Google Sheets update tiene campo range
□ Expresiones de webhook usan .body
□ Code nodes retornan [{json: {...}}]
□ Expresiones mixtas empiezan con =
□ AI Tools tienen toolDescription
□ Conexiones AI usan sourceOutput correcto (no "main")
□ Verifiqué CADA cambio con n8n_get_workflow
□ n8n_validate_workflow sin errores (profile: "runtime")
□ Credenciales configuradas en la UI de n8n
```

---

## Estándares de calidad

Todo workflow construido en este proyecto debe cumplir:

- **Manejo de errores**: incluir nodo Error Trigger o bloque Try/Catch en flujos críticos
- **Nombres descriptivos**: nombrar cada nodo en español con su función real (ej: "Obtener pedidos de Shopify", no "HTTP Request 1")
- **Expresiones correctas**: usar la sintaxis `{{ $json.campo }}`, `{{ $node["Nodo"].json }}` verificada con el skill Expression Syntax
- **Agentes de IA**: configurar siempre memory node, system prompt claro y tool calling explícito
- **Credenciales**: nunca hardcodear valores sensibles — usar el sistema de credenciales de n8n
- **Validación previa**: ejecutar `validate_workflow` antes de cualquier despliegue

---

## Errores frecuentes y solución rápida

| Error | Causa | Solución |
|-------|-------|----------|
| "Node not found" | Formato nodeType incorrecto | Usar `nodes-base.X` para search/validate |
| "Cannot read property" | Datos no en `.body` | `{{ $json.body.field }}` |
| "Code returns nothing" | Falta return o formato incorrecto | `return [{ json: {...} }]` |
| "Expression as text" | Falta `=` al inicio | `"=Texto {{ expr }}"` |
| Evolution no envía | Falta `messageText` | Añadir `messageText: "={{ $json.text }}"` |
| Tool con `?` en el agente | Falta `toolDescription` | Añadir `toolDescription: "..."` |
| Conexión AI falla | Usando `"main"` | Usar `ai_tool`, `ai_languageModel`, etc. |
| "Install this node to use it" | HTTP Request con typeVersion 4.4 | Recrear nodo con `typeVersion: 4.2` |
| "Range is required" | Google Sheets update sin range | Añadir `range: "Hoja!A:Z"` |

### Debugging avanzado

**Inspeccionar datos con nodo Set temporal:**

```javascript
// Insertar un nodo Set para ver qué datos llegan
{
  type: "n8n-nodes-base.set",
  name: "DEBUG — Ver datos",
  parameters: {
    assignments: {
      assignments: [
        { name: "debug_json",  value: "={{ JSON.stringify($json) }}" },
        { name: "debug_keys",  value: "={{ Object.keys($json).join(', ') }}" }
      ]
    }
  }
}
// Ver el output en el panel de ejecución — eliminar antes de activar
```

**Leer errores de ejecución:**
- En la UI: clic en nodo rojo → pestaña "Output" → ver `error.message`
- Desde Claude: `n8n_executions({ workflowId: "...", limit: 1 })` → campo `data.resultData.error`

**Debugging de conexiones AI:**
```javascript
// Si el AI Agent no llama a una herramienta:
// 1. Verificar que toolDescription es descriptivo y específico
// 2. Verificar sourceOutput correcto en las conexiones:
n8n_get_workflow({ id: "...", mode: "structure" })
// → Buscar en connections["NombreTool"]["ai_tool"]
```

**Árbol de decisión para errores desconocidos:**
```
Error detectado
    │
    ├─ ¿Error de expresión?   → Revisar sintaxis {{ }}, añadir = al inicio
    │                            Verificar que el nodo anterior tiene output
    ├─ ¿Error de nodo?        → validate_node({ profile: "runtime" })
    │                            Comparar con get_node() para campos requeridos
    ├─ ¿Error conexión AI?    → Verificar sourceOutput (ai_tool, ai_languageModel, etc.)
    │                            Verificar que el nodo AI tiene credencial asignada
    ├─ ¿Error de API externa? → Revisar rate limits (tabla Rendimiento)
    │                            Verificar credenciales con n8n_manage_credentials
    └─ ¿Error desconocido?    → n8n_autofix_workflow({ id: "..." })
                                 Luego validar con profile: "runtime"
```

---

## Seguridad

### Nunca hardcodear credenciales

```javascript
// ❌ NUNCA en parámetros de un nodo
{ "apiKey": "sk-abc123real..." }

// ✅ SIEMPRE usar el sistema de credenciales de n8n
// Las credenciales se configuran en la UI y los nodos las referencian por nombre
```

### Variables de entorno vs credenciales n8n

| Tipo | Dónde usar | Cómo acceder |
|---|---|---|
| **Credenciales n8n** | Tokens API, passwords, OAuth | UI de n8n → nodos las usan automáticamente |
| **Variables de entorno** | Config del servidor n8n | `{{ $env.VARIABLE }}` en expresiones |
| **`.mcp.json`** | Solo credenciales Claude ↔ n8n-mcp | Nunca commitear — está en `.gitignore` |

### Principio de mínimo privilegio en AI Tools

- Usar operaciones de solo lectura cuando el agente no necesita escribir
- `toolDescription` claro y restrictivo para que el agente no abuse de la herramienta
- Especificar el calendario/hoja exactos, no recursos genéricos (`primary`, `Sheet1`)

### Auditoría de seguridad

```javascript
n8n_audit_instance()
// Revisa automáticamente:
// - Workflows activos sin credenciales configuradas
// - Webhooks sin autenticación
// - Credenciales sin usar (candidatas a eliminar)
// - Nodos con expresiones que exponen datos sensibles
```

**Recordatorio**: `.mcp.json` contiene `MCP_API_KEY`, `N8N_API_URL` y `N8N_API_KEY` en texto plano. Está en `.gitignore` — nunca lo commitees ni compartas.

---

## Rendimiento y límites

### Timeouts recomendados por operación

| Tipo de operación | Timeout recomendado | Notas |
|---|---|---|
| HTTP Request simple | 10–30s | APIs REST estándar |
| OpenAI / LLM call | 60–120s | Aumentar para prompts largos |
| Google Sheets (lectura) | 30s | Más si hay muchas filas |
| Google Sheets (escritura bulk) | 60s | Depende del volumen |
| Evolution API (WhatsApp) | 15s | Falla rápido = reintento más útil |
| Webhook response | < 5s | n8n cierra la conexión a los 30s |
| AI Agent completo | 120–300s | Depende del número de tool calls |

### Rate limits de APIs comunes

| API | Límite | Estrategia |
|---|---|---|
| OpenAI GPT-4o | 500 RPM / 30K TPM (tier 1) | Añadir nodo `Wait` entre batches |
| OpenAI Embeddings | 3000 RPM | Procesar en lotes de 100 |
| Slack Web API | 1 msg/seg por canal | `Wait` 1100ms entre mensajes |
| Google Sheets API | 300 req/min por proyecto | Batch writes, no row-by-row |
| Google Calendar API | 1M queries/día | Sin restricciones prácticas |

### Batch vs item-by-item

```
Usar BATCH cuando:                   Usar ITEM-BY-ITEM cuando:
- > 50 ítems del mismo tipo          - Lógica condicional por ítem
- Writes masivos a Google Sheets     - Cada ítem requiere verificación
- Llamadas a embeddings              - Errores deben manejarse individualmente
- Transformaciones simples           - AI Agent por ítem (no escala en batch)
```

### Memoria de AI Agent — límites recomendados

| Tipo de memoria | Configuración recomendada | Razón |
|---|---|---|
| Window Buffer Memory | `windowSize: 10` | Más de 20 satura el contexto |
| Simple Memory (session) | Sin límite | Se limpia entre sesiones |
| Postgres/Redis Memory | `maxTokens: 4000` | Controlar costos de tokens |

---

## Comandos rápidos

| Lo que dices | Lo que hace Claude |
|---|---|
| "Construye un workflow que..." | Proceso completo: clarificar → buscar nodos → construir → validar → desplegar |
| "Busca el nodo para..." | `search_nodes` con el término indicado |
| "Valida este workflow" | `validate_workflow` con el JSON proporcionado |
| "Despliega en n8n" | Crea o actualiza el workflow en la instancia vía API |
| "Busca una plantilla de..." | `search_templates` con criterios relevantes |
| "¿Qué hace el nodo X?" | `get_node` para obtener documentación completa |
| "Audita la instancia" | `n8n_audit_instance` — revisa seguridad y configuración |
| "Lista mis workflows" | `n8n_list_workflows` — muestra todos con estado activo/inactivo |
| "Versiones del workflow X" | `n8n_workflow_versions({ id })` — historial de cambios |

### Comandos MCP por categoría

**Búsqueda:**
```javascript
search_nodes({ query: "slack", limit: 10 })                                   // Buscar nodo
get_node({ nodeType: "nodes-base.slack" })                                    // Detalles completos
get_node({ nodeType: "nodes-base.slack", mode: "search_properties", propertyQuery: "auth" })
search_templates({ query: "webhook slack", limit: 5 })                        // Buscar plantillas
get_template({ id: 123 })                                                     // JSON de plantilla
```

**Validación y debugging:**
```javascript
validate_node({ nodeType: "nodes-base.slack", config: {...}, profile: "runtime" })
n8n_validate_workflow({ id: "...", options: { profile: "runtime" } })
n8n_get_workflow({ id: "...", mode: "structure" })   // Ver estructura actual
n8n_executions({ workflowId: "...", limit: 5 })      // Ver últimas ejecuciones
n8n_autofix_workflow({ id: "..." })                  // Intentar corrección automática
```

**Gestión de workflows:**
```javascript
n8n_list_workflows()
n8n_create_workflow({ name: "...", nodes: [], connections: {} })
n8n_update_partial_workflow({ id: "...", intent: "...", operations: [] })
n8n_update_full_workflow({ id: "...", workflow: {...} })
n8n_delete_workflow({ id: "..." })
n8n_workflow_versions({ id: "..." })                 // Historial de versiones
```

**Credenciales y auditoría:**
```javascript
n8n_manage_credentials({ operation: "list" })
n8n_manage_credentials({ operation: "create", type: "slackApi", data: {...} })
n8n_audit_instance()                                 // Auditoría de seguridad completa
n8n_health_check()                                   // Estado de la instancia
```
