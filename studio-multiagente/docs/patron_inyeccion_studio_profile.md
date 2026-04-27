# Patrón — Inyección de `studio_profile` en los agentes núcleo

**Estado**: PATRÓN DOCUMENTADO — implementación refactor pendiente.
**Fecha**: 2026-04-27 (bloque 22).

---

## Por qué esto existe

Tras el bloque 20-21 el sistema tiene:
- **Tabla `studio_profile`** con 8 secciones jsonb (identity, tone, priorities, red_lines, visit_checklist, materials_pref, trades_pref, jurisdiction).
- **Función SQL `get_active_studio_profile()`** que devuelve la fila activa.
- **`agent_onboarding`** + **`agent_onboarding_extract`** que pueblan ese perfil hablando con el profesional.
- **Una fila baseline activa** (setup_source='baseline') hasta que un profesional real complete el onboarding.

**Falta**: que los 11 agentes núcleo del pipeline (briefing/design/regulatory/materials/costs/trades/proposal/planner/memory/safety_plan/accessibility) **lean ese perfil dinámicamente** y lo inyecten en sus prompts. Hoy los prompts son hardcodeados/genéricos. Después del refactor, hablan en el tono y con las prioridades del estudio que compró el software.

---

## Por qué NO se ha refactorizado todavía

Decisión consciente: hasta que un profesional real complete el onboarding, **el único perfil disponible es el baseline genérico**. Inyectar el baseline produce un output muy parecido al que ya generan los prompts hardcodeados actuales (por diseño — el baseline es el genérico). El refactor "a ciegas" sin poder validar contra un perfil real distinto sería trabajo sin feedback.

**Plan**: dejar el patrón documentado + cableado preparado en `agent_briefing` (Load Studio Profile añadido pero no inyectado). Cuando un arquitecto real haga onboarding, en una sesión dedicada activamos la inyección y comparamos outputs **antes vs después** del refactor sobre un proyecto real.

---

## El patrón (a aplicar en cada uno de los 11 agentes)

### Paso 1 — Añadir nodo "Load Studio Profile" (Postgres)

Posición: justo después de `Load Agent Prompt` (o equivalente — el último Postgres antes del `Build Prompt` Code).

Configuración:

```json
{
  "id": "<agent>-load-profile",
  "name": "Load Studio Profile",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "position": [<x+125>, <y+150>],
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT * FROM get_active_studio_profile();",
    "options": {"alwaysOutputData": true}
  },
  "credentials": {
    "postgres": {"id": "cfxNZdzy0NB3xkYC", "name": "Postgres account"}
  }
}
```

**Reconectar**: `Load Agent Prompt` → `Load Studio Profile` → siguiente nodo (que típicamente es el `Build Prompt` o un nodo intermedio como `Search Similar Cases`).

### Paso 2 — Modificar `Build Prompt` Code para inyectar el perfil

Al **inicio** del jsCode, añadir:

```javascript
// === STUDIO PROFILE INJECTION ===
const studio = $('Load Studio Profile').first().json || {};
function _safe(v) {
  if (v == null) return null;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch(e) { return v; } }
  return v;
}
const _id = _safe(studio.identity) || {};
const _tone = _safe(studio.tone) || {};
const _priorities = _safe(studio.priorities) || [];
const _redLines = _safe(studio.red_lines) || [];
const _checklist = _safe(studio.visit_checklist) || [];
const _matPref = _safe(studio.materials_pref) || {};
const _tradesPref = _safe(studio.trades_pref) || {};
const _jur = _safe(studio.jurisdiction) || {};

function _buildStudioContextBlock() {
  const tone = _tone.clientes || {};
  const lines = [
    `Trabajas para "${_id.nombre_estudio || 'estudio'}" en ${_id.ciudad || 'España'}, especializado en ${(_id.ambito || []).join(', ') || 'arquitectura técnica'}. Eres asistente del/la profesional principal: ${_id.persona_principal || 'arquitecto técnico'}.`,
    '',
    'TONO Y FORMA DE COMUNICACIÓN ESPERADA:',
    `- Con clientes: ${tone.formalidad || 'cercano'}, ${tone.tecnicidad || 'llano'}, ${tone.longitud || 'conciso'}.`,
    tone.tutea ? '- Tutea por defecto.' : '- Usa "usted" por defecto.',
    tone.explica_terminos ? '- Cuando uses un término técnico, explícalo entre paréntesis.' : '',
    '',
    'PRIORIDADES DEL ESTUDIO (orden estricto):',
    ...(_priorities || []).map(p => `${p.orden || '?'}. ${p.prioridad || ''}${p.detalle ? ' — ' + p.detalle : ''}`),
    '',
    'LÍNEAS ROJAS (cosas que el estudio NUNCA hace):',
    ...(_redLines || []).map(l => `- ${l.texto || ''}`),
    '',
    `JURISDICCIÓN: ${_jur.ccaa || 'España'}. Aplica normativa estatal (CTE, LOE, RD 1627/1997, REBT, RITE) + autonómica de ${_jur.ccaa || 'la zona'}.`,
    ''
  ].filter(Boolean).join('\\n');
  return lines;
}
const _STUDIO_CONTEXT = _buildStudioContextBlock();
// === END STUDIO PROFILE INJECTION ===
```

Y en la línea donde se construye el `systemPrompt`, **prepender** `_STUDIO_CONTEXT`:

```javascript
// Antes:
const systemPrompt = (promptData && promptData.content)
  ? promptData.content
  : 'Eres el Agente de ...';

// Después:
const _baseSystemPrompt = (promptData && promptData.content)
  ? promptData.content
  : 'Eres el Agente de ...';
const systemPrompt = _STUDIO_CONTEXT + '\\n\\n' + _baseSystemPrompt;
```

### Paso 3 — Inyecciones específicas por agente

Algunos agentes deben usar más secciones del perfil que las generales:

| Agente | Usa adicionalmente |
|---|---|
| `agent_briefing` | `visit_checklist` (para alimentar `briefing.open_questions` automáticamente) |
| `agent_design` | `priorities` (orden estricto al evaluar opciones) |
| `agent_materials` | `materials_pref.gama_default` + `materials_pref.marcas_preferidas_por_categoria` |
| `agent_trades` | `trades_pref.criterios_seleccion` + `trades_pref.trade_to_contact` |
| `agent_proposal` | `red_lines` (preflight check) + `tone` (forma del documento al cliente) |
| `agent_regulatory` | `jurisdiction` (CCAA + ayuntamientos para filtrar tareas) |
| `agent_safety_plan` | `priorities` (ítem 1 suele ser seguridad estructural) |

Cada agente añade en su `Build Prompt` un bloque adicional dedicado a su sección específica, después del `_STUDIO_CONTEXT` general.

---

## Coste de añadir esto

| Agente | Esfuerzo (1) Load profile + (2) inyección base + (3) inyección específica |
|---|---|
| agent_briefing | 25-30 min (incluye lógica para fusionar visit_checklist con `briefing.open_questions`) |
| agent_design | 15-20 min |
| agent_regulatory | 20 min (filtro normativa autonómica) |
| agent_materials | 30 min (catálogo + gama + marcas preferidas) |
| agent_costs | 15 min (genérico) |
| agent_trades | 25 min (mapa trade→contact) |
| agent_proposal | 25 min (red_lines preflight + tone) |
| agent_planner | 15 min (genérico) |
| agent_memory | 10 min (genérico) |
| agent_safety_plan | 15 min (priorities) |
| agent_accessibility | 10 min (genérico) |
| **TOTAL** | **~3.5h** |

Más ~30 min de testing E2E sobre un proyecto real con el perfil ya creado por onboarding.

---

## Estado actual del cableado preparado

**`agent_briefing` (`uq3GQWSdmoIV4ZdR`)**: tiene el nodo `Load Studio Profile` añadido como dry-run (cargado pero no inyectado al systemPrompt todavía). El flujo es:

```
Load Project + Client
  → Load Existing Briefing
  → Load Agent Prompt
  → Load Studio Profile     ← NUEVO (dry-run)
  → Build Search Query
  → Search Similar Cases
  → Prepare LLM Payload     ← NO inyecta studio (todavía)
```

Esto significa que el sistema vivo HOY sigue funcionando exactamente igual que antes. La inyección efectiva al `systemPrompt` se activa modificando ~5 líneas del `Prepare LLM Payload` (paso 2 de este patrón) cuando llegue el momento.

Los otros 10 agentes núcleo NO tienen el cableado preparado todavía — se hace cuando se vaya a aplicar el refactor real.

---

## Cuándo activar el refactor

**Trigger ideal**: Damián consigue el primer arquitecto real beta-tester, este completa el onboarding chat (genera una fila `studio_profile` con `setup_source='onboarding_chat'` que desplaza el baseline). En la siguiente sesión:

1. Verificar que `get_active_studio_profile()` devuelve el perfil real (no el baseline).
2. Lanzar un E2E completo sobre un proyecto stub **antes** del refactor → guardar outputs.
3. Aplicar el patrón de este doc a los 11 agentes (~3.5h).
4. Lanzar el mismo E2E **después** del refactor → comparar outputs.
5. Si la diferencia es coherente con el perfil del arquitecto (tono, prioridades, líneas rojas reflejadas) → merge a producción. Si no, iterar el patrón antes de aplicarlo a más agentes.

Mientras tanto, el sistema funciona con prompts genéricos profesionales que ya pasaron E2E satisfactoriamente.

---

## Por qué este enfoque es responsable

Refactorizar 11 agentes "a ciegas" sin un perfil real distinto del baseline contra el que validar es trabajo sin feedback. Si rompe algo, el primer indicio sería un cliente real recibiendo outputs malos. Mejor:

1. Documentar el patrón (este doc) ✅
2. Dejar cableado preparado en `agent_briefing` ✅
3. Activar el refactor cuando el primer perfil real exista ⏳

Esto es lo opuesto al anti-patrón de "lo hago todo de golpe porque el lunes presento". Reduce el riesgo de regresión y permite hacer el refactor en una sesión enfocada con E2E reproducible.
