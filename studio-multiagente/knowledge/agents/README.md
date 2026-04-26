# Agentes ArquitAI — referencia rápida

> Resumen ejecutivo de cada agente activo en n8n. Para detalle completo de prompts y arquitectura ver `studio-multiagente/docs/agentes.md` y `prompts/agent_prompts.md`.

## Cadena MVP (orquestada por `main_orchestrator`)

| Orden | Agente | ID n8n | Responsabilidad | Output principal |
|---|---|---|---|---|
| 1 | `init_new_project` | `HzPLldZVJGFjKbuc` | Punto de entrada — recibe notas del arquitecto, crea project + client + estructura Drive | row en `projects` |
| 2 | `agent_briefing` | `uq3GQWSdmoIV4ZdR` | Estructura el intake del arquitecto en briefing técnico (objetivos, espacios, restricciones, open_questions). Cifra `client_needs_enc` | row en `briefings` (status approved tras email) |
| 3 | `agent_design` | `sMGf7e8CSnsBQa1q` | Genera 2-3 opciones de diseño (apertura, redistribución, etc.) | rows en `design_options` |
| 4 | `agent_regulatory` | `QbRMmQs0oyVHplgE` | Detecta trámites administrativos requeridos (licencia obras, ITE, etc.) consultando `util_normativa_fetch` | rows en `regulatory_tasks` |
| 5 | `agent_materials` | `SOJW7SgCrJebLRP8` | Propone materiales por estancia consultando `util_price_search` y `supplier_catalog` | rows en `materials` + `material_items` |
| 6 | `agent_documents` | `E5uOVocm8GwNH278` | Genera documentación (briefing, mediciones, fichas) en Drive | files en Drive |
| 7 | `agent_costs` | `FhF8zelE1KehUD4Z` | Estimación de costes por partida consultando `price_references` (CYPE) | row en `cost_estimates` |
| 8 | `agent_trades` | `NHTZkeLUL7qUQPLG` | Identifica gremios necesarios y solicita quotes via `trade_quote_request` | rows en `trade_requests` |
| 9 | `agent_proposal` | `Mqx8S6nR6exbRY86` | Genera propuesta comercial al cliente (PDF + email) con pre-flight checklist | row en `proposals` |
| 10 | `agent_planner` | `lSUfNw61YfbERI8n` | Plan de obra (cronograma, milestones, dependencias) | row en `project_plans` |
| 11 | `agent_memory` | `gLxmy7M0UmC7Yzye` | Aprendizaje cross-proyectos (archiva learnings al completar proyecto) | rows en `project_intelligence` |

## Agentes complementarios (no en cadena lineal)

| Agente | ID n8n | Cuándo se invoca | Output |
|---|---|---|---|
| `agent_safety_plan` | `yRaR3V0j61R1g1jZ` | Tras `costs_done` — plan SST | row en `safety_plans` |
| `agent_accessibility` | `s7ctmUsITOWK7cRT` | Si proyecto requiere accesibilidad LOE | row en `accessibility_audits` |
| `agent_site_monitor` | `DPy3FBugAbWP10BD` | Durante ejecución — detecta avisos en obra | rows en `site_events` |
| `agent_pathology` | `I34LYGuiWTQ8WJCa` | Tras visita inicial — detecta patologías | rows en `pathology_findings` |
| `agent_energy_assessor` | `63XFqhlsg0d1cXav` | Para CTE-DB-HE / certificado energético | row en `energy_assessments` |
| `agent_home_automation` | `6f25BcR8LwNX2HQH` | Si cliente pide domótica | row en `home_automation_proposals` |
| `agent_contracts` | `Abwnfh4BtHPU9lHg` | Tras propuesta aprobada — genera contratos (encargo + obra + actas) | rows en `contracts` |
| `agent_certificate_generator` | `OqOHU6Uc6FkVWPEu` | Para certificaciones de obra (avance%) | rows en `certifications` |
| `agent_compliance_audit` | `RzLYzuMiDWBPpo6y` | Pre-handover — auditoría de cumplimiento | informe |
| `agent_financial_tracker` | `LEspjLl6VEHPclPG` | Cron + on-demand — reconcilia facturas vs estimaciones | actualiza `invoices.status` |
| `agent_normativa_refresh` | `0Cyeaa85uLS7c8EE` | Cron mensual — refresca `normativa_knowledge` con cambios oficiales | rows en `normativa_knowledge` |

## Sub-workflows utilitarios (no son agentes pero los agentes los invocan)

| Sub-workflow | Función |
|---|---|
| `util_llm_call` | Wrapper centralizado para todo OpenAI/Anthropic. Ahora registra en `llm_calls` (migration 035). |
| `util_notification` | Wrapper centralizado de Gmail. Templates: approval, escalation, weekly, etc. |
| `util_consultation` | Cola de consultas no bloqueantes al arquitecto. |
| `util_architect_presence` | Estado online/offline del arquitecto. |
| `util_normativa_fetch` | Fetch normativa oficial via Jina Reader. |
| `util_price_search` | Búsqueda de precios materiales en Leroy Merlin via Jina. |
| `util_search_similar_cases` | Embeddings de casos previos para context-retrieval. |
| `util_generate_embedding` | Wrapper OpenAI embeddings. |
| `util_security_check` | Rate limit + pattern detection + ip_blocklist (ver bloque seguridad). |
| `util_hmac_verify` | Verificación HMAC para webhooks externos. |
| `util_file_organizer` | Crea estructura Drive del proyecto. |
| `util_interop_bc3` | Generador BC3 (presto/cype intercambio) |
| `util_interop_ifc` | Export IFC (BIM intercambio) |
| `util_dashboard_summary` (+ `_html`) | Dashboard de KPIs estudio. |
| `util_security_dashboard` (+ `_html`) | Dashboard de seguridad. |
| `util_llm_costs_html` | Vista HTML de costes LLM. |
| `util_webhook_security` | Helper de auth para webhooks internos. |

## Patrón común de los agentes

1. **Receive Sub-workflow Trigger** (passthrough) — recibe `{project_id, ...}` desde el orquestador.
2. **Load context** — Postgres SELECTs para cargar projects + briefing + previous outputs relevantes.
3. **Build LLM Payload** — Code node que construye `prompt_system + prompt_user` desde `agent_prompts` table.
4. **Call LLM** — Execute Sub-workflow → `util_llm_call` (registra en `llm_calls`).
5. **Parse Response** — Code node con regex fallback de markdown JSON.
6. **Save Output** — Postgres INSERT en la tabla correspondiente.
7. **Approval (si aplica)** — Send Email + Wait node para webhook de aprobación humana.
8. **Update phase** — Postgres UPDATE `projects.current_phase` + cron `main_orchestrator` lanza siguiente.

## Estado de los agentes

Verificación rápida de qué agentes están activos:
```bash
curl -sS "https://n8n-n8n.zzeluw.easypanel.host/webhook/dashboard-html" \
  -H "X-API-Key: <WEBHOOK_API_KEY>"
```
o ver `cron_health_check` (diario 06:00) que valida funciones SQL + tablas.

## Coste por agente

Ver `util_llm_costs_html` o consultar `llm_costs_summary` directamente:
```sql
SELECT * FROM llm_costs_summary;
```
