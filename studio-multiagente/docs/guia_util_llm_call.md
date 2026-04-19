# BLOQUE 6 — Primer Workflow a Construir: `util_llm_call`

## Guía paso a paso para n8n 2.12.x

---

## POR QUÉ ESTE WORKFLOW PRIMERO

No es el más vistoso, pero es el más crítico. `util_llm_call` es el wrapper centralizado que todos los agentes usan para hablar con el LLM. Si esto no funciona, nada funciona.

Construirlo primero te da:
1. **Confirmación de que el stack funciona**: n8n → HTTP → LLM API → respuesta → PostgreSQL
2. **Un componente reutilizable**: todos los agentes lo llamarán tal cual
3. **Logging desde el día 1**: cada llamada al LLM queda registrada con tokens y coste
4. **Retry automático**: si el LLM falla, reintenta sin intervención
5. **Algo testeable en 30 minutos**: no necesitas el resto del sistema para probarlo

---

## PRERREQUISITOS

Antes de empezar, necesitas tener listo:

| Prerrequisito | Cómo verificar |
|---|---|
| n8n 2.12.x funcionando con HTTPS | Accedes a `https://tu-dominio.com` y ves el editor |
| Supabase con tablas creadas | En Supabase Dashboard: `SELECT COUNT(*) FROM activity_log` devuelve 0 |
| API key de Anthropic (o OpenAI) | Tienes una key tipo `sk-ant-api03-...` (Anthropic) o `sk-...` (OpenAI) |
| Credencial de Postgres en n8n | En n8n: Settings → Credentials → hay una credencial "Postgres" apuntando a Supabase |

---

## PASO 0: CREAR CREDENCIAL DEL LLM EN N8N

Antes de construir el workflow, crea la credencial para autenticarte con la API del LLM.

### Para Anthropic (Claude):

1. En n8n: ve a **Settings → Credentials → Add Credential**
2. Busca **"Header Auth"**
3. Configura:
   - **Name**: `Anthropic API Key`
   - **Header Name**: `x-api-key`
   - **Header Value**: `sk-ant-api03-TU_KEY_AQUÍ`
4. Guarda.

### Para OpenAI (GPT-4):

1. Igual, busca **"Header Auth"**
2. Configura:
   - **Name**: `OpenAI API Key`
   - **Header Name**: `Authorization`
   - **Header Value**: `Bearer sk-TU_KEY_AQUÍ`
3. Guarda.

**Este documento asume Anthropic (Claude). Si usas OpenAI, indicaré las diferencias donde aplique.**

---

## PASO 1: CREAR EL WORKFLOW

1. En n8n, haz clic en **"+ Add Workflow"** (o Ctrl+N / Cmd+N).
2. Haz clic en el nombre del workflow (arriba a la izquierda, dice "My workflow") y renómbralo a: **`util_llm_call`**
3. Ahora tienes un canvas vacío. Vamos a añadir nodos.

---

## PASO 2: NODO 1 — Execute Sub-workflow Trigger

Este nodo es el punto de entrada. Recibe datos cuando otro workflow llama a este como sub-workflow.

### Cómo añadirlo
1. Haz clic en el **"+"** del canvas (o pulsa Tab).
2. Busca: **"Execute Sub-workflow Trigger"** (también aparece como "When Executed by Another Workflow").
3. Haz clic para añadirlo.

### Configuración

- **Name del nodo**: `Receive LLM Request`
- **Input Data Mode**: selecciona **"Define using fields below"**
- Añade estos campos (clic en "Add Field" para cada uno):

| Field Name | Type | Required |
|---|---|---|
| `prompt_system` | String | ✅ |
| `prompt_user` | String | ✅ |
| `model` | String | ❌ |
| `temperature` | Number | ❌ |
| `project_id` | String | ❌ |
| `agent_name` | String | ❌ |

Así queda definida la "interfaz" del sub-workflow: cualquier workflow que lo llame deberá proporcionar al menos `prompt_system` y `prompt_user`.

---

## PASO 3: NODO 2 — Edit Fields (Set Defaults)

Este nodo aplica valores por defecto a los campos opcionales que no vengan rellenos.

### Cómo añadirlo
1. Desde el nodo anterior, arrastra la conexión (el punto gris de la derecha) y suéltalo en el canvas.
2. Busca: **"Edit Fields"** (también llamado "Set").
3. Haz clic para añadirlo.

### Configuración

- **Name del nodo**: `Set Defaults`
- **Mode**: "Manual Mapping"
- **Fields to Set** (haz clic en "Add Field" para cada uno):

| Field Name | Value (Expression) |
|---|---|
| `model` | `{{ $json.model \|\| 'claude-sonnet-4-20250514' }}` |
| `temperature` | `{{ $json.temperature ?? 0.3 }}` |
| `project_id` | `{{ $json.project_id \|\| 'no_project' }}` |
| `agent_name` | `{{ $json.agent_name \|\| 'unknown_agent' }}` |
| `prompt_system` | `{{ $json.prompt_system }}` |
| `prompt_user` | `{{ $json.prompt_user }}` |
| `request_timestamp` | `{{ new Date().toISOString() }}` |

**Para escribir expresiones**: haz clic en el campo "Value", luego haz clic en el icono de `{ }` (Expression) a la derecha del campo. Esto abre el editor de expresiones donde pegas el código.

**Importante**: marca la opción **"Include Other Input Fields"** como OFF (desactivada). Solo queremos los campos que definimos explícitamente.

---

## PASO 4: NODO 3 — HTTP Request (Call LLM)

Este es el nodo central: la llamada a la API del LLM.

### Cómo añadirlo
1. Desde "Set Defaults", arrastra la conexión.
2. Busca: **"HTTP Request"**
3. Añádelo.

### Configuración para Anthropic (Claude)

- **Name del nodo**: `Call LLM API`
- **Method**: POST
- **URL**: `https://api.anthropic.com/v1/messages`

**Authentication:**
- **Authentication**: selecciona **"Predefined Credential Type"**
- **Credential Type**: selecciona **"Header Auth"**
- **Header Auth**: selecciona la credencial **"Anthropic API Key"** que creaste en el Paso 0

**Headers** (haz clic en "Add Header"):

| Header Name | Header Value |
|---|---|
| `content-type` | `application/json` |
| `anthropic-version` | `2023-06-01` |

**Body:**
- **Body Content Type**: JSON
- **Specify Body**: selecciona **"Using JSON"**
- **JSON**: pega esto (haz clic en `{ }` para modo Expression):

```json
{
  "model": "{{ $json.model }}",
  "max_tokens": 4096,
  "temperature": {{ $json.temperature }},
  "system": {{ JSON.stringify($json.prompt_system) }},
  "messages": [
    {
      "role": "user",
      "content": {{ JSON.stringify($json.prompt_user) }}
    }
  ]
}
```

**¿Por qué `JSON.stringify()`?** Porque los prompts pueden contener comillas, saltos de línea y caracteres especiales que romperían el JSON si se inyectan tal cual. `JSON.stringify()` los escapa correctamente.

**Settings del nodo** (haz clic en "Settings" en la parte inferior del panel del nodo):

| Setting | Value |
|---|---|
| **Retry On Fail** | ✅ ON |
| **Max Tries** | `3` |
| **Wait Between Tries (ms)** | `5000` |
| **Timeout (ms)** | `120000` |
| **On Error** | selecciona **"Continue Using Error Output"** |

**Explicación de "Continue Using Error Output"**: en vez de que el workflow se detenga si el LLM falla (después de los 3 reintentos), el nodo envía los datos por una segunda salida (la salida de error). Esto nos permite manejar el error nosotros en los siguientes nodos. En el canvas verás que este nodo tiene DOS salidas: la principal (éxito) y la de error (roja).

### Configuración alternativa para OpenAI (GPT-4)

Si usas OpenAI en vez de Anthropic, los cambios son:

- **URL**: `https://api.openai.com/v1/chat/completions`
- **Credential**: la de OpenAI (Header Auth con `Authorization: Bearer sk-...`)
- **Headers**: solo `content-type: application/json` (no necesita `anthropic-version`)
- **JSON del body**:

```json
{
  "model": "{{ $json.model }}",
  "max_tokens": 4096,
  "temperature": {{ $json.temperature }},
  "messages": [
    {
      "role": "system",
      "content": {{ JSON.stringify($json.prompt_system) }}
    },
    {
      "role": "user",
      "content": {{ JSON.stringify($json.prompt_user) }}
    }
  ]
}
```

---

## PASO 5: NODO 4 — Code (Extract Response)

Este nodo procesa la respuesta exitosa del LLM: extrae el texto, los tokens, y calcula el coste estimado.

### Cómo añadirlo
1. Desde la **salida principal** (la de arriba / éxito) de "Call LLM API", arrastra la conexión.
2. Busca: **"Code"**
3. Añádelo.

### Configuración

- **Name del nodo**: `Extract Response`
- **Language**: JavaScript
- **Mode**: "Run Once for All Items"
- **Code**:

```javascript
const input = $input.first().json;

// Detectar proveedor por la estructura de la respuesta
let text, tokensIn, tokensOut, model;

if (input.content && Array.isArray(input.content)) {
  // Respuesta de Anthropic
  text = input.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');
  tokensIn = input.usage?.input_tokens || 0;
  tokensOut = input.usage?.output_tokens || 0;
  model = input.model || 'unknown';
} else if (input.choices && Array.isArray(input.choices)) {
  // Respuesta de OpenAI
  text = input.choices[0]?.message?.content || '';
  tokensIn = input.usage?.prompt_tokens || 0;
  tokensOut = input.usage?.completion_tokens || 0;
  model = input.model || 'unknown';
} else {
  // Respuesta no reconocida
  return [{
    json: {
      status: 'error',
      error_message: 'Respuesta del LLM no reconocida',
      raw_response: JSON.stringify(input).substring(0, 500)
    }
  }];
}

// Calcular coste estimado (precios aproximados por 1K tokens, marzo 2026)
const costRates = {
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
};

const rates = costRates[model] || { input: 0.003, output: 0.015 };
const costEstimated = ((tokensIn / 1000) * rates.input) + ((tokensOut / 1000) * rates.output);

// Calcular duración
const startTime = new Date($input.first().json.request_timestamp || new Date());
const durationMs = Date.now() - startTime.getTime();

return [{
  json: {
    status: 'success',
    text: text,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    model: model,
    cost_estimated: Math.round(costEstimated * 10000) / 10000,
    duration_ms: durationMs,
    // Pasar los campos originales para el logging
    project_id: $('Set Defaults').first().json.project_id,
    agent_name: $('Set Defaults').first().json.agent_name
  }
}];
```

**Nota sobre `$('Set Defaults').first().json`**: en n8n 2.x, puedes acceder a los datos de salida de cualquier nodo anterior por su nombre. Esto nos permite recuperar `project_id` y `agent_name` que se pierden en la respuesta del LLM.

---

## PASO 6: NODO 5 — Code (Handle Error)

Este nodo procesa la salida de error del nodo HTTP Request (cuando el LLM falla después de los 3 reintentos).

### Cómo añadirlo
1. Desde la **salida de error** (la de abajo / roja) de "Call LLM API", arrastra la conexión.
2. Busca: **"Code"**
3. Añádelo.

### Configuración

- **Name del nodo**: `Handle LLM Error`
- **Language**: JavaScript
- **Mode**: "Run Once for All Items"
- **Code**:

```javascript
const input = $input.first().json;

// Extraer info del error
const errorMessage = input.message 
  || input.error?.message 
  || input.statusMessage 
  || 'Error desconocido en llamada al LLM';

const statusCode = input.statusCode || input.error?.statusCode || 0;

return [{
  json: {
    status: 'error',
    error_message: `LLM API Error (${statusCode}): ${errorMessage}`,
    status_code: statusCode,
    tokens_in: 0,
    tokens_out: 0,
    model: $('Set Defaults').first().json.model,
    cost_estimated: 0,
    duration_ms: 0,
    project_id: $('Set Defaults').first().json.project_id,
    agent_name: $('Set Defaults').first().json.agent_name
  }
}];
```

---

## PASO 7: NODO 6 — Merge (Unir éxito y error)

Necesitamos que tanto el camino de éxito como el de error converjan en un punto para hacer el logging.

### Cómo añadirlo
1. Busca: **"Merge"**
2. Añádelo al canvas.
3. Conecta la salida de **"Extract Response"** a la **Input 1** del Merge.
4. Conecta la salida de **"Handle LLM Error"** a la **Input 2** del Merge.

### Configuración

- **Name del nodo**: `Merge Success or Error`
- **Mode**: selecciona **"Append"**
- **Options → Include Unpaired Items**: ✅ ON (importante: solo uno de los dos caminos tendrá datos en cada ejecución)

---

## PASO 8: NODO 7 — Postgres (Log LLM Call)

Registra cada llamada al LLM en `activity_log`, sea éxito o error.

### Cómo añadirlo
1. Desde el nodo Merge, arrastra la conexión.
2. Busca: **"Postgres"**
3. Añádelo.

### Configuración

- **Name del nodo**: `Log LLM Call`
- **Credential**: selecciona tu credencial de Postgres (la de Supabase)
- **Operation**: **"Execute Query"**
- **Query** (haz clic en `{ }` para modo Expression):

```sql
INSERT INTO activity_log (
  project_id,
  agent_name,
  action,
  llm_model,
  llm_tokens_in,
  llm_tokens_out,
  llm_cost_estimated,
  duration_ms,
  status,
  error_message,
  output_summary
)
VALUES (
  {{ $json.project_id === 'no_project' ? 'NULL' : "'" + $json.project_id + "'" }},
  '{{ $json.agent_name }}',
  'llm_call',
  '{{ $json.model }}',
  {{ $json.tokens_in }},
  {{ $json.tokens_out }},
  {{ $json.cost_estimated }},
  {{ $json.duration_ms }},
  '{{ $json.status }}',
  {{ $json.status === 'error' ? "'" + $json.error_message.replace(/'/g, "''") + "'" : 'NULL' }},
  {{ $json.status === 'success' ? "'" + $json.text.substring(0, 200).replace(/'/g, "''") + "...'" : 'NULL' }}
)
```

**Alternativa más segura con parámetros (recomendada):**

Si prefieres usar Query Parameters (más seguro contra SQL injection), cambia a:

- **Query**:
```sql
INSERT INTO activity_log (
  project_id, agent_name, action, llm_model, 
  llm_tokens_in, llm_tokens_out, llm_cost_estimated, 
  duration_ms, status, error_message, output_summary
)
VALUES (
  $1::uuid, $2, 'llm_call', $3, 
  $4::int, $5::int, $6::numeric, 
  $7::int, $8, $9, $10
)
```

- **Query Parameters** (haz clic en "Add Parameter" para cada uno):

| # | Value (Expression) |
|---|---|
| 1 | `{{ $json.project_id === 'no_project' ? null : $json.project_id }}` |
| 2 | `{{ $json.agent_name }}` |
| 3 | `{{ $json.model }}` |
| 4 | `{{ $json.tokens_in }}` |
| 5 | `{{ $json.tokens_out }}` |
| 6 | `{{ $json.cost_estimated }}` |
| 7 | `{{ $json.duration_ms }}` |
| 8 | `{{ $json.status }}` |
| 9 | `{{ $json.status === 'error' ? $json.error_message : null }}` |
| 10 | `{{ $json.status === 'success' ? $json.text.substring(0, 200) : null }}` |

**Usa la versión con parámetros.** Es más segura y no tiene problemas con comillas en el texto.

---

## PASO 9: NODO 8 — Edit Fields (Return Result)

Nodo final que prepara el output limpio que recibirá el workflow padre (el agente que llamó a util_llm_call).

### Cómo añadirlo
1. Desde "Log LLM Call", arrastra la conexión.
2. Busca: **"Edit Fields"**
3. Añádelo.

### Configuración

- **Name del nodo**: `Return Result`
- **Mode**: "Manual Mapping"
- **Include Other Input Fields**: OFF
- **Fields**:

| Field Name | Value (Expression) |
|---|---|
| `status` | `{{ $('Merge Success or Error').first().json.status }}` |
| `text` | `{{ $('Merge Success or Error').first().json.text \|\| '' }}` |
| `tokens_in` | `{{ $('Merge Success or Error').first().json.tokens_in }}` |
| `tokens_out` | `{{ $('Merge Success or Error').first().json.tokens_out }}` |
| `model` | `{{ $('Merge Success or Error').first().json.model }}` |
| `cost_estimated` | `{{ $('Merge Success or Error').first().json.cost_estimated }}` |
| `error_message` | `{{ $('Merge Success or Error').first().json.error_message \|\| '' }}` |

Este es el output que recibe el agente que llama a `util_llm_call`. El agente comprobará `status === 'success'` y usará `text` para parsear el JSON.

---

## DIAGRAMA FINAL DEL WORKFLOW

```
[Execute Sub-workflow Trigger: "Receive LLM Request"]
    │
    ↓
[Edit Fields: "Set Defaults"]
    │
    ↓
[HTTP Request: "Call LLM API"]
    │                    │
    ↓ (éxito)            ↓ (error)
[Code:                [Code:
 "Extract Response"]   "Handle LLM Error"]
    │                    │
    ↓                    ↓
[Merge: "Merge Success or Error"]
    │
    ↓
[Postgres: "Log LLM Call"]
    │
    ↓
[Edit Fields: "Return Result"]
```

**Total: 8 nodos. Tiempo de construcción: 1-2 horas.**

---

## PASO 10: TESTEAR ANTES DE PUBLICAR

### Test 1: Ejecución manual con datos de prueba

1. Haz clic en el nodo **"Receive LLM Request"**.
2. En el panel lateral, haz clic en **"Pin Data"** (icono de chincheta).
3. Pega este JSON de prueba:

```json
[
  {
    "json": {
      "prompt_system": "Eres un asistente útil. Responde en JSON con el formato: {\"respuesta\": \"texto\"}",
      "prompt_user": "Dime en una frase qué es una reforma integral de vivienda",
      "model": "claude-sonnet-4-20250514",
      "temperature": 0.2,
      "project_id": "test-001",
      "agent_name": "test_manual"
    }
  }
]
```

4. Haz clic en **"Test Workflow"** (botón de play en la esquina superior derecha, o Ctrl+Enter).
5. Observa la ejecución nodo por nodo.

### Qué verificar

| Nodo | Qué debe pasar | Señal de error |
|---|---|---|
| Receive LLM Request | Muestra los datos pineados | — |
| Set Defaults | Muestra todos los campos, incluidos los defaults | Campos vacíos |
| Call LLM API | Status 200, muestra la respuesta del LLM | Status 4xx/5xx |
| Extract Response | Muestra `status: "success"`, `text` con contenido, `tokens_in` > 0 | `status: "error"` |
| Merge | Muestra los mismos datos | Vacío |
| Log LLM Call | Muestra confirmación de inserción | Error SQL |
| Return Result | Output limpio con status, text, tokens | Campos vacíos |

### Test 2: Verificar el log en Supabase

1. Ve a Supabase Dashboard → Table Editor → `activity_log`.
2. Debería haber un registro nuevo con:
   - `agent_name`: "test_manual"
   - `action`: "llm_call"
   - `status`: "success"
   - `llm_tokens_in`: > 0
   - `llm_tokens_out`: > 0
   - `llm_cost_estimated`: > 0

### Test 3: Probar el manejo de errores

1. En el nodo "Set Defaults", cambia temporalmente el model a `"modelo-que-no-existe"`.
2. Ejecuta de nuevo.
3. Verifica que:
   - "Call LLM API" reintenta 3 veces (tarda ~15 segundos por los waits).
   - "Handle LLM Error" se ejecuta (rama de error).
   - "Log LLM Call" registra con `status: "error"`.
   - "Return Result" devuelve `status: "error"` con `error_message`.
4. **Revierte el model** al original después del test.

### Test 4: Probar con prompt real de un agente

```json
[
  {
    "json": {
      "prompt_system": "Eres el Agente de Briefing de un estudio de arquitectura técnica especializado en reformas de vivienda. Tu función es convertir la información inicial de un proyecto en un briefing estructurado. Responde EXCLUSIVAMENTE con un objeto JSON válido.",
      "prompt_user": "Genera el briefing para este proyecto:\n\nNombre: Reforma piso Calle Mallorca 245\nTipo: reforma_integral\nCiudad: Barcelona\nSuperficie: 85 m²\nPresupuesto: 60000€ (flexible)\n\nNotas del cliente: Quiere abrir la cocina al salón, crear un segundo baño aprovechando parte del pasillo, y modernizar toda la vivienda. Estilo nórdico con madera clara. Quiere entrar a vivir antes de septiembre.",
      "model": "claude-sonnet-4-20250514",
      "temperature": 0.2,
      "project_id": "test-002",
      "agent_name": "agent_briefing"
    }
  }
]
```

Verifica que la respuesta es un JSON parseable con campos como `summary`, `client_needs`, `objectives`, etc.

---

## PASO 11: PUBLICAR

Cuando los 4 tests pasen:

1. Haz clic en el botón **"Publish"** (arriba a la derecha) o pulsa **Shift+P**.
2. En el modal que aparece:
   - **Version name**: `v1.0 — Initial release`
   - **Description**: `Wrapper centralizado para llamadas al LLM. Soporta Anthropic y OpenAI. Retry automático, logging en activity_log.`
3. Haz clic en **"Publish"**.

El workflow está ahora en producción. Cualquier otro workflow que lo llame via Execute Sub-workflow usará esta versión publicada.

---

## PASO 12: CÓMO LO LLAMARÁN LOS AGENTES

Cuando construyas `agent_briefing` (siguiente workflow), así es como llamará a `util_llm_call`:

1. Añade un nodo **"Execute Sub-workflow"** en el workflow del agente.
2. **Workflow**: selecciona `util_llm_call`.
3. **Wait for Sub-Workflow Completion**: ✅ ON.
4. Los campos de input aparecerán automáticamente (porque los definimos en el trigger). Rellena:

| Campo | Valor (Expression) |
|---|---|
| `prompt_system` | `{{ $('Load Agent Prompt').first().json.content }}` |
| `prompt_user` | `{{ $('Prepare LLM Payload').first().json.prompt_user }}` |
| `model` | `{{ $('Load Agent Prompt').first().json.model_recommended }}` |
| `temperature` | `{{ $('Load Agent Prompt').first().json.temperature }}` |
| `project_id` | `{{ $('Receive Input').first().json.project_id }}` |
| `agent_name` | `agent_briefing` |

5. El output del nodo Execute Sub-workflow será exactamente lo que `Return Result` devuelve: `{status, text, tokens_in, tokens_out, model, cost_estimated, error_message}`.

---

## QUÉ CONSTRUIR DESPUÉS

Con `util_llm_call` publicado y funcionando, el orden de los siguientes workflows es:

```
1. ✅ util_llm_call          ← ACABAS DE CONSTRUIR ESTO
2. → util_notification       ← Siguiente (envío de emails)
3. → error_handler           ← Captura errores globales
4. → util_file_organizer     ← Estructura de Drive
5. → init_new_project        ← Punto de entrada al sistema
6. → agent_briefing          ← Primer agente real
7. → main_orchestrator (v1)  ← Orquestador mínimo (solo intake → briefing)
```

Cada uno tarda entre 1-4 horas. Cuando llegues a `agent_briefing`, ya tendrás toda la infraestructura auxiliar lista y podrás testear el primer ciclo completo del sistema.

---

*Documento: BLOQUE 6 — Primer Workflow: util_llm_call*
*Tiempo de construcción: 1-2 horas*
*Tiempo de test: 30 minutos*
*Resultado: wrapper de LLM funcional, con retry, logging y listo para producción*
