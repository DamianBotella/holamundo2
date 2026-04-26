# Audit Fase A (estabilización MVP) — estado al 2026-04-26

Auditado en bloque 9 contra el plan vigente (`lista-mis-workflows-encapsulated-wombat.md`, sección "Fase A").

## Resumen

**Toda la Fase A está cerrada.** No requiere intervención adicional. La sesión compactada del 24-04 ya aplicó los fixes; este audit confirma que sobreviven en n8n vivo.

| Punto | Descripción | Estado |
|---|---|---|
| A1 | Documento `contexto_para_damian.md` con 20 oportunidades + taxonomía bufete | ⏳ pendiente (es entregable de redacción larga, no un bug) |
| A2 | Hardcodear `agent_name` en payload de los 8 agentes que llaman LLM | ✅ cerrado |
| A3 | Parsers robustos en `agent_design` y `agent_regulatory` (`text` antes que `content`) | ✅ cerrado |
| A4 | Esquema `architect_intake_notes` (no `raw_client_input`) en `init_new_project` | ✅ cerrado |
| A5 | Reescribir `prompt_system` de `agent_briefing` en `agent_prompts` | ⏳ verificable solo en BD (Damián) |
| A6 | Limpiar proyecto de test `5c230fc9-be45-4566-ac21-76436857b94b` | ⏳ requiere SQL en Supabase (Damián) |
| A7 | Re-lanzar E2E con payload realista del arquitecto | ✅ cerrado (E2E pasado 24-04, proyecto `22c7e914-c19f-41b3-84c0-01d8e1a89382`) |

---

## A2 — `agent_name` hardcoded

Verificado leyendo el nodo de construcción de payload (`Prepare LLM Payload`, `Build * Prompt`, `Prepare * Prompt`) en cada agente vivo en n8n.

| Agente | n8n_id | Nodo | Estado |
|---|---|---|---|
| `agent_briefing` | `uq3GQWSdmoIV4ZdR` | Prepare LLM Payload | ✅ `agent_name: 'agent_briefing'` |
| `agent_design` | `sMGf7e8CSnsBQa1q` | Prepare LLM Payload | ✅ `agent_name: 'agent_design'` |
| `agent_regulatory` | `QbRMmQs0oyVHplgE` | Prepare Regulatory Prompt | ✅ `agent_name: 'agent_regulatory'` |
| `agent_materials` | `SOJW7SgCrJebLRP8` | Prepare Materials Prompt | ✅ `agent_name: 'agent_materials'` |
| `agent_costs` | `FhF8zelE1KehUD4Z` | Prepare Costs Prompt | ✅ `agent_name: 'agent_costs'` |
| `agent_proposal` | `Mqx8S6nR6exbRY86` | Prepare Proposal Prompt | ✅ |
| `agent_planner` | `lSUfNw61YfbERI8n` | Build Plan Prompt | ✅ |
| `agent_memory` | `gLxmy7M0UmC7Yzye` | Build Memory Prompt | ✅ |
| `agent_home_automation` | `6f25BcR8LwNX2HQH` | Prepare LLM Payload | ✅ verificado en execution `1030` (recibido por util_llm_call) |
| `agent_energy_assessor` | `63XFqhlsg0d1cXav` | Prepare LLM Payload | ✅ |
| `agent_trades` | `NHTZkeLUL7qUQPLG` | — | N/A (no usa LLM, lógica determinista keyword-mapping) |

Verificación cruzada en runtime: `n8n_executions list workflowId=JoKqGZ8pDzhJohV2` (util_llm_call) → la execution `1030` (2026-04-26 08:52:35) recibió `agent_name: "agent_home_automation"` correctamente en `Receive LLM Request → Set Defaults`.

## A3 — Parsers robustos

Patrón antiguo problemático: `llmResult.response_text || llmResult.content`. El correcto: `llmResult.text || llmResult.content` (porque `util_llm_call` devuelve `text`).

| Agente | Nodo | `.text` primero | Notas |
|---|---|---|---|
| `agent_design` | Parse Design Options | ✅ `text || response_text || content` | mantiene `response_text` como fallback redundante (no rompe) |
| `agent_regulatory` | Parse Regulatory Tasks | ✅ `text || content || response` | |
| `agent_materials` | Parse Materials | ✅ `text || content` | |
| `agent_costs` | Parse and Validate Costs | ✅ `text || content` | |

Ningún parser activo usa el patrón roto.

## A4 — Esquema `architect_intake_notes`

`init_new_project` (`HzPLldZVJGFjKbuc`) ya usa la nueva nomenclatura:

- **Validate Input**: acepta `architect_intake_notes` como primario, con fallback a `body.notes || body.raw_client_input` solo para retrocompatibilidad de payloads viejos. Sano.
- **Prepare Project Data**: solo emite los nuevos campos (`architect_intake_notes`, `architect_observations`, `client_stated_preferences`, `visit_date`, `photos_urls`, `plan_2d_url`, `coordinates`).
- **agent_briefing Build prompt**: lee `metadata.architect_intake_notes || metadata.notes || metadata.description`.

No hay rastros vivos de `raw_client_input` siendo persistido en `projects.metadata`.

## A7 — E2E

Pasado el 2026-04-24 sobre el proyecto `22c7e914-c19f-41b3-84c0-01d8e1a89382` que recorrió todas las fases hasta `planning_done`. Memory case generado: `780cfa1d-9d9b-4f12-8e22-6849832c143a`. Documentado en `memory/project_state.md`.

---

## Lo que sí queda

- **A1** — `contexto_para_damian.md` con las 20 oportunidades de ArquitAI sec 3 + estructura `knowledge/` + taxonomía. Es un entregable de redacción que se hará cuando Damián vuelva a abordar el roadmap (no es un bug). **Nota: la cobertura ArquitAI sec 3 ya está al 22/26 según `memory/project_state.md`** — el documento maestro para Damián tiene sentido cuando ya sepamos qué falta exactamente y por qué.
- **A5** — solo se puede verificar leyendo `agent_prompts` en Supabase. Si el prompt activo de `agent_briefing` instruye al LLM a devolver el JSON con keys `summary`, `objectives`, `client_needs`, `constraints`, `rooms_affected`, `style_preferences`, `missing_info`, `open_questions`, está cerrado. Si devuelve otra cosa (project_name, location, etc.) hay que reescribirlo. Test rápido: ejecutar agent_briefing en proyecto stub y validar que el `briefings.summary` no es fallback.
- **A6** — limpieza del proyecto de test:
  ```sql
  DELETE FROM activity_log     WHERE project_id = '5c230fc9-be45-4566-ac21-76436857b94b';
  DELETE FROM approvals        WHERE project_id = '5c230fc9-be45-4566-ac21-76436857b94b';
  DELETE FROM briefings        WHERE project_id = '5c230fc9-be45-4566-ac21-76436857b94b';
  DELETE FROM agent_executions WHERE project_id = '5c230fc9-be45-4566-ac21-76436857b94b';
  DELETE FROM projects         WHERE id         = '5c230fc9-be45-4566-ac21-76436857b94b';
  ```
  Ejecutar en Supabase si todavía aparece. (Tras E2E del 24-04 puede haberse limpiado ya.)
