# Plan pre-interfaz Foxhole

**Visión**: la interfaz será **tipo videojuego Foxhole** pero adaptada a un estudio de arquitectura técnica:
- Vista panorámica del **portfolio de proyectos** (tipo "mapa global").
- Click en un proyecto → "**zoom táctico**" con todas las fases, agentes, alertas y logística (oficios, materiales, facturación) en pantalla.
- **Indicadores visuales** de estado en tiempo real (alertas compliance, consultations pendientes, patologías detectadas, fases bloqueadas).
- Drill-down: proyecto → fase → agente → output específico.
- Densidad alta de información, presentación clara y operativa.

**Antes de empezar a construir UI**, el backend tiene que estar 100% sólido. Cualquier rotura en el backend después del freeze obliga a rehacer la UI.

---

## Estado actual al cierre B28 (2026-04-29)

✅ **Hecho**:
- Schema v1 FROZEN (45 migrations aplicadas, sin drift).
- Mecanismo anti-drift implementado (`applied_migrations` + `check_migration_drift.py`).
- 10/11 agentes LLM con studio_profile injection activa.
- Reality Check pasado, 2 bugs críticos arreglados (B27).
- Onboarding chat funcionando (B20-21).
- Cron de monitoreo desbloqueado (B27).
- Migrations 044 + 045 + 046 aplicadas y verificadas en BD.

⏳ **Pendiente antes de UI** (ver bloques abajo).

---

## Plan de sesiones — orden estricto

### Sesión X1 — E2E real del pipeline (~5h) ✅ COMPLETADO (2026-04-29 / B30-B34)

**Estado**: 🎉 **CERTIFICADO 13/13 agentes E2E con outputs reales en BD.**

**Evidencia**: [`docs/e2e_evidence_FINAL_2026-04-29.md`](e2e_evidence_FINAL_2026-04-29.md).

**Project stub usado**: `0a53d09f-d8f7-444a-a074-42a3305ef49b` ("Reforma DEMO X1v2 E2E B30").
**Phase final**: `planning_done`. **Duración E2E**: ~50min desde init_new_project hasta agent_memory.

**Outputs persistidos**: briefings(1) · design_options(3) · regulatory_tasks(20) · cost_estimates(1) · proposals(3) · project_plans(1) · memory_cases(1) · safety_plans(1) · accessibility_audits(2) · activity_log(30+) · agent_executions(30+) · 6 carpetas Drive.

**Bugs descubiertos+arreglados durante X1** (9 total): migration 042 sin aplicar · util_notification array vacío · check_rate_limit duplicada · SP injection paréntesis x3 · task_type constraint · exec_status sync dual · proposals_status_check (use 'accepted') · executeWorkflow input passthrough.

**Migrations aplicadas en X1**: 042, 044, 045, 046, 047, 048 (7 migrations en jornada).

**Veredicto**: 🟢 **READY for first customer pilot** — caveats documentados en evidence final (Wait nodes en aprobaciones humanas requieren clientes reales para validarse end-to-end; mat_count=0 mystery pendiente).

---

### Sesión X2 — Auditoría main_orchestrator + cleanup workflows (~3h) 🟡 — AUDIT ESTÁTICO HECHO (2026-05-01)

**Estado**: 📋 audit estática completada en [`docs/x2_orchestrator_audit_2026-05-01.md`](x2_orchestrator_audit_2026-05-01.md). Pendiente audit sobre versión producción cuando MCP vuelva.

**Hallazgos identificados del JSON repo (MVP v1, 19 nodos)**:
- 🔴 PA-1: `pending_approvals` bloquea TODAS las fases globalmente (debe ser scoped por fase).
- 🔴 PA-2: Bug 9 X1 (executeWorkflow input passthrough) probablemente afecta 12/13 agentes en producción.
- 🟡 PA-3: sin error handling en sub-workflow calls → cliente cuelga si agente falla.
- 🟡 PA-4: race condition con webhooks simultáneos.
- 🟡 PA-5: INSERT activity_log no usa columna `details` jsonb (migration 045 no aprovechada).
- 🟢 PA-6: drift severo repo (19 nodos) vs producción (87 nodos) — el repo no es source-of-truth.

**Qué falta** (cuando MCP vuelva):
1. `n8n_get_workflow({mode:"full"})` del orchestrator real → snapshot a `workflows/main_orchestrator.PROD_<fecha>.json`.
2. Aplicar el checklist documentado (sección 4 del audit doc) sobre los 87 nodos.
3. Fixes en orden: PA-2 → PA-3 → PA-1 → PA-5 → PA-4.
4. Cleanup workflows abandonados (`active=true` sin ejecuciones >30d).
5. Cron `cron_workflow_audit` semanal para evitar drift PA-6.

**Producto**: pipeline limpio, sin nodos orfans, con quality gates claros.

---

### Sesión X3 — Multi-tenant real con RLS Postgres (~12-15h) 🔴 BLOQUEANTE — DISEÑO DRAFT (2026-05-01)

**Estado**: 📐 diseño completo en [`docs/x3_multi_tenant_design.md`](x3_multi_tenant_design.md) + 3 migrations en `.draft` (no aplicadas).

**Por qué bloquea UI**: la UI necesita saber qué estudio está logueado en cada request. Hoy es mono-tenant. Si construyes UI mono-tenant y luego retrofiteo multi-tenant, rehaces 80% de la UI.

**Qué se ha diseñado**:
1. `049_multi_tenant_extend.sql.draft` — añade `tenant_id` a 8 tablas raíz (studio_profile, onboarding_sessions, supplier_catalog, project_notes, contract_templates, certificates, contracts, invoices). Backfill al tenant baseline.
2. `050_rls_enable.sql.draft` — habilita RLS en 30+ tablas. Estrategia híbrida: tablas raíz con `tenant_id` directo, tablas pipeline (briefings, design_options, etc.) heredan via subquery a `projects`. Helpers `set_tenant_context()`, `resolve_tenant_from_project()`, `is_super_admin()`.
3. `051_user_profiles_auth.sql.draft` — tabla `user_profiles` linker auth.users <-> tenants. Roles architect/colaborador/super_admin. Vista `v_my_profile`. (Se aplica en X4).

**Pendiente para ejecutar**:
- Auditar y actualizar 13 agentes + 5 utils + 30+ crones para usar `set_tenant_context()` al inicio (4-6h).
- Aplicar 049 → smoke test → aplicar 050 → smoke test (3h).
- Crear 2º tenant test + verificar aislamiento (1h).
- Documentar `docs/e2e_evidence_x3_<fecha>.md`.

**Producto**: backend multi-tenant real. Ya soporta varios estudios sin retrofit.

---

### Sesión X4 — Auth real con Supabase Auth (~6-8h) 🔴 BLOQUEANTE — DISEÑO COMPLETO (B38)

**Estado**: 📐 diseño completo en [`docs/x4_auth_design.md`](x4_auth_design.md) + migration `053_auth_triggers.sql.draft`. Workflows pendientes de crear (necesita MCP).

**Decisiones tomadas**:
- Supabase Auth nativo (no custom auth en n8n).
- Auth Hook server-side inyecta `tenant_id` + `role` como custom claims firmados.
- Validación JWT vía HTTP a `/auth/v1/user` (más simple) o sub-workflow `util_jwt_verify`.
- Roles: `architect` (full), `colaborador` (read-only), `super_admin` (cross-tenant Damián).
- Signup por invitación únicamente (`pending_invitations` + magic link).

**SQL listo (en draft)**:
- Migration 051 (user_profiles + v_my_profile) — pendiente aplicar tras X3.
- Migration 053 (pending_invitations + trigger on_auth_user_created + custom_access_token_hook) — nueva.

**Workflows n8n pendientes** (cuando MCP vuelva):
- `util_jwt_verify`, `api_auth_login`, `api_auth_logout`, `api_auth_refresh`, `api_auth_invite`, `login_html`.

**Roadmap implementación** (Fase A-E, ~7h):
- Pre-req: aplicar 051+053, habilitar email auth en Supabase.
- Setup: registrar `custom_access_token_hook` en Supabase Dashboard manualmente.
- Workflows: 6 archivos JSON.
- UI mínima HTML: form login antes de Foxhole.
- Smoke test: login → /me → /projects con 2 tenants → verify aislamiento.

**Producto**: backend con auth + sesiones + roles. Ya seguro.

---

### Sesión X5 — API REST contractual encima de n8n (~10-12h) 🔴 BLOQUEANTE

**Por qué último antes de UI**: la UI consume esta API. Si la API es estable y contractual, la UI puede construirse con confianza.

**Qué hacer**:
1. Diseñar OpenAPI 3.1 spec (`docs/api_v1.yaml`) con los endpoints que la UI necesita:
   - `GET /me` → perfil usuario + tenant.
   - `GET /studio-profile` → perfil del estudio activo.
   - `GET /projects?phase=...&q=...` → lista paginada.
   - `GET /projects/:id` → detalle con todas las relaciones (briefing, design, regulatory, etc.).
   - `GET /projects/:id/timeline` → eventos cronológicos del activity_log.
   - `GET /projects/:id/agent-runs` → ejecuciones de agentes.
   - `GET /projects/:id/alerts` → consultations pendientes + warnings + tareas críticas.
   - `POST /projects` → crear proyecto.
   - `POST /projects/:id/approve/:approval_id` → aprobar/rechazar.
   - `GET /trades` → oficios y trade_quotes.
   - `GET /materials/:project_id` → materiales del proyecto.
   - `GET /alerts/global` → feed de alertas del tenant.
   - `GET /metrics/dashboard` → KPIs del tenant (proyectos activos, facturación, etc.).
2. Implementar cada endpoint como un workflow n8n con webhook + Auth check + Postgres + JSON response.
3. Crear `vistas SQL` (migration 049) read-only que la UI consume directamente sin lógica adicional. Ejemplo: `v_project_summary`, `v_agent_run_status`.
4. Documentar contratos en `docs/api_v1.md`. **A partir de aquí, los endpoints NO cambian sin nueva versión.**
5. Postman collection / curl examples para cada endpoint.
6. Tests automatizados básicos (cron diario que llama cada endpoint y verifica shape).

**Producto**: contrato API estable. La UI puede construirse contra él sin tocar n8n.

---

### Sesión X6 — Empezar interfaz Foxhole (~5-6 semanas full-time) — DISEÑO COMPLETO (B40)

**Estado**: 📐 diseño completo en [`docs/x6_foxhole_ui_design.md`](x6_foxhole_ui_design.md). Implementación pendiente cuando X1-X5 cerrados.

**Decisiones tomadas**:
- 2 vistas principales: Mapa Global (`/`) + Zoom Táctico (`/projects/{id}`).
- Stack: React 19 + Vite + TanStack Router/Query + Tailwind + shadcn/ui + lucide + recharts.
- Paleta oscura técnica (verdes oliva Foxhole, ámbar warning, rojo critical).
- Tipografía Inter Variable + JetBrains Mono.
- 14 tabs en Zoom Táctico (Resumen, Briefing, Diseño, Normativa, Materiales, Costes, Oficios, Propuesta, Plan, Seguridad, Accesibilidad, Timeline, Alertas, Logs).

**Roadmap M1-M5** (~27 días):
- M1 Foundation (5d): setup + login + tokens.
- M2 Mapa Global (5d): KPIs, PhaseColumnView, ProjectCard, filtros.
- M3 Zoom Táctico (7d): PhasePipeline + 4 tabs prioritarias.
- M4 Tabs restantes (7d): 10 tabs adicionales + acciones.
- M5 Polish + ship (3d): skeleton, error boundaries, deploy.

**Open questions para Damián** documentadas en sec. 10 (dominio, tenant switch, mobile read-only, tema claro, i18n, branding).

---

## Tabla resumen

| # | Sesión | Esfuerzo | Bloqueante UI | Estado | Resultado |
|---|---|---|---|---|---|
| X1 | E2E real | 5h | 🔴 | ✅ B30-B34 | Confianza certificada — 13/13 agentes E2E |
| X2 | Orchestrator audit + cleanup | 3h | 🟡 | 📋 audit estático hecho (B36) | Pipeline limpio |
| X3 | Multi-tenant + RLS | 12-15h | 🔴 | 📐 diseño DRAFT (B35) | Backend multi-cliente |
| X4 | Auth + sesiones | 6-8h | 🔴 | 📐 diseño completo (B38) | Login + roles |
| X5 | API REST contractual | 10-12h | 🔴 | 📐 contract v0.2 + 4 workflows pre-built (B38) | Contrato estable para UI |
| X6+ | Foxhole UI | 5-6 semanas | — | 📐 diseño completo (B40) | Producto vendible visualmente |

**Total backend pre-UI**: ~36-43h.
**Total con UI completa**: ~80-120h adicionales.

---

## Reglas de oro durante todo este recorrido

1. **No empezamos UI sin X5 cerrado.** Construir UI sobre API inestable es perder horas.
2. **Cada sesión que toca schema → nueva migration + INSERT en applied_migrations**. Sin excepciones.
3. **Cada sesión cierra con `python check_migration_drift.py --check`** pasando OK.
4. **Cada sesión actualiza este documento** con el estado real (qué se hizo, qué quedó pendiente).
5. **Auditorías documentadas**: cada sesión grande cierra con un `docs/<sesion>_evidence.md` con outputs reales.
6. **Si algo se rompe en producción mientras avanzamos**, paramos features y arreglamos. Hoy ya nos pasó 3 veces; no repetir.

---

## Cómo retomar este plan

Cualquier sesión nueva empieza con:

```bash
# 1. Verificar drift cero
python studio-multiagente/scripts/check_migration_drift.py --check

# 2. Leer el último estado
cat studio-multiagente/docs/plan_pre_interfaz_foxhole.md

# 3. Identificar siguiente sesión X según orden
```

Si el drift falla → arreglar antes de hacer nada más.
Si el plan está completo (X1-X5 done) → empezar UI.
