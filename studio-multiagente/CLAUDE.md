# CLAUDE.md — ArquitAI / studio-multiagente

> Última actualización: **2026-05-12**. Reemplaza la versión "MVP abril 2026"
> (11 agentes / 16 tablas / 17 workflows) que era obsoleta tras 5 fases más.
> Para foto completa con drift, riesgos y números reales, ver
> [`ESTADO_REAL_PROYECTO.md`](../ESTADO_REAL_PROYECTO.md) en la raíz del repo.

---

## 1. QUÉ ES

**ArquitAI** es un SaaS multi-tenant para estudios de arquitectura técnica y reformas de vivienda. Procesa proyectos de reforma desde captación → propuesta comercial → ejecución → aftercare usando **~30 agentes IA orquestados en n8n**. Multi-tenant con billing real (Stripe), trial 14 días, 3 tiers (Starter 49€ / Pro 149€ / Equipo 299€) + plan interno `founder` (unlimited).

**No es ecommerce.** No vende productos. Vende automatización del flujo profesional de un estudio.

---

## 2. STACK

| Capa | Tecnología |
|---|---|
| Orquestación | **n8n 2.12.x** self-hosted Docker (https://n8n-n8n.zzeluw.easypanel.host) |
| BD negocio | **Supabase PostgreSQL 15+** (~75-80 tablas, 86 migraciones aplicadas) |
| Frontend | **Vite + React + TypeScript + Tailwind + TanStack Query + PixiJS v8** (`studio-multiagente/foxhole-ui/`) |
| Auth | **Supabase Auth** (JWT) — frontend obtiene token, backend decodifica inline (no verifica firma) |
| LLM | **OpenAI gpt-4o** via HTTP Request + Header Auth (credencial `gE1jXO133xEHS5JJ`) |
| Embeddings | OpenAI `text-embedding-3-small` (1536d) en `util_generate_embedding` |
| Billing | **Stripe Checkout + Customer Portal** + webhook HMAC SHA256 |
| Archivos | **Google Drive + Google Docs + Sheets** (credenciales OAuth2) |
| Email | **Gmail OAuth2** (`damian2botella@gmail.com`) |
| Render | **mnml.ai Interior AI** (renders fotorrealistas) |

---

## 3. ARQUITECTURA DE ALTO NIVEL

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend (foxhole-ui)                                              │
│  • Login Supabase → JWT en memoria/localStorage                     │
│  • Llama a /webhook/api/v1/* con Authorization: Bearer <JWT>        │
│  • Realtime via Supabase postgres_changes                           │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTPS + JWT
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  n8n self-hosted (Docker, EasyPanel)                                │
│  • 188 workflows activos:                                           │
│    - ~30 agentes IA (POST /api/v1/agents/<name>/<action>)           │
│    - 23 endpoints API REST (GET/POST /api/v1/<resource>)            │
│    - 1 webhook Stripe (POST /webhook/stripe — sin JWT, HMAC)        │
│    - 2 endpoints públicos sin JWT (proposals/public/*)              │
│    - Crons (post_phase_audits, expiry alerts, security, etc.)       │
│    - Utilidades sub-workflows                                       │
│  • Cada agente: decode JWT → set_session_context → load data →      │
│    LLM call → format → upsert BD → respond                          │
└────────────────────────┬────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
   ┌─────────┐    ┌──────────┐    ┌────────────┐
   │Supabase │    │  OpenAI  │    │  Stripe    │
   │Postgres │    │  gpt-4o  │    │  + Webhook │
   │ + RLS   │    │+ embed   │    │            │
   └─────────┘    └──────────┘    └────────────┘
```

### Estado de un proyecto

Vive en `projects.current_phase`. Valores: `intake` → `briefing_done` → `design_done` → `analysis_done` → `costs_done` → `trades_done` → `proposal_done` → `approved` → `planning_done` → `completed` → `archived`.

El `main_orchestrator` (`EF5lPbSNlmA3Upt1`) coordina las transiciones. n8n es **stateless** — el estado está en BD.

### Multi-tenancy

Toda tabla de negocio tiene `tenant_id uuid REFERENCES tenants(id)`. RLS activa via función `current_tenant_id()` que lee `app.current_tenant` (variable per-connection). Cada workflow llama `SELECT set_session_context(user_id, tenant_id, role)` al inicio para activar el filtro RLS.

---

## 4. AGENTES (~30)

### Pipeline principal (12 agentes core)

| Agente | n8n ID | Función |
|---|---|---|
| `init_new_project` | `HzPLldZVJGFjKbuc` | Punto de entrada — crea project + cliente + Drive folder |
| `main_orchestrator` | `EF5lPbSNlmA3Upt1` | 92 nodos — gobierna transiciones de fase |
| `agent_briefing` | `uq3GQWSdmoIV4ZdR` | Extrae briefing del cliente (LLM + 30 nodos) |
| `agent_design` | `sMGf7e8CSnsBQa1q` | Genera N opciones de distribución |
| `agent_regulatory` | `QbRMmQs0oyVHplgE` | Detecta trámites necesarios |
| `agent_materials` | `SOJW7SgCrJebLRP8` | Selecciona materiales según briefing |
| `agent_documents` | `E5uOVocm8GwNH278` | Genera documentación (lógica determinista, no LLM) |
| `agent_costs` | `g7RclDoz8AWfG0V6` | Presupuesto detallado por partidas CYPE |
| `agent_trades` | `DtGdN5NEwlY4cnBp` | Agrupa trabajos por gremio (`trade_requests`) |
| `agent_proposal` | `Mqx8S6nR6exbRY86` | Propuesta comercial consolidada |
| `agent_planner` | `lSUfNw61YfbERI8n` | Plan de obra + camino crítico |
| `agent_memory` | `gLxmy7M0UmC7Yzye` | Destila proyecto cerrado a `memory_cases` |

### Agentes técnicos / regulatorios (Fase B — pre-launch)

`agent_accessibility` (DB-SUA), `agent_safety_plan` (RD 1627/1997 EBSS/PSS), `agent_energy_assessor`, `agent_pathology`, `agent_normativa_refresh` (cache warmer), `agent_site_monitor`, `agent_financial_tracker`, `agent_contracts`, `agent_home_automation`, `agent_certificate_generator`, `agent_compliance_audit`, `agent_onboarding` + `agent_onboarding_extract`.

### Agentes Fase C (mayo 2026 — 8 AUX)

`agent_client_concierge`, `agent_sketch_to_scale`, `agent_anomaly_detector`, `agent_collab_coordinator`, `agent_permit_tracker`, `agent_qc_checklists`, `agent_trade_comms`, `agent_aftercare`. Más `agent_catalog_sync` (embedding semántico de materiales).

### Agentes Fase A.2 / extras

`agent_grants_finder`, `agent_rcd`, `agent_iee`, `agent_telematic_filing`.

### Agentes Fase D (mayo 2026)

| Agente | ID | Propósito |
|---|---|---|
| `agent_decision_engine` | `vQGsJMHVRqDoss0z` | Comparativa de N opciones con scoring multicriteria (EU AI Act art. 14) |
| `agent_client_translator` | `Nr3Bk2x73bXrq98u` | Convierte texto natural del cliente en decisión estructurada inmutable (anti scope-creep) |
| `agent_proposal_moodboard` | `7r3hVOHRaAFreBRy` | Paleta + materiales + render_prompt EN para mnml.ai |
| `agent_proposal_render` | `3C0IyRkz48VnFdky` | Render fotorrealista vía mnml.ai (⚠️ no smoke-tested con URL real) |

### Agentes Fase E

`agent_municipal_precheck` (`SNG5lECKgZz3Twgd`) — Pre-check normativa PGOU top 5 ciudades (Madrid, BCN, Valencia, Sevilla, Bilbao). **94 reglas seed** en `municipal_pgou_rules`.

### Patrón estándar de un agente

```
[Webhook POST /api/v1/agents/<name>/<action>]
    ↓
[Code: Decode JWT + Validate]   ← inline base64 decode, no verifica firma
    ↓
[IF: Auth OK?]
    ├─ error → [Respond 401/400]
    └─ ok ↓
[Postgres: Set Session Context (RLS)]
    ↓
[Postgres: Load Project / Briefing / ...]
    ↓
[Code: Build Prompt]            ← genera llm_payload completo
    ↓
[Postgres: Start Execution]     ← INSERT agent_executions 'running'
    ↓
[HTTP Request: Call LLM]        ← jsonBody: $('Build Prompt').first().json.llm_payload
    ↓                              ⚠️ NUNCA $json.llm_payload (ver Sección 6)
[Code: Format Response]
    ↓
[Postgres: Insert Output (cost_estimates, design_options, ...)]
    ↓
[Postgres: Finish Execution]    ← UPDATE agent_executions 'completed'
    ↓
[Code: Build Final Body]        ← acceso seguro a nodos opcionales (isExecuted)
    ↓
[Respond 201 JSON]
```

---

## 5. FASES IMPLEMENTADAS

| Fase | Estado | Hitos |
|---|---|---|
| A.1 | ✅ | Pipeline base intake → proposal_done |
| A.2 | ✅ | Materials catalog con embedding pgvector + grants_finder + IEE |
| A.3-A.5 | ✅ | Hardening: multi-tenant, RLS, PII encryption, Supabase Realtime |
| B | ✅ | Agentes técnicos pre-launch (accessibility, safety, energy, pathology, etc.) |
| C | ✅ | 12 nuevos agentes (4 CORE + 8 AUX) + catalog_sync con embedding |
| D.1 | ✅ | decision_engine |
| D.2 | ✅ | client_translator anti scope-creep |
| D.3 | ⚠️ | Propuesta visual: moodboard ✅ + render mnml ⚠️ no probado + aceptación pública ✅ |
| E.1-E.2 | ✅ | Pre-check normativa PGOU top 5 ciudades (94 reglas) |
| G | ✅ | Stripe billing 3 tiers TEST mode + Customer Portal + webhook HMAC + founder pass |
| G+ | ✅ | Red triple de alertas trial (cron 7d/3d/1d + Stripe trial_will_end + founder pass) |
| **Frontend billing** | ✅ | Página `/#billing` con tabla precios + redirect a Stripe |

**Pendientes principales:**
- Stripe **LIVE mode** (KYC + repetir setup con `sk_live_`)
- `agent_proposal_render` con URL real
- Cambiar `billing_*_url` de `localhost:5173` a dominio prod
- Auditar tablas no usadas (sospechas: `home_automation_proposals`)

---

## 6. GOTCHAS CRÍTICOS DE n8n 2.12.x (LEER ANTES DE TOCAR WORKFLOWS)

Estos bugs se han pillado **trabajando con código real**. Si construyes/modificas workflows ignorando esto, vas a perder horas.

### 6.1 — `require('crypto')`, `fetch`, `URLSearchParams` están **bloqueados** en Code nodes

Los Task Runners de n8n 2.x ejecutan los Code nodes en sandbox VM aislado. NO tienen acceso a:
- `require('crypto')` → `Error: Module 'crypto' is disallowed`
- `fetch` → `fetch is not defined`
- `URLSearchParams` → `URLSearchParams is not defined`
- `require('fs')`, `path`, `os`, etc.

**SÍ están disponibles:** `Buffer`, `JSON`, `Math`, `Date`, `Promise`, los métodos estándar de JS.

**Fix:**
- HMAC SHA256 → implementación pure-JS inline (~60 líneas, ver `webhook_stripe.json` nodo "Verify Signature")
- HTTP calls → usar `n8n-nodes-base.httpRequest` como nodo separado, NUNCA `fetch` en Code
- URL-encoded body → construir string manual: `Object.entries(obj).map(([k,v]) => encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&')`

### 6.2 — Webhook `rawBody`: leer desde `binary.data.data` base64, NO reconstruir con `JSON.stringify`

Para verificar firmas HMAC (Stripe, GitHub, etc.) necesitas los **bytes exactos** que firmó el remitente. Si reconstruyes con `JSON.stringify(input.body)` los bytes serán DIFERENTES (Stripe usa 2-space indent, tu reconstrucción no) → HMAC siempre falla.

**Fix:**
```js
// Webhook node options: { rawBody: true }
const binaryB64 = $('POST /webhook-name').first().binary?.data?.data;
const rawBody = Buffer.from(binaryB64, 'base64').toString('utf8');
// Ahora rawBody son los bytes EXACTOS que envió el remitente
```

Detectado en B72-fase-G `webhook_stripe`. Solución vive en commit `c9dcb60`.

### 6.3 — Ternario `$('Node').first() ? ... : null` en expresiones `{{ }}` revienta si el nodo no se ejecutó

Las expresiones de n8n NO son lazy. El parser evalúa `$('NodeX')` ANTES del operador `?`. Si NodeX no se ejecutó (rama FALSE de un IF), error `ExpressionError: Node 'X' hasn't been executed`.

**Síntoma:** status 200 con body vacío (Stripe-like) o execution con error pero ya devolvió 200.

**Fix:** mover toda la construcción del body a un Code node antes del Respond. En Code node SÍ puedes usar `$('NodeX').isExecuted`:
```js
const x = $('NodeX').isExecuted ? ($('NodeX').first()?.json || null) : null;
return [{ json: { ..., field_x: x } }];
```
El Respond solo serializa `$json`.

### 6.4 — Insertar nodo en medio ROMPE referencias `$json` aguas abajo

Si metes `Start Execution` (Postgres INSERT) entre `Build Prompt` y `Call LLM`, el Call LLM ahora recibe el output de Start Execution (`{id: "uuid"}`), no el de Build Prompt. Si tenía `$json.llm_payload`, se pierde silenciosamente.

**Síntoma:** runtime `"JSON parameter needs to be valid JSON"` porque `JSON.stringify(undefined) = undefined`.

**Fix:** SIEMPRE referenciar nodos lógicos por nombre, no `$json`:
```js
// MAL: jsonBody: "={{ JSON.stringify($json.llm_payload) }}"
// BIEN: jsonBody: "={{ JSON.stringify($('Build Prompt').first().json.llm_payload) }}"
```

### 6.5 — HTTP Request typeVersion 4.2 (NUNCA 4.4)

`typeVersion: 4.4` corrompe el nodo en producción. Aparece como "Install this node to use it". Usar siempre `4.2`.

### 6.6 — Google Sheets update requiere campo `range`

Operación `update`/`appendOrUpdate` sin `range: "NombreHoja!A:Z"` da `"Range is required"`.

### 6.7 — Webhook con `:id` dinámico en path NO funciona en EasyPanel

`api/v1/X/:id` da 404 incluso con workflow activo. Usar query string: `api/v1/X?id=...` y leer con `$input.first().json.query?.id`.

### 6.8 — PUT a workflow vía API REST lo desactiva

`PUT /api/v1/workflows/:id` setea `active=false`. Después de cada PUT/update hay que hacer `POST /api/v1/workflows/:id/activate`.

### 6.9 — `n8n_update_partial_workflow` permite branches inválidos

Al añadir conexión a un IF, `branch: "true"` y `"false"` se mapean a las salidas 0 y 1. Si te equivocas la rama FALSE puede quedar vacía y el workflow devolver 200 con body vacío. Verificar con `n8n_get_workflow mode: structure` después.

### 6.10 — Stripe webhook + tenant founder

Si una cuenta `founder` también es customer en Stripe (caso del fundador haciendo testing), los webhooks de Stripe sobrescriben `status`/`trial_ends_at`/`current_period_*`. Solución: guard `CASE WHEN plan_id = founder_id THEN tenant_subscriptions.<campo> ELSE EXCLUDED.<campo> END` en el `ON CONFLICT DO UPDATE`. Ver `webhook_stripe.json` nodo "Upsert Subscription" (commit `5cdebee`).

---

## 7. CÓMO TRABAJAR EN ESTE REPO

### 7.1 Tu rol como Claude

Construir, modificar y depurar workflows n8n + frontend React + migraciones SQL. Cada workflow es un `.json` que vive en `workflows/` o `workflows/api/`. Lo deployás via REST API (no via "Import from File" manual).

### 7.2 Patrón de trabajo estándar

```
1. CONSTRUIR  → Write workflow JSON en disco
2. DEPLOYAR   → script node mjs:
                POST /api/v1/workflows + POST /api/v1/workflows/:id/activate
                Guarda el _n8n_id en el JSON local
3. SMOKE E2E  → script node mjs con JWT minteado:
                fetch al endpoint, verifica status + body + BD
4. SYNC LOCAL ← script node mjs:
                GET /api/v1/workflows/:id → sobrescribe local
                (necesario tras updates parciales en n8n live)
5. COMMIT     → git add + commit con mensaje descriptivo
6. PUSH       → git push origin main
```

### 7.3 Estructura del repo

```
holamundo2/
├── ESTADO_REAL_PROYECTO.md            ← Foto fiel del estado (regenerar cuando hace falta)
├── studio-multiagente/
│   ├── CLAUDE.md                       ← ESTE ARCHIVO
│   ├── ArquitAI.md                     ← Documento maestro del producto (negocio + agentes)
│   ├── schemas/
│   │   ├── mvp_schema.sql              ← Schema base + 16 tablas iniciales
│   │   └── migrations/
│   │       ├── 003_*.sql ... 083_*.sql ← 86 migraciones aplicadas
│   │       └── apply_phase_a2.sql
│   ├── workflows/
│   │   ├── agent_*.json                ← ~30 agentes
│   │   ├── cron_*.json                 ← Crons
│   │   ├── util_*.json                 ← Sub-workflows
│   │   ├── webhook_stripe.json         ← Webhook Stripe
│   │   └── api/
│   │       ├── api_*.json              ← 22 endpoints REST
│   │       └── util_jwt_verify.json    ← Sub-workflow auth
│   ├── scripts/
│   │   ├── deploy_*.mjs                ← Scripts deploy por fase
│   │   ├── smoke_*.mjs                 ← Scripts smoke E2E
│   │   ├── sync_*.mjs                  ← Pull desde n8n live
│   │   └── sync_drift_workflows.mjs    ← Detecta workflows en n8n no commiteados
│   ├── prompts/                        ← Prompts maestros
│   ├── foxhole-ui/                     ← Frontend React/Vite
│   │   ├── src/
│   │   │   ├── App.tsx                 ← Routing por estado
│   │   │   ├── pages/                  ← DashboardPage, ProjectDetailPage, BillingPage, StudioPage
│   │   │   ├── components/             ← TopBar, ProjectCard, billing/PlanCard, etc.
│   │   │   ├── studio/                 ← Studio X7 (PixiJS) — componentes + hooks + data
│   │   │   └── lib/
│   │   │       ├── api.ts              ← Cliente REST (api.me, api.billing.*, etc.)
│   │   │       ├── types.ts            ← Tipos espejo de las views SQL
│   │   │       ├── session.tsx         ← Supabase auth context
│   │   │       └── supabase.ts         ← Cliente Supabase
│   │   └── .env.local                  ← VITE_N8N_API_BASE + VITE_SUPABASE_*
│   ├── docs/                           ← ⚠️ Posiblemente obsoleto, auditar
│   └── references/
│       └── n8n_node_types.md           ← Tipos de nodos compatibles 2.12.x
└── .agents/skills/                     ← Skills Stripe instalados via npx skills add
    ├── stripe-best-practices/
    ├── stripe-projects/
    └── upgrade-stripe/
```

### 7.4 Credenciales (referenciadas por ID, NUNCA hardcoded en JSON)

| Servicio | n8n ID | Notas |
|---|---|---|
| Postgres Supabase | `cfxNZdzy0NB3xkYC` | Transaction Pooler port 6543 |
| Gmail damian2botella | `cIma8ntTjZvIfU3H` | OAuth2 |
| Google Drive damian2botella | `VLObOrfmQGpS5Lb0` | OAuth2 |
| Google Docs | `6NK9u2hvm1UUdoVu` | OAuth2 |
| Google Sheets damian2botella | `mun4KcJi7kZVMHI4` | OAuth2 |
| OpenAI "orquestador ArquiAI" | `gE1jXO133xEHS5JJ` | httpHeaderAuth, Bearer `sk-proj-...` |

### 7.5 Secretos en `system_config` (tabla pública, leer con SELECT)

`stripe_secret_key`, `stripe_publishable_key`, `stripe_webhook_secret`, `mnml_api_key`, `architect_email`, `webhook_api_key`, `billing_success_url`, `billing_cancel_url`, `billing_portal_return_url`, `public_proposal_base_url`. **Nunca hardcoded en workflow JSON** — leer en runtime desde un nodo Postgres.

---

## 8. REGLAS DEL SISTEMA (NO NEGOCIABLES)

1. **Ningún agente contacta con terceros sin aprobación humana explícita.** El agente prepara emails, draft messages, etc., pero el envío real requiere aprobación.
2. **La decisión técnica, normativa, legal y económica final es SIEMPRE humana** (EU AI Act art. 14). Los outputs LLM tienen marca `eu_ai_act: 'asistencia, no decision vinculante'`.
3. **El estado del proyecto vive en PostgreSQL** (`projects.current_phase`), no en n8n. n8n es stateless.
4. **Las aprobaciones usan `Wait` node** (modo webhook o formulario) **dentro del sub-workflow** de cada agente.
5. **Un solo agente de oficios** para todos los tipos (albañilería, fontanería, etc.) — no micro-agentes por gremio.
6. **`agent_documents` NO usa LLM** — lógica determinista basada en `current_phase`.
7. **Todos los workflows deben estar `Published` (active=true) en n8n** para funcionar en producción.
8. **Las credenciales se referencian por ID**, nunca hardcoded en el JSON commiteado.
9. **Las migraciones se numeran secuencialmente** (003, 004, ...) y son idempotentes (`IF NOT EXISTS`, `ON CONFLICT DO UPDATE`).
10. **El push a `origin/main` protege el trabajo** — hacerlo después de cada fase verde, no al final del día.

---

## 9. BASE DE DATOS — TABLAS CRÍTICAS

86 migraciones aplicadas (003 → 083). Última: `083_founder_plan_plus_trial_alert.sql`.

### Tablas centrales del negocio

`projects`, `clients`, `briefings`, `design_options`, `material_items`, `materials_catalog` (vector embedding), `regulatory_tasks`, `documents`, `cost_estimates`, `trade_requests`, `external_quotes`, `proposals` (+ `moodboard_data` + `render_data` + `public_token`), `proposal_acceptances`, `project_plans`, `approvals`, `memory_cases`, `tenants`, `collaborators`.

### Decisiones / trazabilidad EU AI Act

`decision_log` (inmutable, solo INSERT), `client_decisions` (anti scope-creep con `metodo_confirmacion` + `evidencia_url`), `architect_directives`, `agent_conversations`, `agent_executions` (+ `agent_executions_io`).

### Normativa

`normativa_knowledge`, `normativa_sources`, `municipal_templates` (procedimientos administrativos), `municipal_pgou_rules` (94 reglas seed top 5), `municipal_prechecks`.

### Billing (Fase G)

`subscription_plans` (4 tiers: starter/pro/equipo/founder), `tenant_subscriptions` (RLS por tenant, UNIQUE tenant_id), `stripe_events_log` (idempotencia), `tenant_usage` (counters mensuales), `trial_alerts_sent` (idempotencia alertas).

### Funciones SQL relevantes

- `get_tenant_billing_state(tenant_id) → jsonb` — estado completo billing
- `check_tenant_quota(tenant_id, resource) → jsonb` — middleware quota
- `find_expiring_trials() → setof` — escaneo trials próximos a expirar
- `current_tenant_id()`, `is_super_admin()`, `set_session_context()` — RLS helpers

---

## 10. ENDPOINTS API (referencia rápida)

Todos viven en `https://n8n-n8n.zzeluw.easypanel.host/webhook/api/v1/...` salvo el webhook Stripe que es `/webhook/stripe` (sin prefijo `api/v1`).

| Endpoint | Método | JWT |
|---|---|---|
| `/me` | GET | Sí |
| `/projects` | GET/POST | Sí |
| `/project-detail?id=` | GET | Sí |
| `/project-timeline?id=` | GET | Sí |
| `/project-deliverables?id=` | GET | Sí |
| `/studio/agents` | GET | Sí |
| `/studio/rooms` | GET | Sí |
| `/studio/feed?since=&limit=` | GET | Sí |
| `/studio/conversations?agent_name=&project_id=` | GET | Sí |
| `/studio/agent-chat` | POST | Sí |
| `/studio/pending-approvals` | GET | Sí |
| `/alerts/global?limit=` | GET | Sí |
| `/metrics/dashboard` | GET (cache 60s) | Sí |
| `/approval-decision` | POST | Sí |
| `/agents/decision-engine/evaluate` | POST | Sí |
| `/agents/client-translator/record-decision` | POST | Sí |
| `/agents/proposal/moodboard` | POST | Sí |
| `/agents/proposal/render` | POST | Sí |
| `/agents/municipal-precheck/run` | POST | Sí |
| `/agents/iee/approve` | POST | Sí |
| `/agents/rcd/approve` | POST | Sí |
| `/proposals/public?token=` | GET | **NO** (token = autorización) |
| `/proposals/public/accept` | POST | **NO** |
| `/billing/subscription` | GET | Sí |
| `/billing/checkout` | POST | Sí (roles architect/super_admin/owner) |
| `/billing/portal` | POST | Sí |
| `/webhook/stripe` | POST | **NO** (HMAC SHA256) |

---

## 11. CÓMO RESPONDER (estilo)

- **Concreto, accionable, sin teoría.** Si propones algo, da el SQL/JSON/comando exacto.
- **Lee el SQL real antes de tocar nada.** Las CHECK constraints, columnas y tipos cambian entre migraciones — no asumir.
- **Si el usuario te pide construir, construye.** Si te pide diseñar antes, presenta 2-3 opciones con tradeoffs en 2-3 frases por opción.
- **Si algo no existe en n8n 2.12.x**, propón alternativa con HTTP Request + Code node, NUNCA inventes nodos.
- **Genera JSON de workflows completos y funcionales**, no fragmentos. La validación se hace post-deploy con `n8n_get_workflow mode:structure` + ejecución real.
- **Verifica CADA cambio**. Después de `n8n_update_partial_workflow` siempre `n8n_get_workflow` para confirmar.
- **Smoke E2E real**. Los workflows se prueban con `node smoke_*.mjs` que mintean JWT propio (decode JWT es base64, sin firma) y disparan el endpoint real. No "lo dejo deployado y a ver qué pasa".
- **El usuario es Damián**, arquitecto técnico, fundador. Habla en español, prefiere precisión técnica sin condescendencia. Si te dice "sin esperarme" = autonomía total hasta que pegues con un blocker.

---

## 12. REFERENCIAS

- [`ESTADO_REAL_PROYECTO.md`](../ESTADO_REAL_PROYECTO.md) — Foto fiel + drift + riesgos
- [`ArquitAI.md`](./ArquitAI.md) — Documento maestro del producto (negocio, agentes, beneficios)
- `references/n8n_node_types.md` — Tipos de nodos compatibles 2.12.x
- `schemas/migrations/*.sql` — Source of truth del schema (no `mvp_schema.sql`, que es el inicial)
- Memory persistente Claude (`feedback_technical.md`) — gotchas n8n acumulados sesión a sesión
