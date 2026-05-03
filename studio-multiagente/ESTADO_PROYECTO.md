# ESTADO_PROYECTO — ArquitAI

**Fecha**: 2026-05-03 (post-B44).
**Documento**: índice consolidado para Damián. Para retomar el proyecto en cualquier momento, leer ESTE primero.

---

## Pipeline X1-X6 — estado de cada bloque

| # | Bloque | Estado | Bloquea | Doc principal |
|---|---|---|---|---|
| **X1** | E2E real del pipeline | ✅ **COMPLETO** (B30-B34) | — | [`docs/e2e_evidence_FINAL_2026-04-29.md`](docs/e2e_evidence_FINAL_2026-04-29.md) |
| **X2** | Auditoría main_orchestrator | ✅ **CERRADO 100%** (B44-B48) — PA-1/3/4/5/6/7/8 aplicados, PA-2 descartado. E2E validado | — | [`docs/x2_orchestrator_audit_post_prod_2026-05-03.md`](docs/x2_orchestrator_audit_post_prod_2026-05-03.md) |
| **X3** | Multi-tenant + RLS | 🔄 **EN CURSO** (B49-B51) — 049+049b aplicadas, 19 workflows parchados con CTE, listo para 050 | falta aplicar 050 + smoke 2 tenants | [`docs/x3_workflow_patch_pattern.md`](docs/x3_workflow_patch_pattern.md) |
| **X4** | Auth Supabase | 📐 **DISEÑO COMPLETO** (B39) | bloqueado por X3 | [`docs/x4_auth_design.md`](docs/x4_auth_design.md) |
| **X5** | API REST contractual | 📐 **CONTRACT v0.2 + 4 workflows** (B38) | bloqueado por X3+X4 | [`docs/api_v1.yaml`](docs/api_v1.yaml) |
| **X6** | UI Foxhole | 📐 **DISEÑO COMPLETO** (B40) | bloqueado por X1-X5 | [`docs/x6_foxhole_ui_design.md`](docs/x6_foxhole_ui_design.md) |

**Plan global**: [`docs/plan_pre_interfaz_foxhole.md`](docs/plan_pre_interfaz_foxhole.md).

---

## Lo que está LISTO en producción

- 13/13 agentes E2E certificados (X1).
- 47 migrations aplicadas (003-048) sin drift.
- studio_profile baseline (Demo ArquitAI / Madrid) inyectado en 10 agentes.
- Mecanismo anti-drift (`applied_migrations` + `check_migration_drift.py`).
- Onboarding chat funcional.
- Crons monitoreo (health_check, e2e_smoke_test, agent_failure_rate, onboarding_session_review).
- error_handler v1 con dedup + categorización.

## Lo que está LISTO en repo pero NO aplicado

| Asset | Tipo | Estado |
|---|---|---|
| `migrations/049_multi_tenant_extend.sql.draft` | SQL | Aplica con `apply_x3_migrations.py --step 049` |
| `migrations/050_rls_enable.sql.draft` | SQL | Aplica con `apply_x3_migrations.py --step 050` (DESTRUCTIVA, requiere workflows actualizados) |
| `migrations/051_user_profiles_auth.sql.draft` | SQL | Aplica tras configurar Supabase Auth |
| `migrations/052_api_views.sql.draft` | SQL | Aplica tras 049+050 |
| `migrations/053_auth_triggers.sql.draft` | SQL | Aplica tras 051. Requiere registrar hook manualmente en Supabase. |
| `workflows/api/api_me.json` | n8n workflow | Importar tras X3+X4. Reemplazar PLACEHOLDER credentials. |
| `workflows/api/api_projects_list.json` | n8n workflow | Idem. |
| `workflows/api/api_project_detail.json` | n8n workflow | Idem. |
| `workflows/api/api_metrics_dashboard.json` | n8n workflow | Idem. |
| `workflows/error_handler_v2.json` | n8n workflow | Importar como versión nueva, smoke test, luego renombrar el v1 a archive. |

## Lo que está PENDIENTE (no diseñado aún)

- `api_timeline`, `api_agent_runs`, `api_alerts`, `api_approve`, `api_trades`, `api_materials`, `api_create_project`, `api_studio_profile_get`, `api_studio_profile_patch` — workflows replicando patrón B38.
- `util_jwt_verify` sub-workflow.
- `api_auth_login`, `api_auth_logout`, `api_auth_refresh`, `api_auth_invite`.
- `login_html` workflow que sirve UI mínima HTML antes de Foxhole.
- Repositorio `foxhole-ui/` separado con la UI React.

---

## Cómo retomar el proyecto

### Opción A — al volver a casa, MCP n8n volverá a estar arriba

```bash
# 1. Verificar drift cero
cd studio-multiagente/scripts
python check_migration_drift.py --check

# 2. Decidir siguiente bloque según tiempo disponible:
```

| Tiempo | Bloque sugerido |
|---|---|
| 30min | Snapshot workflows producción: `python snapshot_workflows.py --critical` |
| 1h | Importar `error_handler_v2.json` + smoke test |
| 2h | Auditar 12 agentes restantes con checklist X2 (Bug 9 fix) |
| 4h | Aplicar X3: 049 → smoke → workflows update → 050 → smoke |
| 6h | X4 completo: aplicar 051+053, configurar Supabase Auth, crear util_jwt_verify + login workflows |
| 1 día | Implementar todos los workflows API restantes (~10) |
| 5-6 sem | Construir UI Foxhole (M1-M5) |

### Opción B — MCP n8n no vuelve

```bash
# Trabajar en assets que no requieren n8n:
# - Más migrations SQL en .draft
# - Documentar más workflows API en JSON
# - Empezar el repo foxhole-ui/ con M1 (Foundation)
# - Refinar specs
```

---

## Comandos útiles

```bash
# Drift check (siempre al empezar/cerrar)
python studio-multiagente/scripts/check_migration_drift.py --check

# Snapshot producción (cuando MCP esté arriba)
python studio-multiagente/scripts/snapshot_workflows.py --critical

# Aplicar X3 con guía
python studio-multiagente/scripts/apply_x3_migrations.py --check     # plan
python studio-multiagente/scripts/apply_x3_migrations.py --step 049  # uno
python studio-multiagente/scripts/apply_x3_migrations.py --all       # todos

# Generar PDF safety_plan demo
python studio-multiagente/scripts/safety_plan_to_pdf.py --demo

# Git status del proyecto
git log --oneline -20
```

---

## Logs por sesión

### Jornada 2026-05-01 (B35-B43)

| Commit | Hash | Bloque | Producto |
|---|---|---|---|
| B35 | f740ea8 | Cierre X1 | api_v1.yaml v0.1 + AUDIT.md + plan post-X1 |
| B36 | 3bbc6fa | X3 design | 3 migrations DRAFT + x3_multi_tenant_design.md |
| B37 | 31a6fa6 | X2 audit estático | 6 hallazgos PA-1 a PA-6 + checklist producción |
| B38 | b42f8b1 | X5 expansion | API v0.2 + 7 SQL views + 4 workflows API |
| B39 | d1d71e5 | X4 design | x4_auth_design.md + migration 053 |
| B40 | f5b7c00 | X6 wireframes | x6_foxhole_ui_design.md + roadmap M1-M5 |
| B41 | 4b0e824 | Scripts | snapshot_workflows.py + apply_x3_migrations.py |
| B42 | 62e6c79 | error_handler v2 | error_handler_v2.json + v_recent_errors + spec |
| B43 | 1e33416 | Cierre jornada | ESTADO_PROYECTO + 3 workflows API + requirements |

### Jornada 2026-05-03 (B44-B47)

| Commit | Bloque | Producto |
|---|---|---|
| B44 | X2 sobre PROD (sesión autónoma) | Snapshot 19 workflows críticos + PA-5 a 23 INSERTs activity_log + PA-7 elimina 2 huérfanos + doc audit_post_prod |
| B45 | X2 cierre PA-8 | Branch false en `Regulatory Complete?` (Log Regulatory Pending + Respond Regulatory Pending). main_orchestrator vuelve a 87 nodos. |
| B46 | PA-1 + PA-3 + E2E + Drive | Variant A approval_type filter + 27 ops orchestrator + E2E forzado validado (365ms, path error completo). Bug Drive credencial descubierto y arreglado por Damián. |
| B47 | PA-3 replicación entrypoints HTTP | init_new_project (13 ops) + util_consultation (4 ops). Sub-workflows agente NO replican (cubiertos por PA-3 del orchestrator) |
| B48 | PA-4 + X2 cerrado 100% | Variante B lock table TTL 10min. Damián aplicó migración 054. 7 ops MCP. E2E race con 3 triggers simultáneos validado (1 toma lock, 3 reciben 409). |
| B49 | X3 inicio | 049 (tenant_id 8 tablas raíz) + 049b (helpers set_tenant_context, resolve_tenant_from_project, is_super_admin). Damián aplicó ambas. |
| B50 | X3 paso 3 PARCIAL | Patrón nodo separado FALLÓ (rompe item del trigger). Revertido en 18 workflows. main_orchestrator parchado con patrón correcto (set_config en CTE de Load Project). init_new_project tenant_id hardcoded a damian-mtnz. Patrón correcto documentado en x3_workflow_patch_pattern.md. |
| B51 | X3 paso 3 COMPLETO | 17 workflows parchados con patrón CTE (5 grupos por tipo de trigger). E2E validado en orchestrator: tenant_id resuelto correctamente + item preservado completo. |

---

## Estructura del repo

```
holamundo2/
├── ESTADO_PROYECTO.md          ← (este archivo, actualizar al cerrar sesión)
├── CLAUDE.md                   ← contexto Claude Code
├── .mcp.json                   ← config MCP (gitignored)
├── studio-multiagente/
│   ├── ESTADO_PROYECTO.md      ← este mismo archivo, copia para visibilidad
│   ├── CLAUDE.md               ← contexto del proyecto ArquitAI
│   ├── ArquitAI.md             ← documento maestro del producto
│   ├── AUDIT.md                ← log de auditorías
│   ├── CHANGELOG.md            ← cambios por bloque
│   ├── docs/
│   │   ├── plan_pre_interfaz_foxhole.md  ← plan global X1-X6
│   │   ├── x2_orchestrator_audit_*.md
│   │   ├── x3_multi_tenant_design.md
│   │   ├── x4_auth_design.md
│   │   ├── x6_foxhole_ui_design.md
│   │   ├── api_v1.yaml          ← OpenAPI 3.1
│   │   ├── error_handling_spec.md
│   │   └── e2e_evidence_*.md
│   ├── schemas/
│   │   └── migrations/          ← 048 aplicadas + 049-053 .draft
│   ├── scripts/
│   │   ├── check_migration_drift.py
│   │   ├── safety_plan_to_pdf.py
│   │   ├── snapshot_workflows.py
│   │   └── apply_x3_migrations.py
│   ├── workflows/
│   │   ├── main_orchestrator.json (MVP v1, 19 nodos)
│   │   ├── agent_*.json
│   │   ├── util_*.json
│   │   ├── cron_*.json
│   │   ├── error_handler.json (v1 actual)
│   │   ├── error_handler_v2.json (refactor pendiente importar)
│   │   ├── api/                 ← workflows API REST X5
│   │   │   ├── api_me.json
│   │   │   ├── api_projects_list.json
│   │   │   ├── api_project_detail.json
│   │   │   ├── api_metrics_dashboard.json
│   │   │   └── README.md
│   │   └── _snapshots/          ← exports de producción (PA-6 anti-drift)
│   ├── prompts/
│   │   └── agent_prompts.md
│   └── references/
│       └── n8n_node_types.md
└── memory/                     ← memoria persistente Claude
    └── MEMORY.md
```

---

## Alertas y advertencias

🔴 **MCP n8n caído** desde sesión B34. Para continuar trabajos que requieren n8n REST:
1. Cerrar Claude Code completo.
2. Verificar instancia n8n responde (curl con `N8N_API_KEY`).
3. Reabrir Claude Code → debería cargar `.mcp.json` al arrancar.
4. Si falla, ver paso 5 del diagnóstico en chat (testing JSON-RPC handshake manual).

🟡 **PA-2 X1 Bug 9** confirmado en producción para `agent_briefing` (fixed). Probablemente afecta los otros 12 agentes. Replicar fix tras MCP arriba.

🟡 **Drift PA-6**: el JSON local de `main_orchestrator` tiene 19 nodos vs 87 en producción. Snapshot inmediato cuando MCP vuelva.

🟢 **Sistema vendible** según evidence FINAL — pipeline E2E demostrado con datos reales.

---

## Para preguntar a Damián cuando vuelva

(Open questions documentadas en X6 sec. 10):

1. **Dominio UI**: ¿`app.arquitai.com` o subdominio?
2. **Tenant switch en TopBar**: ¿super_admin necesita?
3. **Mobile**: ¿read-only suficiente v1?
4. **Tema claro**: ¿necesario o sólo oscuro Foxhole?
5. **i18n**: ¿sólo español o preparar i18n día 1?
6. **Branding**: ¿"ArquitAI" definitivo?

---

**Fin del ESTADO_PROYECTO**. Actualizar al cerrar cada sesión.
