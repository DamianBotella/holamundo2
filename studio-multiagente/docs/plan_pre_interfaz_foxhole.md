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

### Sesión X2 — Auditoría main_orchestrator + cleanup workflows (~3h) 🟡

**Por qué aquí**: con el E2E fresco en cabeza, es el momento de auditar quality gates + retry logic. Se hace antes de multi-tenant para no auditar dos veces.

**Qué hacer**:
1. Lanzar agente `Agents Orchestrator` (ya instalado en `~/.claude/agents/`) sobre `main_orchestrator` (87 nodos).
2. Aplicar findings críticos solamente. Lo demás documentar.
3. Auditoría de workflows abandonados: detectar workflows `active=true` sin ejecuciones en >30d. Archivarlos.
4. Aplicar mejoras incrementales a `agent_safety_plan` documentadas en B26 (`code_references` por riesgo, `applies_when_estructural`).

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

### Sesión X4 — Auth real con Supabase Auth (~6-8h) 🔴 BLOQUEANTE

**Por qué después de RLS**: auth necesita saber el `tenant_id` de la sesión para que RLS funcione. Sin RLS, auth no aporta protección real.

**Qué hacer**:
1. Migration 048 — habilitar Supabase Auth (`auth.users` ya existe en Supabase nativo).
2. Tabla `user_profiles(user_id, tenant_id, role, full_name, ...)` que linka `auth.users` con `tenants`.
3. Roles: `architect` (full), `colaborador` (read-only), `super_admin` (cross-tenant — para Damián).
4. JWT token incluye `tenant_id` y `role` en custom claims.
5. Login UI mínimo (página HTML) y endpoint logout.
6. Workflow n8n del primer endpoint protegido (ej: `GET /me`) que valida JWT, extrae `tenant_id`, lo setea en sesión Postgres, devuelve datos del usuario.
7. Reset password via email (Supabase nativo).

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

### Sesión X6 — Empezar interfaz Foxhole (~varias sesiones)

Una vez X1-X5 completos:
- Decidir stack frontend (React + Vite + TanStack Query + Tailwind, o equivalente).
- Wireframes: vista mapa global + zoom táctico de proyecto.
- Sistema de design: colores, tipografía, iconografía militar/técnica.
- Componentes core: project card, phase indicator, alert badge, timeline event, drill-down panel.
- Iterar contra la API.

---

## Tabla resumen

| # | Sesión | Esfuerzo | Bloqueante UI | Estado | Resultado |
|---|---|---|---|---|---|
| X1 | E2E real | 5h | 🔴 | ✅ B30-B34 | Confianza certificada — 13/13 agentes E2E |
| X2 | Orchestrator audit + cleanup | 3h | 🟡 | pendiente | Pipeline limpio |
| X3 | Multi-tenant + RLS | 12-15h | 🔴 | 📐 diseño DRAFT (B35) | Backend multi-cliente |
| X4 | Auth + sesiones | 6-8h | 🔴 | pendiente | Login + roles |
| X5 | API REST contractual | 10-12h | 🔴 | pendiente (boceto OpenAPI iniciado) | Contrato estable para UI |
| X6+ | Foxhole UI | varias sesiones | — | pendiente | Producto vendible visualmente |

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
