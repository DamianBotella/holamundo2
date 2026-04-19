# RESUMEN DE HANDOFF — Sistema Multiagente para Estudio de Arquitectura Técnica

## Fecha: Marzo 2026
## Para: Continuación del proyecto en Claude Sonnet

---

## QUÉ ES ESTE PROYECTO

Un sistema multiagente implementado en n8n 2.12.x para un estudio de arquitectura técnica y reformas de vivienda (NO es ecommerce). El sistema toma un proyecto de reforma ya captado y lo procesa desde la información inicial hasta una propuesta comercial lista para el cliente, pasando por briefing, opciones de redistribución, detección de normativa, materiales, costes, oficios y planificación.

**Principios inamovibles:**
- El cliente ya está captado. El sistema empieza con un encargo existente.
- 11 agentes especializados + 1 orquestador, coordinados via PostgreSQL (no comunicación directa entre agentes).
- Ningún agente contacta con terceros sin aprobación humana explícita.
- Toda decisión técnica, normativa, legal y económica final es humana.
- MVP = motor operativo en n8n. La interfaz visual (pixel art / Habbo) es V3+.

**Stack:**
- n8n 2.12.x self-hosted (Docker)
- Supabase (PostgreSQL 15+) para datos del negocio
- Google Drive para archivos
- LLMs (Anthropic Claude o OpenAI GPT-4) via HTTP Request con Header Auth credentials
- Gmail para notificaciones

---

## QUÉ ESTÁ COMPLETADO — 6 BLOQUES DE DISEÑO

### BLOQUE 1: Arquitectura general
- Visión global, componentes, comunicación entre agentes
- Patrón: orquestador lee `projects.current_phase` → Switch → Execute Sub-workflow del agente → agente escribe en BD → orquestador actualiza fase
- Agentes como sub-workflows independientes (todos deben estar Published en n8n 2.x)
- Aprobaciones con Wait node dentro de los sub-workflows (funciona correctamente en n8n 2.0+ gracias al fix de Wait en sub-workflows)
- Task Runners activos por defecto: Code nodes no tienen acceso a env vars, filesystem ni HTTP. LLM se llama via nodo HTTP Request, no desde Code.

### BLOQUE 2: Modelo de datos MVP
- 16 tablas en PostgreSQL: clients, projects, briefings, design_options, regulatory_tasks, documents, material_items, cost_estimates, trade_requests, external_quotes, proposals, project_plans, approvals, activity_log, memory_cases, agent_prompts
- Script SQL completo listo para ejecutar (`mvp_schema.sql`)
- Enums como text + CHECK constraints
- Campos flexibles como jsonb
- Triggers de updated_at automáticos
- Índices optimizados

### BLOQUE 3: Mapa de 17 workflows
- 1 orquestador: `main_orchestrator`
- 11 agentes: `agent_briefing`, `agent_design`, `agent_regulatory`, `agent_documents`, `agent_materials`, `agent_costs`, `agent_trades`, `agent_proposal`, `agent_planner`, `agent_memory`
- 5 auxiliares: `util_llm_call`, `util_notification`, `util_file_organizer`, `cron_project_review`, `error_handler`
- 1 entrada: `init_new_project`
- Cada workflow detallado nodo por nodo con secuencia, decisiones IF/Switch, qué lee/escribe en BD, qué devuelve

### BLOQUE 4: Detalle de implementación por agente
- Misión, input/output esperado, herramientas, datos que consulta/escribe, aprobaciones, errores comunes
- Prompts completos (system + user_template) para los 10 agentes que usan LLM
- Modelos recomendados por agente: Sonnet para 7 agentes (estructuración), Opus/GPT-4 para 3 (diseño, costes, propuesta)
- Coste estimado por proyecto: 1-2€ en LLM

### BLOQUE 5: Plan de construcción por fases
- **MVP (6-8 semanas):** Semana 1 infraestructura, Semana 2 auxiliares + briefing, Semana 3 diseño + normativa + materiales, Semana 4 costes + oficios + propuesta, Semana 5 plan + memoria + cierre, Semana 6 estabilización
- **V2 (6-8 semanas post-MVP):** Comunicación externa supervisada, panel web mínimo, memoria semántica con embeddings, mejoras de calidad
- **V3 (3-6 meses post-V2):** Multi-usuario, API, interfaz avanzada, interfaz gamificada pixel art

### BLOQUE 6: Primer workflow paso a paso
- `util_llm_call` detallado nodo por nodo (8 nodos)
- Configuración exacta de cada nodo para n8n 2.12.x
- 4 tests incluidos
- Flujo: Receive → Set Defaults → HTTP Request (LLM) → Extract Response / Handle Error → Merge → Log en Postgres → Return Result

---

## DÓNDE ESTAMOS AHORA — PASO EXACTO

Estamos en la **Semana 1 del MVP: Infraestructura base**.

### Lo que falta hacer (en este orden):

1. **Obtener datos de conexión de Supabase** ← AQUÍ EXACTAMENTE
   - Damián tiene el proyecto de Supabase creado
   - Está en el panel "Conéctate a tu proyecto"
   - Necesita hacer clic en la pestaña **"Directo"** (no "Estructura" que es para Next.js)
   - De ahí copiar: Host, Database, Port, User, Password
   - El User en Supabase actual es `postgres.REFERENCIA_PROYECTO` (no simplemente `postgres`)

2. **Ejecutar `mvp_schema.sql` en Supabase**
   - Ir a Supabase Dashboard → SQL Editor
   - Pegar el script completo y ejecutar
   - Verificar: 16 tablas creadas

3. **Instalar n8n self-hosted con Docker**
   - Docker Compose incluido en BLOQUE 1 (pinear versión 2.12.x)
   - PostgreSQL como BD interna de n8n (separada de Supabase)
   - WEBHOOK_URL con HTTPS obligatorio

4. **Configurar HTTPS para n8n**
   - Cloudflare Tunnel como opción rápida
   - Necesario para webhooks y Wait nodes

5. **Crear credenciales en n8n**
   - Postgres (apuntando a Supabase)
   - Header Auth (API key del LLM)
   - Gmail
   - Google Drive

6. **Construir `util_llm_call`**
   - Seguir BLOQUE 6 paso a paso
   - 8 nodos, 1-2 horas
   - Testear con los 4 tests
   - Publicar (Shift+P)

7. **Continuar con los siguientes workflows**
   - `util_notification` → `error_handler` → `util_file_organizer` → `init_new_project` → `agent_briefing` → `main_orchestrator` (v1)

---

## ARCHIVOS ENTREGADOS

Todos estos archivos deberían estar en los documentos del proyecto de Claude:

| Archivo | Contenido |
|---|---|
| `bloque1_arquitectura_v2.md` | Arquitectura completa adaptada a n8n 2.12.x |
| `bloque2_modelo_datos.md` | 16 entidades con campos, propósito y relaciones |
| `mvp_schema.sql` | Script SQL completo para crear las 16 tablas |
| `bloque3_mapa_workflows.md` | 17 workflows detallados nodo por nodo |
| `bloque4_agentes.md` | Implementación de los 11 agentes |
| `bloque4_prompts.md` | Prompts completos listos para producción |
| `bloque5_plan_fases.md` | Plan MVP → V2 → V3 |
| `bloque6_primer_workflow.md` | Guía paso a paso de `util_llm_call` |

---

## NOTAS IMPORTANTES PARA SONNET

- Damián trabaja en Windows con Claude Code instalado (Git for Windows + CLAUDE_CODE_GIT_BASH_PATH configurado).
- Prefiere respuestas concretas, estructuradas y accionables. Sin teoría vacía.
- Trata a Claude como arquitecto técnico senior + consultor de automatización.
- No inventar nodos de n8n que no existan. Si algo no existe, proponer alternativa con HTTP Request o Code node.
- El agente documental NO usa LLM en el MVP (lógica determinista).
- Las llamadas al LLM van SIEMPRE por HTTP Request, no por el nodo AI Agent de n8n.
- Todos los sub-workflows DEBEN estar Published en n8n 2.x para funcionar en producción.
