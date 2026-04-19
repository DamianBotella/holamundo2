# CLAUDE.md — Contexto del Proyecto Studio Multiagente

## QUÉ ES ESTE PROYECTO

Sistema multiagente implementado en **n8n 2.12.x** para un estudio de arquitectura técnica y reformas de vivienda. **NO es ecommerce.**

El sistema toma un proyecto de reforma ya captado (el cliente ya existe) y lo procesa automáticamente desde briefing hasta propuesta comercial, usando 11 agentes de IA especializados coordinados por un orquestador.

## STACK TÉCNICO

- **n8n 2.12.x** (self-hosted, Docker) — orquestación de workflows
- **Supabase (PostgreSQL 15+)** — base de datos del negocio (16 tablas)
- **Google Drive** — almacenamiento de archivos del proyecto
- **Anthropic Claude / OpenAI GPT-4** — LLMs via HTTP Request con Header Auth
- **Gmail** — notificaciones y aprobaciones

## TU ROL COMO ASISTENTE

Eres el programador que construye los workflows de n8n como archivos JSON importables. Cada workflow se genera como un `.json` que Damián importa directamente en n8n.

### Reglas de construcción:

1. **Genera workflows como JSON importable para n8n 2.12.x**. El formato debe ser compatible con la función "Import from File" de n8n.
2. **Usa SOLO nodos que existen en n8n 2.12.x**. Los tipos de nodo están documentados en `references/n8n_node_types.md`.
3. **Nunca uses el nodo AI Agent** para los agentes del sistema. Usa HTTP Request para llamar al LLM.
4. **Los Code nodes se ejecutan en Task Runners aislados** (n8n 2.x). No pueden hacer HTTP requests, no acceden a env vars, no acceden al filesystem. Solo transformación de datos.
5. **Todos los sub-workflows deben tener un Execute Sub-workflow Trigger** como primer nodo.
6. **Las credenciales se referencian por nombre**, no se incluyen en el JSON. Nombres de credenciales esperados:
   - `Anthropic API Key` (Header Auth: x-api-key)
   - `Supabase Postgres` (Postgres credential)
   - `Gmail Notifications` (Gmail OAuth2)
   - `Google Drive` (Google Drive OAuth2)
7. **Cada workflow debe estar en `workflows/` con su nombre como archivo**: `util_llm_call.json`, `agent_briefing.json`, etc.

### Orden de construcción (seguir estrictamente):

```
1. util_llm_call          ← wrapper centralizado para LLM
2. util_notification       ← envío de emails
3. error_handler           ← captura errores globales
4. util_file_organizer     ← estructura de Drive
5. init_new_project        ← punto de entrada
6. agent_briefing          ← primer agente real
7. main_orchestrator (v1)  ← orquestador mínimo (intake → briefing)
8. agent_design
9. agent_regulatory
10. agent_materials
11. agent_documents
12. agent_costs
13. agent_trades
14. agent_proposal
15. agent_planner
16. agent_memory
17. cron_project_review
```

## ESTRUCTURA DEL PROYECTO

```
studio-multiagente/
├── CLAUDE.md                    ← ESTE ARCHIVO (contexto principal)
├── docs/
│   ├── arquitectura.md          ← Bloque 1: arquitectura general
│   ├── modelo_datos.md          ← Bloque 2: 16 entidades con campos
│   ├── mapa_workflows.md        ← Bloque 3: 17 workflows detallados
│   ├── agentes.md               ← Bloque 4: implementación por agente
│   └── plan_fases.md            ← Bloque 5: MVP → V2 → V3
├── schemas/
│   └── mvp_schema.sql           ← Script SQL completo (16 tablas)
├── prompts/
│   └── agent_prompts.md         ← Prompts de los 11 agentes
├── workflows/
│   └── (aquí se generan los JSON de n8n)
└── references/
    └── n8n_node_types.md        ← Referencia de nodos compatibles con 2.12.x
```

## REGLAS CRÍTICAS DEL SISTEMA

- **Ningún agente contacta con terceros sin aprobación humana explícita.**
- **La decisión técnica, normativa, legal y económica final es SIEMPRE humana.**
- **El estado del proyecto vive en PostgreSQL (`projects.current_phase`), no en n8n.**
- **n8n es stateless**: ejecuta workflows, pero no guarda estado.
- **Las aprobaciones usan Wait node** (modo webhook o formulario) **dentro de los sub-workflows** de cada agente.
- **Un solo agente de oficios** para todos los tipos (albanilería, fontanería, etc.), no micro-agentes.
- **El agente documental NO usa LLM en el MVP** — lógica determinista.
- **Todos los sub-workflows DEBEN estar Published** en n8n 2.x para funcionar en producción.

## BASE DE DATOS

16 tablas en Supabase/PostgreSQL. Schema completo en `schemas/mvp_schema.sql`.

Tabla central: `projects` con campo `current_phase` que gobierna el orquestador.

Fases válidas: `intake` → `briefing_done` → `design_done` → `analysis_done` → `costs_done` → `trades_done` → `proposal_done` → `approved` → `planning_done` → `completed` → `archived`

## CÓMO RESPONDER

- Concreto, estructurado, accionable.
- Sin teoría vacía ni abstracciones inútiles.
- Si algo no existe en n8n, propón alternativa con HTTP Request o Code node.
- Genera JSON de workflows completos y funcionales, no fragmentos.
