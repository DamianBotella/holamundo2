# ArquitAI — Qué tenemos construido hoy

> **Documento de estado real, 2026-05-13.** Solo lo que existe y funciona en
> producción. Sin promesas, sin roadmap, sin "estaría bien". Para pendientes
> ver [`ESTADO_REAL_PROYECTO.md`](../ESTADO_REAL_PROYECTO.md) §15 y la lista
> de post-launch que vive aparte.

---

## 0. Resumen ejecutivo en un párrafo

ArquitAI es un SaaS multi-tenant para estudios de arquitectura técnica y
reformas de vivienda. Procesa proyectos desde la primera llamada del cliente
hasta la postventa usando **35 agentes IA** orquestados en **n8n 2.12.x**
contra una base de datos **Supabase Postgres** con **89 migraciones**
aplicadas. Tiene **billing real** en Stripe TEST mode (3 tiers + plan
interno founder), un **dashboard con BI**, un **endpoint de consulta
normativa con RAG semántico** sobre **108 reglas PGOU embedded**, y carga
automática de normativa cuando un proyecto entra en un municipio nuevo.
El frontend (React 19 + Vite + Tailwind + PixiJS) está montado en `foxhole-ui/`
y la página `/studio` está temporalmente apagada con placeholder mientras se
rediseña la UI isométrica. Los flujos comerciales (Dashboard, Billing,
proyecto-detalle, propuestas) están operativos.

---

## 1. Producto

### 1.1 Propuesta de valor

Automatizar el flujo profesional de un estudio de arquitectura técnica:

```
captación → briefing → diseño → análisis → costes → oficios →
propuesta → aprobación → planificación → ejecución → entrega → postventa
```

Cada fase la cubre uno o varios agentes IA que asisten al arquitecto. La
decisión técnica, normativa, legal y económica final es **siempre humana**
(EU AI Act art. 14). Los outputs LLM van etiquetados como `eu_ai_act:
'asistencia, no decision vinculante'`.

### 1.2 Modelo de negocio

| Tier | Precio | Trial | Proyectos | Usuarios | Tokens IA / mes |
|---|---|---|---|---|---|
| Starter | 49 €/mes | 14 d | 3 simultáneos | 1 | 500K |
| Pro | 149 €/mes | 14 d | 10 simultáneos | 3 | 2M |
| Equipo | 299 €/mes | 14 d | Ilimitados | Ilimitados | 10M |
| **Founder** (interno) | 0 € | — | Ilimitados | Ilimitados | Ilimitados |

Trial de 14 días sin cobro automático, red triple de alertas (cron 7d/3d/1d +
Stripe `trial_will_end` + founder pass). Plan `founder` oculto del catálogo
público con `is_active=false` y guard especial en webhook para que Stripe
nunca sobrescriba sus campos.

### 1.3 Diferenciales

- **Multi-tenant real** con RLS Postgres aislando datos entre estudios.
- **RAG semántico sobre normativa española** (108 reglas embedded en 6 ciudades).
- **Carga automática de PGOU** cuando un proyecto entra en un municipio
  nuevo (gpt-4o + futuro web scraping).
- **Trazabilidad EU AI Act**: tabla `decision_log` inmutable + `agent_executions`
  + `activity_log` registran cada decisión asistida con timestamp y fuente.
- **Anti scope-creep**: agentes registran cambios de alcance del cliente en
  `client_decisions` con `metodo_confirmacion` + `evidencia_url` (audio,
  email, foto firmada).

---

## 2. Stack técnico

| Capa | Tecnología | Notas |
|---|---|---|
| Orquestación | n8n 2.12.x self-hosted Docker | EasyPanel, `https://n8n-n8n.zzeluw.easypanel.host` |
| Base de datos | Supabase Postgres 15+ + pgvector | ~75-80 tablas, 89 migraciones |
| Frontend | Vite 5 + React 19 + TypeScript + Tailwind + TanStack Query + PixiJS v8 | `studio-multiagente/foxhole-ui/` |
| Auth | Supabase Auth (JWT HS256) | Frontend obtiene token, backend lo decodifica inline (base64, sin verificar firma — RLS valida indirectamente vía `tenant_id`) |
| LLM principal | OpenAI gpt-4o + gpt-4o-mini (chat) | Credencial n8n `gE1jXO133xEHS5JJ` |
| Embeddings | OpenAI `text-embedding-3-small` (1536d) | Aplicado a `materials_catalog` y `municipal_pgou_rules` |
| RAG | pgvector ivfflat + función `search_pgou_rules()` | Top-k cosine similarity |
| Billing | Stripe Checkout + Customer Portal | Webhook HMAC SHA256 pure-JS (n8n bloquea `require('crypto')`) |
| Archivos | Google Drive + Docs + Sheets OAuth2 | 4 credenciales n8n distintas |
| Email | Gmail OAuth2 | `damian2botella@gmail.com` (uso interno) |
| Render | mnml.ai Interior AI | Renders fotorrealistas en `agent_proposal_render` |
| Hosting frontend | Vercel | Pendiente apuntar dominio `arquitai.studio` |
| Hosting n8n | EasyPanel sobre VPS | Imagen Docker oficial n8n |

---

## 3. Arquitectura de alto nivel

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend foxhole-ui (Vite + React 19 + Pixi v8)            │
│  • Login Supabase → JWT en memoria/localStorage             │
│  • Llamadas a /webhook/api/v1/* con Bearer JWT              │
│  • Supabase Realtime para activity_log y proposals          │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS + JWT
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  n8n self-hosted (Docker, EasyPanel) — 192 workflows live   │
│  • 35 agentes IA (webhook + JWT decode + RLS context)       │
│  • 26 endpoints API REST (api_*.json)                       │
│  • 1 webhook Stripe HMAC (sin JWT)                          │
│  • 2 endpoints públicos sin JWT (proposals/public/*)        │
│  • Crons (alerts, audits, security, post-phase)             │
│  • Sub-workflows utilitarios                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
       ┌───────────┼────────────┬───────────────┐
       ▼           ▼            ▼               ▼
  ┌────────┐ ┌──────────┐ ┌──────────┐  ┌──────────┐
  │Supabase│ │  OpenAI  │ │  Stripe  │  │ mnml.ai  │
  │Postgres│ │ gpt-4o + │ │ +Webhook │  │ + Gemini │
  │ + RLS  │ │ embeddings│ │  HMAC    │  │  + Drive │
  └────────┘ └──────────┘ └──────────┘  └──────────┘
```

**Patrón estándar de cada agente** (documentado en CLAUDE.md §4):

```
Webhook → Decode JWT → IF Auth → Set Session Context (RLS) →
Load Data → Build Prompt → Start Execution → Call LLM →
Format Response → Insert Outputs → Finish Execution → Respond
```

---

## 4. Base de datos

### 4.1 Migraciones

**89 migraciones aplicadas** (003 → 089). Última: `089_agent_executions_natural_log_trigger.sql`.

Las migraciones siguen convención secuencial con sufijos puntuales:
`003_prices` → `056_studio_layout_v7` → `056b_studio_layout_v7_fix` → `057` → …

### 4.2 Tablas centrales del negocio

| Tabla | Propósito |
|---|---|
| `tenants` | Estudios cliente. PK del multi-tenancy. |
| `clients` | Clientes finales del estudio (los que contratan reformas). |
| `projects` | Proyectos. `current_phase` enumerado: intake → briefing_done → … → archived |
| `briefings` | Resumen estructurado de la primera entrevista. |
| `design_options` | N opciones de redistribución generadas por `agent_design`. |
| `material_items` | Materiales seleccionados por proyecto. |
| `materials_catalog` | Catálogo global con embedding pgvector. |
| `regulatory_tasks` | Trámites detectados por `agent_regulatory`. |
| `documents` | Documentos generados (memorias, certificados). |
| `cost_estimates` | Presupuesto detallado con desviación calculada (GENERATED column). |
| `trade_requests` | Solicitudes de presupuesto a gremios. |
| `external_quotes` | Cotizaciones recibidas. |
| `proposals` | Propuestas comerciales. Versionado. Estados: draft / pending_review / approved_internal / sent_to_client / accepted / rejected. |
| `proposal_acceptances` | Aceptación pública vía link único. |
| `project_plans` | Plan operativo con camino crítico. |
| `approvals` | Aprobaciones humanas requeridas. |
| `memory_cases` | Base de conocimiento del estudio (proyectos cerrados destilados). |

### 4.3 Decisiones y trazabilidad EU AI Act

| Tabla | Propósito |
|---|---|
| `decision_log` | Inmutable, solo INSERT. Cada decisión LLM con timestamp + fuente. |
| `client_decisions` | Anti scope-creep. `metodo_confirmacion` + `evidencia_url`. |
| `architect_directives` | Directivas del estudio + del arquitecto a agentes (ADDENDUM 2). |
| `agent_conversations` | Historial de chat con cada agente. |
| `agent_executions` | Cada ejecución de cada agente. Status running/completed/failed/reverted. |
| `agent_executions_io` | Input + output JSONB por ejecución. |
| `activity_log` | Feed cronológico unificado. `message_type` action/coordination/directive/system. |

### 4.4 Normativa

| Tabla | Datos |
|---|---|
| `normativa_knowledge` | Base cacheada de CTE, RD, normativas estatales. |
| `normativa_sources` | Fuentes oficiales con URLs y fechas verificación. |
| `municipal_templates` | Procedimientos administrativos por municipio. |
| `municipal_pgou_rules` | **108 reglas PGOU** + embedding pgvector + `searchable_text`. |
| `municipal_prechecks` | Resultado del pre-check normativo por proyecto. |
| `municipal_onboarding_queue` | Cola para `agent_normativa_fetch` (municipios nuevos). |

### 4.5 Billing (Fase G)

| Tabla | Propósito |
|---|---|
| `subscription_plans` | 4 tiers: starter/pro/equipo/founder. Sincronizado con Stripe prices. |
| `tenant_subscriptions` | UNIQUE por tenant_id. Estado, trial, current_period_*, stripe_*. |
| `stripe_events_log` | UNIQUE event_id → idempotencia webhook. |
| `tenant_usage` | Counters mensuales (proyectos, tokens, usuarios). |
| `trial_alerts_sent` | UNIQUE (tenant_id, alert_type, day) → evita spam de alertas. |

### 4.6 Funciones SQL críticas

- `current_tenant_id() → uuid` — lee `app.current_tenant` per-connection (helper RLS).
- `is_super_admin() → boolean` — bypass RLS para super_admin role.
- `set_session_context(user_id, tenant_id, role)` — cada workflow lo llama al inicio.
- `get_tenant_billing_state(tenant_id) → jsonb` — estado completo de billing para un tenant.
- `check_tenant_quota(tenant_id, resource) → jsonb` — middleware de quota (proyectos, tokens, usuarios).
- `find_expiring_trials() → setof` — escaneo masivo de trials próximos a expirar.
- `search_pgou_rules(municipio, vec, top_k) → setof` — RAG semántico sobre normativa local.
- `agent_action_to_natural(agent_name, status) → text` — mapeo de 35 agentes a frase es-ES (mig 089).

### 4.7 Triggers automáticos

- `trg_agent_exec_insert_log` y `trg_agent_exec_update_log` (mig 089) — cada
  ejecución de agente genera automáticamente entries en `activity_log` con
  texto natural en español, sin necesidad de modificar los workflows.

### 4.8 Vistas

- `v_activity_feed_natural` — feed para futura UI sidebar (filtra `message_type='action'`).
- `agent_registry` — alias sobre `agents_catalog` exponiendo `agent_type`/`color_hex`.
- 5 vistas BI: `v_bi_project_profitability`, `v_bi_phase_duration` (placeholder),
  `v_bi_proposal_conversion`, `v_bi_agent_activity_month`, `v_bi_budget_alerts`.

### 4.9 RAG / pgvector

- Extensión `vector` habilitada.
- Índice ivfflat sobre `municipal_pgou_rules.embedding` (1536d, cosine).
- Índice ivfflat sobre `materials_catalog.embedding`.
- 108 reglas embedded actualmente (94 seed top-5 + 14 Tres Cantos generadas).

---

## 5. Pipeline de un proyecto

```
[1] init_new_project crea project + cliente + carpeta Drive
   ↓
[2] api_projects_create auto-trigger agent_normativa_fetch si municipio nuevo
   ↓
[3] main_orchestrator delega por fase actual del proyecto
   ↓
[4] agent_briefing extrae briefing estructurado
   ↓ (briefing_done)
[5] agent_design genera N opciones de redistribución
   ↓
[6] agent_decision_engine compara opciones con scoring multicriteria
   ↓
[7] agent_client_translator registra elección del cliente (anti scope-creep)
   ↓ (design_done)
[8] agent_regulatory + agent_municipal_precheck identifican trámites
   ↓
[9] agent_accessibility / agent_safety_plan / agent_energy_assessor / agent_pathology
    (paralelo según tipo de proyecto)
   ↓ (analysis_done)
[10] agent_materials selecciona materiales + agent_grants_finder busca subvenciones
   ↓
[11] agent_costs presupuesta + agent_anomaly_detector audita
   ↓ (costs_done)
[12] agent_trades agrupa por gremio + agent_trade_comms cotiza
   ↓ (trades_done)
[13] agent_proposal_moodboard + agent_proposal_render preparan visual
   ↓
[14] agent_proposal genera propuesta consolidada
   ↓ (proposal_done)
[15] Cliente firma vía proposal_acceptances.public_token (link único)
   ↓ (approved)
[16] agent_planner planifica obra con camino crítico
   ↓ (planning_done)
[17] agent_site_monitor / agent_qc_checklists / agent_permit_tracker durante ejecución
   ↓
[18] agent_certificate_generator emite CFO, habitabilidad, etc.
   ↓ (completed)
[19] agent_aftercare gestiona postventa LOE
   ↓
[20] agent_memory destila proyecto a memory_cases (archived)
```

---

## 6. Agentes IA — 35 en catálogo

Distribuidos en **10 habitaciones isométricas** del studio (layout v7 mig 056):

### Recepción

| Agente | Display | Función |
|---|---|---|
| `agent_briefing` | Recepcionista | Estructura briefing del cliente |
| `agent_client_concierge` | Asesor de Cliente | Chatbot con escalado al arquitecto |

### Mesa de Dibujo

| Agente | Display | Función |
|---|---|---|
| `agent_design` | Delineante | N opciones de redistribución |
| `agent_sketch_to_scale` | Dibujante Técnico | Croquis a planos escalados |
| `agent_home_automation` | Domótico | KNX/Matter/Zigbee |

### Biblioteca Normativa

| Agente | Display | Función |
|---|---|---|
| `agent_regulatory` | Técnico Normativa | Lista trámites con citación |
| `agent_normativa_refresh` | Actualizador Normativa | Cache warmer CTE/PGOU |
| `agent_accessibility` | Auditor Accesibilidad | DB-SUA 9 + Orden VIV/561/2010 |
| `agent_compliance_audit` | Auditor | Scorecard A-D con 21 checks |
| `agent_pathology` | Patólogo | 24 patologías sobre fotos |

### Despacho Contable

| Agente | Display | Función |
|---|---|---|
| `agent_costs` | Contable | Presupuesto por partidas CYPE |
| `agent_financial_tracker` | Tracker Financiero | OCR facturas + certificaciones |
| `agent_anomaly_detector` | Inspector Fraude | 8 heurísticas anomalías económicas |
| `agent_grants_finder` | Técnico Subvenciones | Next Generation EU |

### Dirección (Main Office)

| Agente | Display | Función |
|---|---|---|
| `main_orchestrator` | Director | 92 nodos — gobierna transiciones de fase |
| `agent_collab_coordinator` | Coordinador Externo | Calculistas, decoradores |

### Sala de Reuniones

| Agente | Display | Función |
|---|---|---|
| `agent_proposal` | Comercial | Propuesta consolidada |
| `agent_contracts` | Jurídico | 9 tipos de contrato |
| `agent_planner` | Planificador de Obra | Plan con camino crítico |
| `agent_proposal_moodboard` | (D.3) | Paleta + materiales + render_prompt |
| `agent_proposal_render` | (D.3) | Render fotorrealista mnml.ai |
| `agent_municipal_precheck` | (E.1) | Pre-check top-5 ciudades |
| `agent_decision_engine` | (D.1) | Comparativa multicriteria EU AI Act |
| `agent_client_translator` | (D.2) | Cliente → decisión inmutable |

### Terraza - Inspección

| Agente | Display | Función |
|---|---|---|
| `agent_site_monitor` | Inspector de Obra | Visión sobre fotos/videos |
| `agent_permit_tracker` | Tramitador | Tracking licencias municipales |
| `agent_qc_checklists` | Inspector Calidad | Checklists por fase |
| `agent_iee` | Inspector IEE | Informe Evaluación >50 años |

### Taller - Gremios

| Agente | Display | Función |
|---|---|---|
| `agent_trades` | Jefe de Obra | Encargos por especialidad |
| `agent_trade_comms` | Comunicador Gremios | Cotizaciones webhook_token |
| `agent_materials` | Jefe de Materiales | Selección por proveedor |
| `agent_safety_plan` | Técnico PRL | EBSS/PSS RD 1627/1997 |
| `agent_rcd` | Técnico Residuos | RD 105/2008 |

### Archivo

| Agente | Display | Función |
|---|---|---|
| `agent_memory` | Archivista | Destila proyectos cerrados a memory_cases |
| `agent_documents` | Documentalista | Memoria + propuestas (sin LLM) |
| `agent_certificate_generator` | Certificador | 7 tipos (CFO, habitabilidad…) |
| `agent_energy_assessor` | Técnico Energético | CTE DB-HE + calificación |
| `util_interop_bc3` | Importador BC3 | FIEBDC-3 para CYPE/Presto |
| `agent_telematic_filing` | Tramitador Digital | Sede electrónica |

### Corredor de Urgencias

| Agente | Display | Función |
|---|---|---|
| `agent_aftercare` | Postventa | Incidencias LOE |

### Servicios transversales (sin sala fija)

| Agente | n8n ID | Función |
|---|---|---|
| `init_new_project` | `HzPLldZVJGFjKbuc` | Entry point: crea project + cliente + Drive folder |
| `agent_normativa_fetch` | `t0dI701fIWhG334y` | Onboarding automático municipios (LLM-only hoy) |
| `agent_onboarding` | — | Alta de tenant |
| `agent_onboarding_extract` | — | Datos del estudio desde web |
| `agent_catalog_sync` | — | Embeddings catálogo materiales |

---

## 7. Workflows n8n — 192 activos

### Por ubicación en disco

- `workflows/*.json` (raíz): **167 archivos**
- `workflows/api/*.json`: **26 archivos**
- **Total disco: 193 archivos**
- **Drift vs live: 0** (último smoke 2026-05-13)

### Por categoría

- **35 agentes IA** (uno por cada agente del catálogo).
- **26 endpoints API REST** (`api_*.json`).
- **Sub-workflows utilitarios** (`util_*.json`): `util_jwt_verify`, `util_normativa_fetch`, `util_interop_bc3`, `util_generate_embedding`, etc.
- **Crons** (`cron_*.json`): `cron_health_check`, `cron_proposal_response_followup`, `cron_backup_verify`, `cron_normativa_freshness`, `cron_data_integrity`, `cron_db_size_check`, `cron_post_phase_audits`, `cron_trial_expiry_alert`, `cron_security_audit`, `cron_normativa_review_monthly`.
- **Webhook stripe** (1) — sin JWT, HMAC SHA256 pure-JS.

### Patrón estándar

Documentado en CLAUDE.md §4. Cada agente: Webhook → Decode JWT inline → IF Auth → Set Session Context → Load Data → Build Prompt → Call LLM → Format → Persist → Respond.

---

## 8. Endpoints API REST — 26 activos

Todos en `https://n8n-n8n.zzeluw.easypanel.host/webhook/api/v1/...` salvo el webhook Stripe (`/webhook/stripe`).

### Autenticación / perfil

| Endpoint | Método | JWT |
|---|---|---|
| `/me` | GET | Sí |

### Proyectos

| Endpoint | Método | JWT |
|---|---|---|
| `/projects` | GET, POST | Sí |
| `/project-detail?id=` | GET | Sí |
| `/project-timeline?id=` | GET | Sí |
| `/project-deliverables?id=` | GET | Sí |

### Studio (canvas + datos)

| Endpoint | Método | JWT |
|---|---|---|
| `/studio/agents` | GET | Sí |
| `/studio/rooms` | GET | Sí |
| `/studio/feed?since=&limit=` | GET | Sí |
| `/studio/conversations?agent_name=&project_id=` | GET | Sí |
| `/studio/agent-chat` | POST | Sí (system prompt enriquecido ADDENDUM 2) |
| `/studio/pending-approvals` | GET | Sí |
| `/studio/agent/directive` | POST | Sí (ADDENDUM 2 B4) |

### Alertas y métricas

| Endpoint | Método | JWT |
|---|---|---|
| `/alerts/global?limit=` | GET | Sí |
| `/metrics/dashboard` | GET (cache 60s) | Sí |
| `/bi/dashboard` | GET | Sí (ADDENDUM 2 B7) |

### Agentes específicos

| Endpoint | Método | JWT |
|---|---|---|
| `/approval-decision` | POST | Sí |
| `/agents/decision-engine/evaluate` | POST | Sí |
| `/agents/client-translator/record-decision` | POST | Sí |
| `/agents/proposal/moodboard` | POST | Sí |
| `/agents/proposal/render` | POST | Sí |
| `/agents/municipal-precheck/run` | POST | Sí |
| `/agents/iee/approve` | POST | Sí |
| `/agents/rcd/approve` | POST | Sí |
| `/agents/normativa-fetch/run` | POST | Sí (ADDENDUM 2 B5) |
| `/regulatory/ask` | POST | Sí (ADDENDUM 2 B6 RAG) |

### Públicos (sin JWT)

| Endpoint | Método | Auth |
|---|---|---|
| `/proposals/public?token=` | GET | Token único en URL |
| `/proposals/public/accept` | POST | Token único |
| `/webhook/stripe` | POST | HMAC SHA256 |

---

## 9. Frontend — `foxhole-ui`

### Páginas (`src/pages/`)

- **`LoginPage.tsx`** — Supabase Auth UI.
- **`DashboardPage.tsx`** — KPIs + kanban por fase + ActivityFeed + **widget Business Intelligence (ADDENDUM 2 B7)**.
- **`ProjectDetailPage.tsx`** — Detalle de un proyecto con timeline, deliverables, approvals.
- **`NewProjectWizardPage.tsx`** — Wizard de creación de proyecto. Auto-dispara `agent_normativa_fetch` cuando el municipio es nuevo.
- **`BillingPage.tsx`** — Plan actual + 3 tarjetas de precios + redirect a Stripe Checkout / Portal.
- **`StudioPage.tsx`** — **APAGADO temporalmente**. Placeholder negro "EN REDISEÑO" hasta reactivar Bloques 1+2 visuales del ADDENDUM 2.

### Componentes (`src/components/`)

- `TopBar.tsx` — Navegación principal con badges (trial, alertas).
- `DashboardKPIs.tsx` — Métricas resumidas.
- `PhaseColumnView.tsx` — Vista kanban por fase de proyecto.
- `ActivityFeed.tsx` — Stream Realtime de eventos.
- `ProjectCard.tsx` — Tarjeta de proyecto.
- `ProjectDeliverablesPanel.tsx` — Documentos entregables.
- **`BusinessIntelligence.tsx`** — 6 cards BI con sparkline SVG inline (ADDENDUM 2 B7).
- `billing/PlanCard.tsx` — Plan en BillingPage.
- `billing/SubscriptionStatusCard.tsx` — Estado de suscripción + portal button.

### Studio (`src/studio/`) — apagado temporalmente

- `StudioCanvas.tsx` — Canvas Pixi v8 con pan/zoom.
- `StudioRoom.tsx` — Renderizado isométrico de habitaciones.
- `StudioAgent.tsx` — Sprites Kenney CC0 (preparado para sustituir por `AgentFigure.ts`).
- `AgentFigure.ts` — Figuras vectoriales Pixi (ADDENDUM 2 B1, listo para reactivar).
- `StudioFurniture.tsx`, `StudioSidebar.tsx`, `ApprovalPanel.tsx`, `AgentChatPanel.tsx`, `ProjectSelector.tsx`.
- `agentPosition.ts`, `drawRoomWalls.ts`, `iso.ts`, `palette.ts`, `pixiSingleton.ts`.
- `furnitureRegistry.ts`, `spriteRegistry.ts` (marcado `@deprecated`).
- `assets/sprites/` — 10+ sprites Kenney 16x16.
- `assets/rooms/` — **10 fondos Gemini 1.3 MB cada uno** generados pero no renderizados hasta rediseño con `PIXI.Mesh` warp.
- `hooks/` — `useStudioAgents`, `useStudioRooms`, `useActivityFeed`, `useAgentChat`, `useActiveProject`, `usePendingApprovals`, `useTenantId`, `useProjectDeliverablesRealtime`.

### Libs (`src/lib/`)

- `api.ts` — Cliente REST con envelope `{data, meta}`. Helpers para `/me`, `/projects`, `/billing`, `/bi`.
- `types.ts` — Espejo de las views SQL + tipos BI del ADDENDUM 2.
- `session.tsx` — Supabase auth context con `getAccessToken()`.
- `supabase.ts` — Cliente Supabase.
- `mock-data.ts` — Fallback cuando `VITE_N8N_API_BASE` no está definido.
- `time.ts` — Helpers `formatTimeAgo`, etc.

### Variables de entorno

`.env.local`:
- `VITE_N8N_API_BASE` — URL base del webhook (`https://n8n-n8n.zzeluw.easypanel.host/webhook/api/v1`)
- `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- `VITE_FORCE_MOCK` (opcional)

---

## 10. Billing — Stripe operativo

### Estado actual

- **TEST mode activo** con keys `sk_test_*` y `pk_test_*`.
- 3 productos + 3 prices creados en Stripe Dashboard (Starter, Pro, Equipo).
- Webhook configurado apuntando a `/webhook/stripe` con HMAC SHA256.
- 4 webhooks reales procesados E2E sin error en último test.
- Customer Portal embed funcionando.

### Flujo de un usuario

1. Login → `BillingPage` lee estado de `tenant_subscriptions`.
2. Si no tiene suscripción → muestra 3 tarjetas de precios.
3. Click "Empezar trial 14d" → POST `/billing/checkout` → Stripe Checkout Session → redirect.
4. Pago test → webhook Stripe `checkout.session.completed` → INSERT en `tenant_subscriptions`.
5. `BillingPage` hace polling cada 3s tras volver con `?session_id=...` hasta que aparece.
6. Para gestionar: POST `/billing/portal` → Customer Portal de Stripe.
7. Cron diario `cron_trial_expiry_alert` envía emails 7d/3d/1d antes del fin de trial.
8. Stripe `customer.subscription.trial_will_end` también dispara email.

### Bug HMAC resuelto (commit `c9dcb60`)

Reconstruir el body con `JSON.stringify($json.body)` produce bytes distintos a los que firmó Stripe. Fix: leer raw body desde `binary.data.data` base64.

### Founder pass (commit `5cdebee`)

Si el tenant tiene `plan_id = founder_id`, el webhook NO sobrescribe `status`/`trial_ends_at`/`current_period_*`. Guard:

```sql
CASE WHEN plan_id = founder_id
     THEN tenant_subscriptions.<campo>
     ELSE EXCLUDED.<campo>
END
```

---

## 11. Integraciones externas activas

| Servicio | Uso | Credencial n8n |
|---|---|---|
| **OpenAI** | gpt-4o (LLM principal) + gpt-4o-mini (chat) + text-embedding-3-small | `gE1jXO133xEHS5JJ` (httpHeaderAuth) |
| **Stripe** | Checkout + Portal + Webhook | Keys en `system_config` |
| **Google Drive** | Carpetas por proyecto | `VLObOrfmQGpS5Lb0` (OAuth2) |
| **Google Docs** | Memoria + propuestas | `6NK9u2hvm1UUdoVu` (OAuth2) |
| **Google Sheets** | Catálogo materiales + ROI | `mun4KcJi7kZVMHI4` (OAuth2) |
| **Gmail** | Notificaciones a arquitecto | `cIma8ntTjZvIfU3H` (OAuth2 `damian2botella@gmail.com`) |
| **Supabase Postgres** | BD principal multi-tenant | `cfxNZdzy0NB3xkYC` (Transaction Pooler 6543) |
| **mnml.ai** | Render fotorrealista de propuestas | Key en `system_config.mnml_api_key` |
| **Gemini 2.5 flash image** | Fondos isométricos (uso puntual) | Sin credencial n8n (script offline) |

---

## 12. Multi-tenancy y seguridad

### RLS

- Todas las tablas de negocio tienen `tenant_id uuid REFERENCES tenants(id)`.
- Política estándar: `USING (tenant_id = current_tenant_id() OR is_super_admin())`.
- Cada workflow llama `SELECT set_session_context(user_id, tenant_id, role)` al inicio para activar el filtro RLS.

### JWT

- Supabase emite JWT HS256 con `sub` (user_id), `tenant_id`, `role`, `exp`.
- Backend decodifica inline (base64 del payload, sin verificar firma).
- La validación efectiva es vía RLS: si el JWT está manipulado pero el `tenant_id` apunta a un tenant donde el `sub` no tiene permisos, las queries no devuelven datos.

### Roles definidos

- `architect` — usuario normal de un estudio.
- `super_admin` — bypass RLS (uso interno + smoke tests).
- `owner` — fundador del tenant (puede gestionar billing).

### Hardening aplicado (mig 008 + 045)

- `pii_encrypt` / `pii_decrypt` funciones con AES-256.
- `check_rate_limit(ip, endpoint, max_per_minute)` función.
- Tabla `ip_blocklist`.
- Tabla `access_log` (global, no por tenant).
- Tabla `security_events`.

### Stripe webhook seguro

- HMAC SHA256 verificado contra `stripe_webhook_secret`.
- `stripe_events_log` con UNIQUE `event_id` → idempotencia.
- Pure-JS implementation por bloqueo de `require('crypto')` en n8n.

---

## 13. Scripts de mantenimiento

`studio-multiagente/scripts/`:

### Deploy

- `deploy_b5.mjs`, `deploy_b6.mjs`, `deploy_d3.mjs`, `deploy_e1.mjs`, `deploy_g.mjs`, `deploy_g_plus.mjs`, `deploy_client_translator.mjs` — despliegan workflows vía REST API n8n.

### Smoke

- `smoke_b5.mjs` (Tres Cantos PGOU fetch).
- `smoke_b6.mjs` (RAG normativa).
- `smoke_d3.mjs`, `smoke_e1.mjs`, `smoke_e2.mjs`, `smoke_g.mjs`, `smoke_client_translator.mjs` — E2E real con JWT minteado.

### Housekeeping

- `sync_drift_workflows.mjs` — Descarga workflows activos en n8n que NO están en disco.
- `sync_e1.mjs`, `sync_d3.mjs`, `sync_client_translator.mjs` — Pull selectivo desde n8n.
- `check_migration_drift.py` — Detecta migraciones aplicadas vs disco.
- `enrich_agent_chat_prompt.mjs` — Modificó system prompt de studio_agent_chat (ADDENDUM 2 B4.1).
- `backfill_pgou_embeddings.mjs` — Llena `searchable_text` + `embedding` de reglas PGOU.
- `generate_room_backgrounds.mjs` — Genera 10 fondos isométricos con Gemini (uso puntual).

---

## 14. Documentos vivos del proyecto

| Documento | Propósito |
|---|---|
| `studio-multiagente/CLAUDE.md` | Instrucciones de trabajo para Claude. 12 secciones. |
| `studio-multiagente/ArquitAI.md` | Documento maestro del producto (negocio, agentes, beneficios). |
| `studio-multiagente/ARQUITAI_HOY.md` | **Este documento**. Estado construido. |
| `ESTADO_REAL_PROYECTO.md` (raíz) | Foto operativa con drift, riesgos, pendientes. §15 cierra ADDENDUM 2. |
| `studio-multiagente/references/n8n_node_types.md` | Tipos de nodos n8n 2.12.x compatibles. |
| `ArquitAI_briefing_para_claude.md` (raíz) | Briefing original con visión + 6 fases. |
| `ARQUITAI_ESTRATEGIA_FORMA_EXPANSION.md` (raíz) | Roadmap geográfico (Hispanoamérica + Europa). |
| `ADDENDUM 2 INSTRUCCIONES CLAUDE CODE.pdf` (raíz) | Spec del addendum pre-launch. |
| Memoria persistente Claude (`~/.claude/.../memory/`) | Feedback técnico, contexto sesión, decisiones de producto v2. |

---

## 15. ADDENDUM 2 — estado por bloque

Reescribir la UI del estudio + funcionalidades pre-launch.

| Bloque | Estado | Commit | Implementación |
|---|---|---|---|
| Paso 0 — Migraciones 084-088 | ✅ Done | `17be613` | 5 mig: activity_log+agent_registry, architect_directives extension, pgou_embeddings, onboarding_queue, BI views |
| 1 — Figuras vectoriales | ⏸ Revertido | `2759839` | `AgentFigure.ts` listo en disco, sin enchufar. Requiere fondos rediseñados (PIXI.Mesh warp). |
| 2 — Movimiento agentes | ⏸ Revertido | `2759839` | Tweening + bobbing listos en disco. |
| **3 — INSERTs naturalizados** | ✅ Done (SQL trigger) | `80f80f2` | Mig 089: función + 2 triggers en agent_executions. 35 agentes mapeados. Sin tocar workflows. |
| 3-UI — ActivitySidebar | ⏸ Pendiente | — | Data fluye gracias a mig 089. |
| **4-backend — `/agent/directive`** | ✅ Done | `c95d41a` | Workflow `9uui4HfAYxYXaCOd` con INSERT en `architect_directives` + `activity_log`. |
| **4.1 — system prompt agent_chat** | ✅ Done | `2139162` | Workflow `zjbVC1p7tW5MTJ6g` enriquecido con room_display_name + last_action_text + 8 reglas estrictas. |
| 4-UI — Chat panel + Coordination | ⏸ Pendiente | — | Endpoint existe. INSERTs `message_type='coordination'` en `main_orchestrator` también pendientes. |
| **5 — `agent_normativa_fetch`** | ✅ Done | `ba7c1db` | Workflow `t0dI701fIWhG334y`. LLM-only (Jina pospuesto). Auto-trigger en `api_projects_create`. Smoke Tres Cantos 14 reglas / 42s. |
| **6 — RAG `/regulatory/ask`** | ✅ Done | `b138c5b` | Workflow `ciYAceNDWZZYCaxw`. 108 reglas embedded. Smoke: ascensor=alta, fachada=media. |
| **7 — BI Dashboard** | ✅ Done | `98f0dd2` | Workflow `TLOYYx89RDe7OZ3t` (1 CTE con 6 widgets). Componente `BusinessIntelligence.tsx` integrado en `DashboardPage`. |

### Lo que NO está construido del ADDENDUM 2 (pendiente UI final)

1. Reactivar Bloques 1+2 visuales (`git revert 2759839`).
2. Rediseñar carga de fondos Gemini con `PIXI.Mesh` warp 4-vértices.
3. Construir `ActivitySidebar.tsx` (consume `v_activity_feed_natural`).
4. Construir `AgentChatPanel` con botón "Aplicar como directiva".
5. Construir `AgentCoordination.tsx` panel.
6. Inyectar INSERTs `message_type='coordination'` en `main_orchestrator` (92 nodos, alto riesgo gotcha 6.4).

---

## 16. Métricas reales del proyecto

| Métrica | Valor |
|---|---|
| Líneas de código frontend | ~15-20k TypeScript/TSX |
| Migraciones SQL aplicadas | 89 |
| Tablas en Supabase | ~75-80 |
| Workflows activos en n8n live | 192 |
| Workflows en disco | 193 |
| Drift workflows | 0 |
| Agentes IA en catálogo | 35 |
| Endpoints API REST | 26 |
| Reglas PGOU embedded | 108 (94 seed + 14 Tres Cantos) |
| Municipios con normativa cargada | 6 (Madrid, BCN, Valencia, Sevilla, Bilbao, Tres Cantos) |
| Productos Stripe | 3 (Starter / Pro / Equipo) + 1 plan interno Founder |
| Webhooks Stripe procesados E2E | 4+ sin error |
| Coste OpenAI estimado | ~$0.01-0.05 por proyecto procesado |
| Tiempo medio respuesta `/regulatory/ask` | ~4-5s |
| Tiempo medio respuesta `/bi/dashboard` | ~450ms |

---

## 17. Stack de credenciales y secretos

### En `system_config` (tabla pública con RLS)

- `stripe_secret_key`
- `stripe_publishable_key`
- `stripe_webhook_secret`
- `mnml_api_key`
- `architect_email` (centralizado para todas las notificaciones)
- `webhook_api_key`
- `billing_success_url`
- `billing_cancel_url`
- `billing_portal_return_url`
- `public_proposal_base_url`

### Credenciales n8n (referenciadas por ID, nunca en JSON)

Listadas en sección 11.

### `.mcp.json` (gitignored)

- `MCP_API_KEY` (dashboard.n8n-mcp.com)
- `N8N_API_URL`
- `N8N_API_KEY`

---

## 18. Bugs n8n 2.12.x documentados (gotchas que volverán a aparecer)

Documentados en CLAUDE.md §6 y memoria `feedback_technical.md`:

1. `require('crypto')`, `fetch`, `URLSearchParams` bloqueados en Code nodes — usar nodos httpRequest o pure-JS.
2. Webhook rawBody desde `binary.data.data` base64, no `JSON.stringify($json.body)`.
3. Ternarios `$('Node').first() ? ... : null` revientan si el nodo no se ejecutó — usar `isExecuted` en Code node.
4. Insertar nodos en medio rompe referencias `$json` aguas abajo — referenciar siempre por nombre: `$('NodoAnterior').first().json.X`.
5. HTTP Request `typeVersion: 4.2` (NUNCA 4.4 que corrompe el nodo).
6. Google Sheets update requiere campo `range` explícito.
7. Webhook con `:id` dinámico en path da 404 en EasyPanel — usar query string.
8. PUT a workflow vía REST API lo desactiva — siempre POST `/activate` después.
9. `n8n_update_partial_workflow` permite `branch: "true"`/`"false"` que se mapean a salidas 0/1 — verificar después con `n8n_get_workflow mode: structure`.
10. Stripe webhook + founder: guard `CASE WHEN plan_id = founder_id THEN ... ELSE EXCLUDED.* END`.
11. `unaccent()` no instalado en Supabase por defecto — hacer slug en JS.

---

## 19. Reglas del sistema (no negociables)

Heredadas del producto, vigentes:

1. Ningún agente contacta con terceros sin aprobación humana explícita.
2. La decisión técnica/normativa/legal/económica final es siempre humana (EU AI Act art. 14).
3. El estado del proyecto vive en Postgres (`projects.current_phase`), no en n8n. n8n es stateless.
4. Las aprobaciones usan `Wait` node dentro del sub-workflow del agente.
5. Un solo agente de oficios para todos los gremios — no micro-agentes por especialidad.
6. `agent_documents` NO usa LLM — lógica determinista basada en fase.
7. Todos los workflows producción deben estar `active=true` en n8n.
8. Credenciales referenciadas por ID, nunca hardcoded en JSON commiteado.
9. Migraciones secuenciales (003, 004, …) e idempotentes (`IF NOT EXISTS`, `ON CONFLICT DO UPDATE`).
10. Push a `origin/main` tras cada fase verde, no al final del día.

---

*Documento generado leyendo: 89 migraciones SQL, 193 archivos JSON workflow, 6 pages frontend, 35 agentes catálogo, ESTADO_REAL_PROYECTO.md §1-15, CLAUDE.md, ArquitAI_briefing_para_claude.md, ADDENDUM 2 PDF, memoria Claude persistente. 2026-05-13.*
