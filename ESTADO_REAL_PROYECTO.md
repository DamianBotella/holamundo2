# ESTADO REAL DEL PROYECTO — ArquitAI (studio-multiagente)

> Documento generado leyendo BD live + filesystem + n8n live + Stripe API.
> **Última actualización: 2026-05-13 (cierre backend ADDENDUM 2).**
> Lo nuevo en esta sesión va al final, en §15. Lo de antes queda como historial.

---

## 1. Resumen ejecutivo

ArquitAI es una plataforma multi-tenant SaaS para estudios de arquitectura técnica y reformas, construida sobre n8n 2.12.x + Supabase + frontend React/PixiJS. Procesa proyectos desde captación hasta entrega usando ~30 agentes IA orquestados. Estado actual: **fase G+ cerrada, billing real funcionando en TEST mode**. Falta activar live mode en Stripe + alguna parte del frontend pública.

**Números reales hoy:**
- 86 migraciones SQL aplicadas (003 → 083)
- ~75-80 tablas en Supabase
- 145 workflows en disco + 22 endpoints API = **167 archivos JSON commiteados**
- **188 workflows activos en n8n live** (era 192, hoy 5 duplicados desactivados + 1 nuevo añadido)
- 199+ commits en main, 2 pendientes de push
- ~30 agentes funcionando

**Hoy se ha cerrado:**
- ✅ Riesgo #2 ESTADO_REAL anterior: workflows duplicados (5 desactivados)
- ✅ Riesgo #6: trial fundador sin alerta (founder pass + red triple de alertas)
- ✅ Stripe billing real con keys live, productos, webhooks HMAC verificados E2E
- ✅ Bug HMAC binary.data.data (cuerpo crudo del webhook se decodifica byte-a-byte)

---

## 2. Drift vs `studio-multiagente/CLAUDE.md`

| Lo que dice CLAUDE.md | Lo que hay en realidad |
|---|---|
| "11 agentes de IA" | **~30 agentes activos** + 5 desactivados antiguos |
| "16 tablas Supabase" | **~75-80 tablas** tras 86 migraciones |
| "17 workflows numerados 1-17" | **188 activos** en n8n live |
| "Anthropic Claude / OpenAI GPT-4" | Solo OpenAI gpt-4o en producción. Credencial Anthropic no usada |
| Schema único `mvp_schema.sql` | mvp_schema + 86 migraciones incrementales |
| Sin mención de billing/Stripe | **Billing Fase G operativo** (3 tiers, trial, webhook HMAC) |

**Veredicto:** `CLAUDE.md` describe MVP de abril 2026. El proyecto está 4-5 fases más adelante.

---

## 3. Workflows n8n — números reales

### Disco

- `workflows/*.json` (raíz): **145**
- `workflows/api/*.json`: **22**
- **Total disco: 167 archivos JSON**

### n8n live (https://n8n-n8n.zzeluw.easypanel.host)

- **188 workflows activos** (active=true, isArchived=false)
- **9 inactivos**: 5 duplicados que desactivé hoy + 4 archivados antiguos (METEORIHUELA, SUB-WORKFLOW AEMET, etc.)

### Drift estimado

```
n8n activos  188
- disco      167
============
+21 workflows en n8n sin commitear al repo
```

Sigue habiendo drift residual de workflows operativos (crons antiguos, util_admin_*_html, certifications). No bloqueante pero pendiente de sync.

### Duplicados resueltos hoy (estaban activos en n8n)

| Nombre | Mantenido | Desactivado |
|---|---|---|
| `agent_costs` | `g7RclDoz8AWfG0V6` (23 nodos, 2026-05-11) | `FhF8zelE1KehUD4Z` ❌ |
| `agent_trades` | `DtGdN5NEwlY4cnBp` (17 nodos, 2026-05-11) | `NHTZkeLUL7qUQPLG` ❌ |
| `agent_accessibility` | `GZR7o8F88BUj8pIX` (17 nodos, 2026-05-11) | `s7ctmUsITOWK7cRT` ❌ |
| `cron_collab_review` | `k8UfleXvdNLYyyGR` (09:45 + Manual Trigger) | `sJpNiWYCIlCvqB5i` ❌ |
| `cron_contract_followup` | `vKri6ogDAlFkYLbf` (09:50 + Manual Trigger) | `ZlzJpRwOnoG1altD` ❌ |

---

## 4. Agentes (~30 activos)

### Pipeline core (12)

| Agente | n8n ID | nodos |
|---|---|---:|
| `init_new_project` | `HzPLldZVJGFjKbuc` | 26 |
| `main_orchestrator` | `EF5lPbSNlmA3Upt1` | 92 |
| `agent_briefing` | `uq3GQWSdmoIV4ZdR` | 30 |
| `agent_design` | `sMGf7e8CSnsBQa1q` | 23 |
| `agent_regulatory` | `QbRMmQs0oyVHplgE` | 26 |
| `agent_materials` | `SOJW7SgCrJebLRP8` | 22 |
| `agent_documents` | `E5uOVocm8GwNH278` | 15 |
| `agent_costs` (nuevo) | `g7RclDoz8AWfG0V6` | 23 |
| `agent_trades` (nuevo) | `DtGdN5NEwlY4cnBp` | 17 |
| `agent_proposal` | `Mqx8S6nR6exbRY86` | 20 |
| `agent_planner` | `lSUfNw61YfbERI8n` | 15 |
| `agent_memory` | `gLxmy7M0UmC7Yzye` | 13 |

### Técnicos / regulatorios (10)

`agent_accessibility` `GZR7o8F88BUj8pIX`, `agent_safety_plan` `yRaR3V0j61R1g1jZ`, `agent_energy_assessor` `63XFqhlsg0d1cXav`, `agent_pathology` `I34LYGuiWTQ8WJCa`, `agent_normativa_refresh` `0Cyeaa85uLS7c8EE`, `agent_site_monitor` `DPy3FBugAbWP10BD`, `agent_financial_tracker` `LEspjLl6VEHPclPG`, `agent_contracts` `Abwnfh4BtHPU9lHg`, `agent_home_automation` `6f25BcR8LwNX2HQH`, `agent_certificate_generator` `OqOHU6Uc6FkVWPEu`, `agent_compliance_audit` `RzLYzuMiDWBPpo6y`.

### Fase C — 8 AUX + catalog_sync

`agent_client_concierge`, `agent_sketch_to_scale`, `agent_anomaly_detector`, `agent_collab_coordinator`, `agent_permit_tracker`, `agent_qc_checklists`, `agent_trade_comms`, `agent_aftercare`, `agent_catalog_sync` (embedding semántico).

### Fase A.2 / extras

`agent_grants_finder`, `agent_rcd`, `agent_iee`, `agent_telematic_filing`, `agent_onboarding`, `agent_onboarding_extract`.

### Fase D — decisión + propuesta visual

| Agente | ID | Estado |
|---|---|---|
| `agent_decision_engine` | `vQGsJMHVRqDoss0z` | ✅ verde E2E |
| `agent_client_translator` | `Nr3Bk2x73bXrq98u` | ✅ verde E2E 2 caminos |
| `agent_proposal_moodboard` | `7r3hVOHRaAFreBRy` | ✅ verde E2E (paleta+materiales+render_prompt EN) |
| `agent_proposal_render` | `3C0IyRkz48VnFdky` | ⚠️ **NO smoke-tested** con URL real |

### Fase E — pre-check normativa

| Agente | ID | Cobertura |
|---|---|---|
| `agent_municipal_precheck` | `SNG5lECKgZz3Twgd` | ✅ 5/5 ciudades verde (Madrid+BCN+VLC+SVQ+BIO, 94 reglas PGOU seed) |

---

## 5. Endpoints API REST (`workflows/api/`)

22 endpoints en disco + 1 webhook Stripe = **23 endpoints activos** total.

### Sesión / proyectos

| Endpoint | Método | ID |
|---|---|---|
| `/api/v1/me` | GET | `q93eHe6x7HHFbsuD` |
| `util_jwt_verify` (sub-workflow) | — | `Ysy8a7Aepl0WQo2P` |
| `/api/v1/projects` GET/POST | — | `niR5pZ1YW6uqagJQ` / `gOFqRbsrXiH3qNJi` |
| `/api/v1/project-detail` GET | `?id=` | `2iRTGufiBvpIIJDW` |
| `/api/v1/project-timeline` GET | `?id=` | `oAuhXaI289VoDKsK` |
| `/api/v1/project-deliverables` GET | — | `iPa8l2P68sKd0oJM` |

### Studio X7

| Endpoint | ID |
|---|---|
| `/api/v1/studio/agents` GET | `ZqYtxIzYmWNWlWIu` |
| `/api/v1/studio/rooms` GET | `4HFidZT6Y8QXdaOA` |
| `/api/v1/studio/feed` GET | `N0ZJQVJzBXuXzb80` |
| `/api/v1/studio/conversations` GET | `gP4T8k8fL9tsmGDU` |
| `/api/v1/studio/agent/chat` POST | `zjbVC1p7tW5MTJ6g` |
| `/api/v1/studio/pending-approvals` GET | `WGgPJz5OEMxZPy90` |

### Métricas / aprobaciones

`/api/v1/alerts/global` `DuiVLi0Q4TpxI810`, `/api/v1/metrics/dashboard` `yZqXPGF0dGptHw03`, `/api/v1/approval-decision` `Tr8dEYLe6wA9MW1a`, `/api/v1/agents/iee/approve` `jDWcxvh1Du5PjsIr`, `/api/v1/agents/rcd/approve` `gAi3bbbHU9U1iYD4`.

### Agentes Fase D

| Endpoint | ID |
|---|---|
| `/api/v1/agents/decision-engine/evaluate` POST | `vQGsJMHVRqDoss0z` |
| `/api/v1/agents/client-translator/record-decision` POST | `Nr3Bk2x73bXrq98u` |
| `/api/v1/agents/proposal/moodboard` POST | `7r3hVOHRaAFreBRy` |
| `/api/v1/agents/proposal/render` POST | `3C0IyRkz48VnFdky` |
| `/api/v1/agents/municipal-precheck/run` POST | `SNG5lECKgZz3Twgd` |
| `/api/v1/proposals/public` GET (sin JWT) | `zCGPAolJN3HL19Qi` |
| `/api/v1/proposals/public/accept` POST (sin JWT) | `OtVoFzIWYwBNWJLX` |

### **Billing (Fase G) — TODO operativo en TEST mode**

| Endpoint | ID | Estado |
|---|---|---|
| `/api/v1/billing/subscription` GET | `gFlcNWjWbIASn52h` | ✅ devuelve tier/limits/usage real |
| `/api/v1/billing/checkout` POST | `H5DE9FcG6xDR7M3Y` | ✅ crea Stripe Checkout Session real → URL pago |
| `/api/v1/billing/portal` POST | `CnnZmAywzVUE5jD5` | ✅ crea Customer Portal Session real |
| `/webhook/stripe` POST | `eBHpiboasXzLzFDV` | ✅ HMAC SHA256 verde, 19 nodos (incluye handler `trial_will_end`) |

---

## 6. Base de datos Supabase

### Migraciones aplicadas: **86 numeradas** + `apply_phase_a2.sql`

Última: **`083_founder_plan_plus_trial_alert.sql`** (aplicada hoy, 2026-05-12)

Recorrido:
- 003-018: schema base + permits + pathology + accessibility
- 019-035: contratos, GDPR, certificados, security hardening, RLS, PII encryption
- 036-053: health score, multi-tenant, RLS enable, auth triggers
- 054-058: orchestrator locks, studio_view, layout v7
- 060-074: agent_conversations, materials_catalog (vector), grants, iee, municipal_templates, architect_directives, roi_metrics, decision_log, client_decisions, rcd_studies
- 075: UNIQUE parcial sku materiales
- **076**: proposal moodboard + render + public_token + acceptance
- **077-081**: PGOU rules — Madrid 21, BCN 19, VLC 18, SVQ 18, BIO 18 = **94 reglas**
- **082**: Stripe billing — subscription_plans (3 tiers) + tenant_subscriptions + stripe_events_log + tenant_usage + funciones get_tenant_billing_state, check_tenant_quota
- **083** (HOY): plan founder + trial_alerts_sent (idempotente) + find_expiring_trials() helper + damian-mtnz movido a founder/active

### Estado actual `damian-mtnz` (consulta live)

```json
{
  "tier": "founder",
  "status": "active",
  "is_trialing": false,
  "trial_ends_at": null,
  "limits": {
    "max_projects": -1, "max_users": -1, "max_ai_tokens": -1,
    "max_agents": -1, "max_agent_executions": -1, "support": "internal"
  },
  "stripe_customer_id": "cus_UVJOPoHWuIV3TP",
  "stripe_subscription_id": "sub_1TWIlu5Z4Gk7eDZVg9LexUWd"
}
```

Tu acceso es **permanente, sin límites, sin trial**. `check_tenant_quota()` siempre `allowed=true`.

### Tablas críticas (no exhaustivo)

**Negocio:** `projects`, `clients`, `briefings`, `design_options`, `material_items`, `materials_catalog` (vector embedding), `regulatory_tasks`, `documents`, `cost_estimates`, `trade_requests`, `external_quotes`, `proposals` (+ `moodboard_data` + `render_data` + `public_token`), `proposal_acceptances`, `project_plans`, `approvals`, `memory_cases`, `tenants`, `collaborators`.

**Decisiones / EU AI Act:** `decision_log` (inmutable), `client_decisions` (con metodo_confirmacion + evidencia), `architect_directives`, `agent_conversations`, `agent_executions`.

**Normativa:** `normativa_knowledge`, `normativa_sources`, `municipal_templates` (procedimientos), `municipal_pgou_rules` (94 reglas top 5), `municipal_prechecks`.

**Billing:** `subscription_plans` (3 tiers + founder), `tenant_subscriptions` (RLS), `stripe_events_log` (idempotencia), `tenant_usage`, **`trial_alerts_sent`** (idempotencia alertas, nueva hoy).

**Funciones SQL:**
- `get_tenant_billing_state(tenant_id) → jsonb`
- `check_tenant_quota(tenant_id, resource) → jsonb`
- `find_expiring_trials() → setof` (NUEVA hoy)
- `current_tenant_id()`, `is_super_admin()`, `set_session_context()` (RLS helpers)

---

## 7. Stripe — configuración LIVE en TEST mode

### Productos creados en Stripe Dashboard (cuenta de Damián)

| Tier | EUR/mes | Stripe Product | Stripe Price |
|---|---:|---|---|
| Starter | 49 | `prod_UVIvJ3wnp6qZGs` | `price_1TWIJm5Z4Gk7eDZV1xhBkSux` |
| Pro | 149 | `prod_UVIv3evLhX42bB` | `price_1TWIJn5Z4Gk7eDZVl8LaCZhU` |
| Equipo | 299 | `prod_UVIv0zG5T4FTrd` | `price_1TWIJq5Z4Gk7eDZVoJQiIZlq` |
| Founder | 0 | — (no se vende) | — |

### Webhook Stripe configurado

- URL: `https://n8n-n8n.zzeluw.easypanel.host/webhook/stripe`
- ID Stripe: `we_1TWIdS5Z4Gk7eDZVmzmtXiG3`
- API version: `2026-04-22.dahlia`
- Events: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`

### Keys en `system_config`

- `stripe_secret_key`: `sk_test_51TWI195Z4Gk7eDZVs...` ✅ real
- `stripe_publishable_key`: `pk_test_51TWI195Z4Gk7eDZVR...` ✅ real
- `stripe_webhook_secret`: `whsec_gv0x3gTWdK8XxFBrViouBNNx5PQqtDRV` ✅ real

### Smoke E2E real ejecutado hoy

1. POST `/billing/checkout` tier=starter → Stripe creó checkout session
2. Usuario pagó con tarjeta test `4242 4242 4242 4242`
3. Stripe creó `cus_UVJOPoHWuIV3TP` + subscripción `sub_1TWIlu...` con trial 14 días
4. **Webhook recibió 4 eventos → 4 fueron rechazados con `INVALID_SIGNATURE`** (bug HMAC)
5. Diagnóstico: rawBody reconstruido con `JSON.stringify` no coincidía con bytes Stripe
6. Fix: leer `$('Webhook').first().binary.data.data` base64, decodear UTF-8
7. Trigger artificial `customer.subscription.updated` vía API → webhook verde
8. BD `tenant_subscriptions` actualizada correctamente

### Red de seguridad triple del trial (cerrada hoy)

1. **Founder pass**: damian-mtnz es `tier=founder, status=active` permanente. Mientras tú seas el único usuario, no expira nunca.
2. **Cron diario 10:00** `cron_trial_expiry_alert` (`yasBFGZ0hZuHnjPF`, 12 nodos): escanea `find_expiring_trials()` → email cada tenant 7d/3d/1d antes. Excluye founder.
3. **Webhook Stripe `trial_will_end`**: handler dedicado en `webhook_stripe` envía email 3d antes (canal `will_end_stripe`). Idempotencia vía `trial_alerts_sent` UNIQUE.

---

## 8. Studio X7 frontend (`foxhole-ui`)

### Stack

- Vite + React + TypeScript
- PixiJS v8 (isométrico)
- TanStack Query (cache + reactividad)
- Supabase Realtime
- Tailwind

### Componentes `src/studio/` (sin cambios desde ayer)

```
ActivityFeed.tsx        AgentChatPanel.tsx     ApprovalPanel.tsx
ProjectSelector.tsx     StudioAgent.tsx        StudioCanvas.tsx
StudioFurniture.tsx     StudioRoom.tsx ⚠️       StudioSidebar.tsx
agentPosition.ts        drawRoomWalls.ts       furnitureRegistry.ts
iso.ts                  palette.ts             pixiSingleton.ts
spriteRegistry.ts
```

**Issues abiertos:**
- `StudioRoom.tsx` modificado en working copy (sin commitear)
- `roomFloors.ts` en `src/studio/data/` untracked (nunca commiteado)
- **El frontend no tiene UI todavía para `/billing/*`** — los endpoints existen pero no hay página de pricing ni botón "Gestionar suscripción"

### Hooks (`src/studio/hooks/`)

`useActiveProject.ts`, `useActivityFeed.ts`, `useAgentChat.ts`, `usePendingApprovals.ts`, `useProjectDeliverablesRealtime.ts`, `useStudioAgents.ts`, `useStudioRooms.ts`, `useTenantId.ts`.

**Pendiente añadir:** `useBillingSubscription.ts` (consume `/api/v1/billing/subscription`).

---

## 9. Skills Claude Code instalados (nuevos hoy)

Vía `npx skills add -y https://docs.stripe.com`:

| Skill | Propósito |
|---|---|
| `stripe-best-practices` | Decisiones de integración Stripe (Checkout vs PaymentIntents, Connect, webhooks, restricted keys) |
| `stripe-projects` | Provisionar servicios externos via projects.dev |
| `upgrade-stripe` | Migrar versiones de API/SDK Stripe |

Instalados en `.agents/skills/` (untracked, no commiteado al repo).

También presentes pero no commiteados: `.claude/` (settings locales), `skills-lock.json`.

---

## 10. Estado por fase

| Fase | Estado | Commit |
|---|---|---|
| A.1 pipeline base | ✅ 100% | varios pre-B70 |
| A.2 catalog embedding | ✅ verde E2E | — |
| A.3-A.5 hardening multi-tenant + RLS + Realtime | ✅ aplicado | mig 049-058 |
| B agentes técnicos pre-launch | ✅ activos smoke | — |
| C 12 agentes nuevos (4 CORE + 8 AUX) | ✅ 13/13 verde E2E | `03703f1` |
| C drift fix 4 endpoints | ✅ recuperados | `eb3430b` |
| D.1 decision_engine | ✅ verde | `b6e92b1` |
| D.2 client_translator anti scope-creep | ✅ verde 2 caminos | `fd9a974` |
| D.3 propuesta visual moodboard+render+aceptación | ⚠️ 3/4 piezas (render sin smoke real) | `0ae15ce` |
| E.1 PGOU Madrid 21 reglas | ✅ verde | `d1810db` |
| E.2 PGOU BCN+VLC+SVQ+BIO 73 reglas | ✅ 4/4 ciudades verde | `6f46f29` |
| G Stripe billing scaffolding (placeholders) | ✅ 6/6 smoke | `95a7fb1` |
| **G live (hoy)** | ✅ keys+productos+webhook reales, HMAC fix | `c9dcb60` |
| **G+ (hoy)** | ✅ founder pass + cron alertas + webhook trial_will_end | `c9a4814` |

**Commits totales main:** ~202. **Push pendiente:** 2 commits (c9dcb60 + c9a4814).

---

## 11. Riesgos críticos (rankeados, comparados con ayer)

| # | Riesgo | Estado ayer | Estado hoy |
|---|---|---|---|
| 1 | 74 commits sin pushear | 🔴 abierto | ✅ pushed `bf82abf..95a7fb1` ayer; quedan 2 commits hoy de buffer |
| 2 | Workflows duplicados activos | 🔴 abierto | ✅ **CERRADO** (5 desactivados) |
| 3 | Stripe en placeholders | 🔴 abierto | 🟡 **TEST mode operativo**, live mode pendiente |
| 4 | CLAUDE.md falso | 🔴 abierto | 🔴 sigue abierto (no reescrito) |
| 5 | Render mnml.ai sin probar | 🔴 abierto | 🔴 sigue abierto |
| 6 | Trial fundador sin alerta | 🔴 abierto | ✅ **CERRADO** (founder + red triple alertas) |
| 7 | Webhook Stripe rawBody HMAC | 🟡 sospechoso | ✅ **CERRADO** (binary.data.data fix verde) |

### Riesgos nuevos identificados hoy

8. **Stripe sigue en TEST mode**: las suscripciones reales requieren `sk_live_*` + `whsec_*` de live mode + activación KYC de la cuenta Stripe.
9. **Frontend sin UI billing**: los endpoints existen pero no hay página de pricing en `foxhole-ui`. Sin esto, ningún cliente real puede iniciar checkout.
10. **`billing_*_url` apuntan a `arquitai.studio` que no existe**: tras pagar Stripe redirige a un dominio no resuelto. UX rota.
11. **Drift residual 21 workflows**: workflows operativos en n8n no commiteados al repo (mismo riesgo que detectaste en versión anterior, no resuelto).

---

## 12. Lo que NO existe / NO funciona

### Funcionalidad NO probada en real

- **`agent_proposal_render` mnml.ai**: workflow deployed pero nunca llamado con URL real. Spec del polling inferida. Primera ejecución real puede romperse.
- **Stripe live mode**: solo TEST configurado. Para cobrar dinero real requiere KYC en Stripe + repetir creación de productos/precios en live + nuevo webhook + UPDATE system_config.

### Documentación obsoleta

- `studio-multiagente/CLAUDE.md` describe MVP de abril 2026 (11 agentes / 16 tablas). **No reescrito en esta sesión.**
- `docs/arquitectura.md`, `docs/modelo_datos.md`, `docs/mapa_workflows.md`, `docs/agentes.md`, `docs/plan_fases.md` — no auditados.

### Frontend incompleto

- Sin página de pricing/checkout
- Sin botón "Gestionar suscripción" → `/billing/portal`
- Sin banner de trial en sidebar
- `arquitai.studio` (dominio de redirect post-pago) no existe

### Tests automatizados

Cero. Smoke tests = scripts manuales `*.mjs` invocados a mano.

---

## 13. Variables de entorno + credenciales

### MCP / Claude Code (`.mcp.json`)

Solo n8n MCP configurado.

### Credenciales en n8n

| Credencial | ID | Uso |
|---|---|---|
| Postgres Supabase | `cfxNZdzy0NB3xkYC` | Todas las queries SQL |
| Gmail damian2botella | `cIma8ntTjZvIfU3H` | Notificaciones + aprobaciones |
| Google Drive damian2botella | `VLObOrfmQGpS5Lb0` | Archivos de proyecto |
| Google Docs | `6NK9u2hvm1UUdoVu` | EBSS, etc. |
| Google Sheets damian2botella | `mun4KcJi7kZVMHI4` | Sheets export |
| OpenAI "orquestador ArquiAI" | `gE1jXO133xEHS5JJ` | LLM calls |

### `system_config` (estado hoy)

| Key | Estado |
|---|---|
| `architect_email` | ✅ damian2botella@gmail.com |
| `webhook_api_key` | ✅ |
| `mnml_api_key` | ✅ real |
| `stripe_secret_key` | ✅ **`sk_test_...` real** |
| `stripe_publishable_key` | ✅ **`pk_test_...` real** |
| `stripe_webhook_secret` | ✅ **`whsec_...` real** |
| `billing_success_url`, `billing_cancel_url`, `billing_portal_return_url` | ⚠️ apuntan a `arquitai.studio` (dominio no existe en producción) |
| `public_proposal_base_url` | ⚠️ idem |

---

## 14. Top 5 acciones inmediatas

1. **`git push origin main`** — 2 commits pendientes (c9dcb60, c9a4814). Protege el trabajo Stripe + founder.
2. **Reescribir `studio-multiagente/CLAUDE.md`** desde cero con foto real. Sin esto, próximas conversaciones siguen construyendo encima de premisa obsoleta.
3. **Resolver `arquitai.studio`** o cambiar `billing_*_url` en `system_config` a un dominio real. Si no, tras pagar el cliente ve 404.
4. **Construir UI de billing en `foxhole-ui`**: página pricing + botón "Gestionar suscripción". Endpoints listos, falta el lado cliente.
5. **Probar `agent_proposal_render`** con una imagen real antes de demos a clientes — la primera ejecución real puede romperse y descubrirlo en vivo es caro.

---

## 15. Para Claude Opus que continúe

**Contexto en una frase:** ArquitAI tiene 30 agentes IA orquestados en n8n para automatizar proyectos de arquitectura, billing SaaS funcional en Stripe TEST, founder con acceso permanente, falta UI cliente + live mode + reescribir CLAUDE.md.

**Lo que NO está documentado pero existe:**
- Migración 083 acaba de añadir plan `founder` (limits unlimited, no se vende, oculto del catálogo público con `is_active=false`)
- Helper SQL `find_expiring_trials()` para escaneo masivo
- Webhook Stripe ahora tiene fork dedicado para `trial_will_end` → email + log
- `trial_alerts_sent` con UNIQUE constraint evita spam (mismo aviso 2 veces el mismo día)

**Bugs n8n 2.12.x que volverán a aparecer** (todos documentados en `memory/feedback_technical.md`):
- `require('crypto')` bloqueado en task runners
- `URLSearchParams` no definido en Code nodes
- `fetch` no definido en Code nodes (usar httpRequest node)
- Ternarios `$('Node').first() ? ... : null` revientan si el nodo no se ejecutó (usar `isExecuted` + Code node)
- Webhook rawBody se accede via `$('Webhook').first().binary.data.data` (base64), NO `$json.body` reconstruido con `JSON.stringify`
- HTTP Request typeVersion 4.2 (NO 4.4)
- Google Sheets update requiere campo `range`

**Si Claude Opus necesita ejecutar Stripe live mode:**
1. En Stripe Dashboard activar live mode (KYC: cuenta bancaria + verificación identidad, 1-3 días)
2. Crear 3 productos + 3 prices en live (mismo script que TEST: API key `sk_live_...`)
3. Configurar webhook live apuntando al mismo `/webhook/stripe`
4. UPDATE `system_config`:
   - `stripe_secret_key = 'sk_live_...'`
   - `stripe_publishable_key = 'pk_live_...'`
   - `stripe_webhook_secret = 'whsec_LIVE_...'`
5. UPDATE `subscription_plans.stripe_price_id` con los IDs live
6. Smoke E2E con tarjeta real propia (cargo de 49€, refund inmediato desde dashboard)

---

## 15. Cierre del ADDENDUM 2 — 2026-05-13

Tras la sesión del 2026-05-12 (Stripe billing live + founder pass + alertas) llegó el `ADDENDUM 2 INSTRUCCIONES CLAUDE CODE` que cierra el pre-launch comercial. Resumen rapidísimo:

**Lo que está hecho (backend ADDENDUM 2):**

| Bloque | Commit | Contenido |
|---|---|---|
| Paso 0 — Migraciones 084-088 | `17be613` | `activity_log` con tenant_id + RLS + `agent_registry` view; `architect_directives` extension; `municipal_pgou_rules` con embedding pgvector + `search_pgou_rules()`; `municipal_onboarding_queue`; 5 vistas BI |
| Bloque 5 — `agent_normativa_fetch` | `ba7c1db` | Onboarding automático de municipios. LLM-only (sin Jina) hasta tener key Jina/Tavily. Auto-trigger en `api_projects_create`. Smoke OK: Tres Cantos 14 reglas en 42s |
| Bloque 6 — RAG normativa | `b138c5b` | 108 reglas (94 seed + 14 Tres Cantos) con embedding text-embedding-3-small. `POST /api/v1/regulatory/ask` con citas + confianza. Smoke ascensor=alta, fachada=media |
| Bloque 7 — Dashboard BI | `98f0dd2` | `GET /api/v1/bi/dashboard` (6 widgets en 1 CTE) + `BusinessIntelligence.tsx` con sparkline SVG inline. Integrado en DashboardPage |
| Bloque 4-backend — directive | `c95d41a` | `POST /api/v1/studio/agent/directive` registra directiva en `architect_directives` + `activity_log` con `message_type='directive'`. Smoke 201 in <500ms |
| Bloque 3 SQL trigger | `80f80f2` | Función `agent_action_to_natural()` + triggers AFTER INSERT/UPDATE en `agent_executions`. Cubre 35 agentes con texto natural ES sin tocar workflows. **Mig 089 aplicada** |
| Bloque 4.1 system prompt | `2139162` | `studio_agent_chat` con system prompt enriquecido: display_name, room_display_name (JOIN studio_rooms), last_action_text (subquery activity_log <2h), 8 reglas estrictas (es-ES, 1a persona, no inventar normativa, etc.) |

**Lo que está pausado (UI estudio):**

`/studio` apagado en commit `2759839` con placeholder "EN REDISEÑO". Razón: los fondos Gemini rectangulares fotorrealistas no encajan con el sistema de rombos isométricos del estudio. Reactivar requiere:
1. `git revert 2759839` → restaura Bloques 1+2 visuales (AgentFigure, tweening, bobbing).
2. Rediseñar carga de fondos con `PIXI.Mesh` warp 4-vértices.
3. **Bloque 3-UI** — construir `ActivitySidebar.tsx` (la data fluye sin trabajo backend extra gracias a mig 089).
4. **Bloque 4-UI** — `AgentChatPanel` con botón "Aplicar como directiva" (endpoint ya existe) + `AgentCoordination.tsx` panel + INSERTs `message_type='coordination'` en `main_orchestrator` (92 nodos, riesgo gotcha 6.4).

**Números actualizados a 2026-05-13:**

- **89 migraciones SQL aplicadas** (003 → 089)
- **192 workflows activos en n8n live** + 193 en disco. **Drift = 0**
- **108 reglas PGOU embedded** en `municipal_pgou_rules`
- **35 agentes mapeados** a texto natural ES (+ fallback genérico) via trigger SQL
- **5 endpoints nuevos pre-launch**: `/agents/normativa-fetch/run`, `/regulatory/ask`, `/bi/dashboard`, `/studio/agent/directive`, `/studio/agent-chat` (enriquecido)

**Pre-launch comercial — qué queda:**

1. **Stripe LIVE mode** (KYC + cuenta bancaria + repetir productos/prices/webhook con `sk_live_...`).
2. **Dominio prod** (`arquitai.studio`) + cambiar `billing_*_url` en `system_config`.
3. **Paquete UI estudio final** (4 sub-tareas listadas arriba).
4. `agent_proposal_render` con URL mnml.ai real (smoke pendiente desde Fase D.3).

*Fin. Generado leyendo BD live + filesystem + n8n REST API + Stripe API.*
