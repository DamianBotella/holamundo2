---
name: Studio Multiagente — Contexto del proyecto
description: Stack técnico, IDs de workflows en n8n, credenciales y arquitectura general
type: project
originSessionId: 32bee148-6455-4e09-b04c-9ad2f179c99b
---
Sistema multiagente en **n8n 2.12.x** (self-hosted en EasyPanel) para un estudio de arquitectura técnica y reformas de vivienda. NO es ecommerce. El sistema procesa proyectos ya captados desde briefing hasta propuesta comercial.

**Why:** Es el backend completo de un estudio real. Cada decisión de diseño importa porque afecta proyectos reales con clientes reales.

**How to apply:** Siempre priorizar robustez sobre velocidad. El arquitecto (Damián) es la figura humana que aprueba cada etapa.

## Arquitectura multi-arquitecto (diseño para el futuro)
El sistema está pensado como producto para múltiples arquitectos, no solo para Damián. Implicaciones:
- **Credenciales**: los IDs actuales son de Damián. Para otro arquitecto se swapea el credential set completo en n8n. No hardcodear emails ni IDs en lógica de negocio — solo en credenciales.
- **Datos predeterminados**: tablas como `trades` (gremios), `price_references` (CYPE) y `agent_prompts` tienen filas base que todo arquitecto recibe al instalar. El patrón es INSERT de seed data en el script de onboarding.
- **MVP actual**: un solo arquitecto (Damián). La arquitectura multi-tenant se implementa en V2.

## Tablas de datos predeterminados (seed data)
- `trades` — 13 especialidades de gremios predefinidas, contactos en blanco (el arquitecto rellena los suyos)
- `price_references` — ~30 partidas CYPE con precios min/avg/max
- `supplier_catalog` — vacío por defecto, el arquitecto añade sus proveedores

## Stack
- n8n 2.12.x — `https://n8n-n8n.zzeluw.easypanel.host`
- Supabase (PostgreSQL 15+) — Transaction Pooler port 6543
- Anthropic Claude / OpenAI GPT-4 — via HTTP Request o util_llm_call
- Gmail OAuth2 — notificaciones y aprobaciones

## Credenciales (IDs reales en n8n)
- Postgres: ID `cfxNZdzy0NB3xkYC` — nombre "Postgres account"
- Gmail: ID `cIma8ntTjZvIfU3H` — nombre "damian2botella" (cuenta damian2botella@gmail.com)
- Google Drive: ID `VLObOrfmQGpS5Lb0` — nombre "damian2botella"
- Google Docs: ID `6NK9u2hvm1UUdoVu` — nombre "Google Docs account"
- Google Sheets: ID `mun4KcJi7kZVMHI4` — nombre "damian2botella"
- OpenAI/LLM (httpHeaderAuth): ID `gE1jXO133xEHS5JJ` — nombre `orquestador ArquiAI` (renovada 2026-04-24). Header `Authorization: Bearer sk-proj-...`. Usada por util_llm_call → `https://api.openai.com/v1/chat/completions`, modelo default `gpt-4o`.

## IDs de workflows en n8n
| Workflow | ID | Estado |
|---|---|---|
| util_llm_call | JoKqGZ8pDzhJohV2 | ✅ activo |
| util_notification | ks2CqrtJCxLJTPdV | ✅ activo |
| error_handler | qfQWaGSpyjgdeFt5 | ✅ activo |
| util_file_organizer | QFEaO5gJEC7c0wvf | ✅ activo |
| init_new_project | HzPLldZVJGFjKbuc | ✅ activo |
| main_orchestrator | EF5lPbSNlmA3Upt1 | ✅ activo (78 nodos — pipeline completo intake→planning_done + memory) |
| agent_briefing | uq3GQWSdmoIV4ZdR | ✅ activo |
| agent_design | sMGf7e8CSnsBQa1q | ✅ activo |
| agent_regulatory | QbRMmQs0oyVHplgE | ✅ activo |
| util_normativa_fetch | 4a03tQ7Q5nmtBpnI | ✅ activo |
| agent_normativa_refresh | 0Cyeaa85uLS7c8EE | ✅ activo |
| agent_materials | SOJW7SgCrJebLRP8 | ✅ activo |
| util_architect_presence | 1WLpSzgcitGJoaoZ | ✅ activo |
| util_consultation | bjKNchMYN2wXKO0k | ✅ activo |
| cron_consultation_batch | 4vyizezPgg3kr192 | ✅ activo |
| agent_documents | E5uOVocm8GwNH278 | ✅ activo |
| util_price_search | PsKCThwfby9t9Zfz | ✅ activo |
| agent_costs | FhF8zelE1KehUD4Z | ✅ activo |
| agent_trades | NHTZkeLUL7qUQPLG | ✅ activo |
| agent_proposal | Mqx8S6nR6exbRY86 | ✅ activo |
| agent_planner | lSUfNw61YfbERI8n | ✅ activo |
| agent_memory | gLxmy7M0UmC7Yzye | ✅ activo |
| cron_project_review | AX05W4baMEfJokWN | ✅ activo |

## Fases del proyecto (projects.current_phase)
intake → briefing_done → design_done → analysis_done → costs_done → trades_done → proposal_done → approved → planning_done → completed → archived
