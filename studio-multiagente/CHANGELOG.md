# Changelog ArquitAI

Histórico cronológico de hitos del sistema. Generado a partir de git log.

## 2026-04-29 — Bloque 28: Anti-drift + Schema freeze v1 + Plan pre-interfaz Foxhole

### Bloque 28 — preparacion solida pre-UI
- **Auditoria comprehensiva schema drift**: 42/44 tablas, 15/17 columnas, 12/12 funciones present. Los 4 "faltantes" eran nombres incorrectos en mi auditoria (permit_records -> permit_applications/permit_status_history; site_monitor_visits -> site_reports; email_encrypted -> email_enc; phone_encrypted -> phone_enc). **Sin drift real**. Las 3 incidencias previas (042, 044, 045) eran las unicas reales.
- **Migration 046 aplicada**: tabla `applied_migrations(filename PK, applied_at, applied_by, sha256, notes)` + indice. Bulk INSERT con las 45 migrations confirmadas (003-046, incluye dos 018 distintos). Verificado: total_registered=45.
- **Script `scripts/check_migration_drift.py`** (NUEVO): compara `schemas/migrations/*.sql` (repo) vs tabla `applied_migrations` (BD) y reporta drift. Modo `--list` y `--check` (con `--json` para CI). Codigo salida: 0 OK, 1 drift, 2 error config.
- **Schema FROZEN v1** (`docs/schema_v1_frozen.md`): contrato formal con las 44 tablas core + 12 funciones SQL + reglas duras (no rename sin alias, jsonb del studio_profile no se aplana, tenant_id presente, current_phase fuente de verdad, activity_log feed cronologico). A partir de aqui, cualquier cambio = nueva migration + registro.
- **Plan pre-interfaz Foxhole** (`docs/plan_pre_interfaz_foxhole.md`): plan formal de 5 sesiones (X1-X5) con esfuerzo total ~36-43h antes de tocar UI. Orden: E2E real -> Orchestrator audit -> Multi-tenant RLS -> Auth -> API REST contractual. Cada sesion documentada con producto entregable y reglas de oro.

**Bottom line**: backend declarado FROZEN v1 + mecanismo anti-drift activo. Listos para empezar X1 (E2E real) en proxima sesion.



## 2026-04-29 — Bloque 27: Reality Check + 2 fixes criticos de schema drift

### Bloque 27 — Reality Checker auditoria pipeline E2E + fixes inmediatos
- **Migration 044 aplicada en Supabase**: prompt v2 de agent_regulatory ahora activo en BD (5509 chars vs ~1500 v1). Hallazgo lateral: tabla agent_prompts no tiene columna updated_at. Documentado en cabecera de la migration para evitar bug futuro.
- **Reality Checker (subagente)** auditoria del pipeline E2E. Veredicto: NOT PRODUCTION READY. Detecto MISMA CLASE DE BUG que migration 042 silenciosa: schema drift afectando 6+ crons activos.
- **Migration 045 aplicada**: ALTER TABLE activity_log ADD COLUMN details jsonb + indice GIN. Causa raiz de 6 crons fallando todos los dias (cron_health_check, cron_proposal_response_followup, cron_backup_verify, cron_db_size_check, cron_data_integrity, cron_normativa_freshness). cron_health_check IRONICAMENTE pasaba sus checks pero fallaba al loggear el OK -> ciegos a fallos reales.
- **cron_pathology_review (tFYGrFmo3zBwirre) arreglado**: query usaba `pf.type`, `pf.cost_min`, `pf.cost_max` pero las columnas reales son `pathology_type`, `estimated_intervention_cost_min`, `estimated_intervention_cost_max`. Aplicado SELECT aliasing para no tocar el JS de Build Email. Verificado con SELECT que devuelve report sin error.
- `docs/reality_check_2026-04-29.md` con findings completos + pendientes priorizados.
- **Veredicto post-fixes**: NEEDS WORK. Pendiente E2E real con proyecto stub para certificar los 13 agentes. Pendiente decidir mecanismo anti-drift recurrente (3 incidentes ya: 042, 044, 045).



## 2026-04-27 — Bloques 20-25: Onboarding conversacional + studio_profile injection refactor + trade_quote_request templating

### Bloque 26 (P2) — auditoria Civil Engineer sobre agent_safety_plan + script PDF Document Generator
- Auditoria documentada en `docs/auditoria_civil_engineer_agent_safety_plan.md`. Hallazgo: `agent_safety_plan` ya esta bien cubierto tecnicamente gracias al knowledge file `RD_1627_1997_resumen.md`. Las mejoras propuestas son incrementales (no urgentes):
  - Anadir `code_references` por riesgo individual (trazabilidad normativa fina).
  - Marcar fases con `applies_when_estructural`.
  - Handoff explicito desde agent_regulatory (si task_type=estudio_seguridad_salud detectado, flag al input de safety_plan).
  - Campos `pdf_layout_hints` para preparar terreno PDF nativo.
  - Cualquier cambio de prompt requiere MCP n8n vivo (pendiente).
- **Script `scripts/safety_plan_to_pdf.py`** (NUEVO, criterio Document Generator): convierte una fila de `safety_plans` en un PDF firmable profesional via weasyprint (HTML+CSS->PDF). 11 secciones + portada + firma + estilo CSS limpio. Usa identity del studio_profile activo. Reemplaza el paso humano "JSON->Google Doc->exportar PDF->firmar" por un solo comando.
- `scripts/README.md` con instrucciones de uso, dependencias, integracion futura con n8n.

### Bloque 26 (P1) — agency-agents-main integrado: 10 agentes Claude Code instalados + auditoria Civil Engineer sobre agent_regulatory
- Carpeta `agency-agents-main/` (~200 agentes Claude Code en formato .md+YAML) inspeccionada. Top 10 instalados en `~/.claude/agents/`:
  - specialized-civil-engineer (Eurocodigos + CTE + multi-jurisdiccion)
  - specialized-document-generator (PDF/DOCX/XLSX/PPTX programaticos)
  - agents-orchestrator (patron quality gates + retry escalation)
  - engineering-sre (red de seguridad)
  - testing-reality-checker (E2E real vs sintetico)
  - sales-proposal-strategist (propuesta venta ArquitAI)
  - compliance-auditor
  - engineering-incident-response-commander
  - specialized-mcp-builder
  - product-feedback-synthesizer
- **Auditoria con criterio Civil Engineer**: el prompt v1 de `agent_regulatory` cubria solo capa administrativa (licencias, comunicacion previa, comunidades) y omitia la capa tecnica que la Administracion exige (CTE-DB, Eurocodigos, EHE-08, RD 1627/1997, REBT, RITE, RD 105/2008, RD 235/2013).
- **Migration 044** (`044_agent_regulatory_prompt_v2.sql`): UPDATE del prompt en `agent_prompts` con marco tecnico espanol completo + nuevos task_types (proyecto_tecnico, ESS, EBSS, gestion_rcd, certificado_eficiencia_energetica, boletines_instalaciones, cumplimiento_db_sua_accesibilidad, cedula_compatibilidad_urbanistica) + campos opcionales `documentation_required` y `code_references` por tarea + "regla de oro" para afectacion estructural (5 entregables coexistentes).
- `prompts/agent_prompts.md` AGENT_REGULATORY actualizado a v2 (fuente de verdad historica).
- Documento `docs/auditoria_civil_engineer_agent_regulatory.md` con TL;DR + huecos detectados + propuesta + riesgo del cambio.
- Pendiente: aplicar migration 044 en Supabase (cuando MCP n8n vuelva, o manualmente).

### Bloque 25 — P3 (LISTA_TAREAS): red de seguridad ampliada (recomendacion D)
- `cron_health_check` (`ztTrZupYJiQmkNGW`): query `Run Checks` ampliada con verificaciones nuevas — `get_active_studio_profile` añadida a expected_functions; `studio_profile`, `onboarding_sessions`, `design_options`, `materials`, `regulatory_tasks`, `accessibility_audits`, `safety_plans`, `agent_executions`, `agent_prompts`, `approvals`, `activity_log`, `project_intelligence` añadidas a expected_tables. Nuevos campos en report: `studio_profile_active_count`, `studio_profile_fn_returns_row`, `studio_profile_identity_complete`, `studio_profile_ok`. La condicion `All OK?` exige `studio_profile_ok=true`. Probado y devuelve OK.
- `cron_agent_failure_rate` (`12u0TIcAxZOimSFo`, activo): cron diario 07:00 detecta agentes con failure_rate > 50% en ultimas 24h (umbral minimo 2 ejecuciones). Si encuentra alguno, email HTML con tabla detallada (agente/total/failed/completed/rate). Silente si todo OK. Complementa health_check (infra) con runtime real.
- **Motivacion**: el bug de hoy (migration 042 sin aplicar, agentes fallando silenciosamente desde B23) habria sido detectado por cron_health_check en <24h. Juntos cubren ambos vectores: infra (sin trafico) y runtime (con trafico).

### Bloque 25 — Hallazgo critico: migration 042 nunca ejecutada en Supabase, aplicada via workflow MCP temporal
- **Diagnostico**: durante P2 LISTA_TAREAS (validar baseline) se descubrio que la tabla `studio_profile`, `onboarding_sessions` y la funcion `get_active_studio_profile()` NO existian en Supabase. La migration 042 (B20) nunca llego a ejecutarse en produccion. Los 10 agentes refactorizados en B23-B24 con `Load Studio Profile` estaban fallando silenciosamente desde el merge — y trade_quote_request modificado en B25 P1 tambien.
- **Accion**: workflow temporal `TEMP_apply_migration_043` (Postgres webhook) creado, ejecutado y borrado. Aplicacion en 3 pasos: (1) CREATE TABLE + indices, (2) CREATE FUNCTION + triggers, (3) INSERT baseline con identity ya corregido (Demo ArquitAI / Equipo ArquitAI) + tone.proveedores añadido.
- **Migration 043** convertida en archivo de auditoria/registro (las tablas y baseline ya estan en BD).
- **Verificado**: 1 fila baseline activa en studio_profile. `get_active_studio_profile()` devuelve datos. Todos los agentes con `Load Studio Profile` operativos.

### Bloque 25 — P1 (LISTA_TAREAS): trade_quote_request adaptado al studio_profile (sin LLM)
- `trade_quote_request` (`C8LmBilsqMTGNFut`): añadido nodo `Load Studio Profile` entre `Load Project` y `Build Email`. El email RFQ a oficios ahora respeta:
  - **Saludo**: si `tone.proveedores.formalidad ∈ {formal, profesional}` usa "Estimado/a [supplier]:", si no "Hola [supplier],".
  - **Tuteo/usted**: `tone.proveedores.tutea` (default true) cambia "Te solicitamos / contesta a este email / Si prefieres" → "Le solicitamos / conteste / Si prefiere".
  - **Firma**: `identity.persona_principal — identity.nombre_estudio` (con fallback "Damian — Estudio").
- Cero coste LLM, solo template substitution. Se aplica a TODOS los proyectos automáticamente.
- `agent_documents` (P1 también): **decisión consciente C — no se toca**. Estructura de carpetas Drive es invisible al cliente final, no requiere personalización.

### Bloque 24 — refactor inyección studio_profile en 4 agentes finales + cron monitor onboarding (sesión autónoma sin Damián)

### Bloque 24 — refactor inyección studio_profile en 4 agentes finales + cron monitor onboarding (sesión autónoma sin Damián)
- `agent_planner` (`lSUfNw61YfbERI8n`): Load Studio Profile + `_SP_PLAN` antes del systemPrompt. Las priorities del estudio orientan el orden y duración de las fases del plan.
- `agent_memory` (`gLxmy7M0UmC7Yzye`): Load Studio Profile + `_SP_MEM`. Las lessons_learned se redactan coherentes con las priorities del estudio (no contradicen valores).
- `agent_safety_plan` (`yRaR3V0j61R1g1jZ`): Load Studio Profile + `_SP_SAFE`. Riesgos ponderados según priorities (estudio que prioriza seguridad estructural eleva riesgos estructurales).
- `agent_accessibility` (`s7ctmUsITOWK7cRT`): Load Studio Profile + `_SP_ACC`. Jurisdicción (CCAA) + DB-SUA del CTE + priorities para gravedad de issues.
- `cron_onboarding_session_review` (`zhLAVolNtA6gBgXR`, activo): cron lunes 09:00 detecta sesiones onboarding_sessions paradas >7d en `in_progress`. Genera tabla HTML con cobertura/8, coste, días inactivos y enlace para retomar (via resume_token). Envía via util_notification al architect_email.
- **Total**: 10/11 agentes LLM-using con inyección studio_profile activa (todos menos agent_documents y agent_trades, que no usan LLM).

### Bloque 23 — refactor inyección studio_profile en 6 agentes núcleo
- `agent_briefing`: `_STUDIO_CONTEXT` + fusión visit_checklist con `briefing.open_questions`.
- `agent_design`: priorities (orden estricto al evaluar opciones).
- `agent_regulatory`: `_SP_REG` jurisdiction-heavy (CCAA + ayuntamientos para filtrar tareas).
- `agent_materials`: `_SP_MAT` con `materials_pref.gama_default` + `marcas_preferidas_por_categoria`.
- `agent_costs`: `_SP_COST` aplica red_lines como exclusión en el breakdown.
- `agent_proposal`: `_SP_PROP` propaga tone al executive_summary + red_lines preflight.

### Bloque 22 — patrón documentado de inyección studio_profile
- `studio-multiagente/docs/patron_inyeccion_studio_profile.md`: documentación del patrón (Load Studio Profile + prepend `_STUDIO_CONTEXT` block) con tabla agente→sección, esfuerzo estimado ~3.5h, cuándo activar (cuando el primer arquitecto real complete onboarding).
- `agent_briefing`: Load Studio Profile añadido en dry-run (cargado pero NO inyectado al systemPrompt todavía).

### Bloque 21 — frontend onboarding chat + admin studio_profile
- `setup_wizard_chat_html` (`wVkQvzlaEWgygGTE`, activo): GET `/webhook/setup-onboarding`. Frontend HTML responsive estilo chat con 8 pills de progreso + textarea autosize + localStorage para resume_token. Mobile-first.
- `util_admin_studio_profile_html` (`oDnyTIxTn4A9DIMW`, activo): GET `/webhook/admin-studio-profile`. Dashboard del perfil activo + 8 secciones detalladas + tabla sesiones onboarding + perfiles inactivos.

### Bloque 20 — onboarding conversacional con LLM ("pequeño cerebro")
- `agent_onboarding` (`aDEK08WPuDU5jVci`, activo): POST `/webhook/setup-onboarding-message`. Chat con LLM que conduce 8 secciones (identity/tone/priorities/red_lines/visit_checklist/materials_pref/trades_pref/jurisdiction) preguntando al profesional con tono humano.
- `agent_onboarding_extract` (`mzGAxzoKPwVUFWcS`, activo): extrae estructura JSON desde la transcripción y crea/actualiza fila en `studio_profile` cuando hay >=70% cobertura.
- Migration `042_studio_profile_onboarding.sql`: crea tablas `studio_profile` (8 jsonb sections) + `onboarding_sessions` + función `get_active_studio_profile()` + baseline seed para que el sistema arranque con un perfil genérico hasta que un profesional real complete el onboarding.



## 2026-04-26 — Bloques 7-19: Fase 2 completa + 5 overviews agregados + REPORTE_15H

### Bloque 19 (5 puntos): plan 5h — sesión autónoma de Damián descansando
- `util_admin_invoices_overview_html` (id `pvWPutYJLSQgyItV`, activo): GET `/webhook/admin-invoices-overview`. 4 KPI cards con totales y amounts. Tabla pending por categoría, histórico por gremio, top 20 pending más antiguas primero coloreadas.
- `util_admin_contracts_overview_html` (id `Pl6oXMSLdWP1aAni`, activo): GET `/webhook/admin-contracts-overview`. 5 KPI cards. Tabla por contract_type. Top 25 pendientes ordenados por urgency CASE (expired=100, drafts>14d=80, sent>7d=60).
- admin-index actualizado con 2 dashboards nuevos.
- `studio-multiagente/docs/REPORTE_15H.md` — reporte ejecutivo del trabajo autónomo de 15h: TL;DR, entregas por bloque, estado del sistema, lo que necesito de Damián priorizado, lecciones operativas acumuladas. Para que mañana tenga lectura rápida del progreso.



### Bloque 18 (5 puntos): plan 5h
- `util_admin_pathology_overview_html` (id `fmm3V3fWsyksUH7c`, activo): GET `/webhook/admin-pathology-overview`. 5 KPI cards (total/unresolved/critical/safety/in_repair) + tabla por tipo con avg coste max + tabla por proyecto + recientes critical/safety unresolved. Sin LLM.
- `util_admin_aftercare_overview_html` (id `V1duL8iwHBBwLCR6`, activo): GET `/webhook/admin-aftercare-overview`. 6 KPI cards incluido SLA breach calculado por severidad. Tablas por severidad y categoría. Top 25 incidentes open ordenados con SLA breach destacado en rojo.
- `cron_normativa_review_monthly` (id `l5jtvV5AqpQZ6BXt`, activo): cron día 1 mes 06:00. Snapshot pre → POST /webhook/normativa-refresh (HTTP a agent_normativa_refresh) → Wait 90s → Snapshot post → email comparativo before/after. Mantiene cache de normativa fresco automáticamente.
- `cron_compliance_critical_alert` (id `8rg1QPw64qX3csx1`, activo): cron cada 6h con 4 condiciones críticas (pathology safety unresolved, aftercare urgent/high open >24h, proyectos en obra sin safety_plan confirmado, proyectos en obra sin encargo_profesional firmado). Email rojo CRITICO. Complementa el digest semanal con alertas inmediatas.
- admin-index actualizado, AUDIT (142 workflows total), CHANGELOG, referencia_workflows (2 endpoints + 2 crons).



### Bloque 17 (5 puntos): plan 5h
- `ArquitAI.md` sec 3 actualizado masivamente: marca como ✅ Fase 2 cerradas las features cubiertas por bloques 14-16 (3.5/3.6/3.8/3.13/3.18/3.20/3.21). Cada Pendiente fase 2 reescrito con lo construido y lo que aún queda real.
- Migración 041_supplier_catalog_seed.sql: 22 items genéricos de proveedores españoles habituales (Porcelanosa, Roca, Geberit, Tres, Grohe, IKEA, Siemens, Bosch, Cosentino, Daikin, Saunier Duval, etc.) en gama media. `source_type='seed_generico'` permite a Damián insertar luego items reales con `source_type='catalog'` que tendrán prioridad. Activa agent_materials desde el primer ejecución sin esperar.
- `cron_aftercare_sla_breach` (id `U5hvcNLQGOrbyQ6J`, activo): Fase 2 de 3.6. Cron diario 08:30 detecta incidentes assigned/in_progress que sobrepasan SLA por severidad (urgent=2d, high=5d, medium=14d, low=30d). Email digest para escalar/reasignar. Vigilado con INTERVAL 26h.
- `util_admin_endpoints_html` (id `BLrbGTcoGeEZIhyu`, activo): GET `/webhook/admin-endpoints`. Catálogo navegable de TODOS los endpoints en 5 grupos (Dashboards admin, JSON, Agentes POST, Públicos, Crons) con botón "copiar curl" ready-to-paste para cada uno.
- admin-index actualizado con link al nuevo dashboard. AUDIT.md (huérfanos sin cambio, +2 nuevos), CHANGELOG, referencia_workflows.



### Bloque 16 (5 puntos): plan 5h
- `cron_compliance_audit_weekly` (id `tTZaWj86DPW0TNRt`, activo): Fase 2 de 3.21. Cron domingos 08:00 hace HTTP loop sobre proyectos activos llamando a agent_compliance_audit con send_email=false; agrega scorecards y envia digest si has_alerts. Vigilado con INTERVAL 8 days.
- `cron_pathology_review` (id `tFYGrFmo3zBwirre`, activo): Fase 2 de 3.18. Cron diario 12:00 alerta findings stale >30d sin actualizar + críticos/affects_safety sin resolver. Vigilado con INTERVAL 26h.
- Hook `agent_briefing` ↔ `pathology_findings` verificado: el SQL de `Load Project + Client` ya incluye `(SELECT json_agg(...) FROM pathology_findings WHERE project_id=p.id AND status NOT IN ('repaired','dismissed')) AS pathology_findings`. P3 del plan resultó NoOp porque ya estaba implementado en sesiones previas. Documentado.
- `util_admin_compliance_overview_html` (id `jxCwiphu6ahrBNXv`, activo): GET `/webhook/admin-compliance-overview`. Snapshot deterministico (sin LLM) de TODOS los proyectos activos con grade A/B/C/D + 11 checks +/-. Replica logica de scoring de agent_compliance_audit en JS para no llamar al LLM ni hacer HTTP requests.
- Admin index actualizado con link al nuevo dashboard.
- AUDIT.md, CHANGELOG, referencia_workflows actualizados.



### Bloque 15 (5 puntos): plan 5h
- `cron_contract_followup` (id `ZlzJpRwOnoG1altD`, activo): Fase 2 de 3.13. Cron 09:45 con 3 condiciones (awaiting_signature >7d, forgotten_drafts >14d, expired). Email HTML agrupado. Vigilado por cron_workflow_audit con `contract_followup_clean`.
- `cron_invoice_approval_followup` (id `xM7YlAGwbbgbFaGI`, activo): Fase 2 de 3.5. Cron 11:30 con 3 condiciones (pending_review >5d, approved sin pagar >30d, disputed >14d). Email HTML con total_amount_pending para priorización. Vigilado por cron_workflow_audit con `invoice_followup_clean`.
- `util_admin_index_html` actualizado: 4 dashboards nuevos en sección "Dashboards web" (admin-llm-stats, admin-pipeline-metrics, admin-trades-summary, admin-notes-list). Patch in-place via patchNodeField.
- 5 stubs huérfanos sincronizados: `cron_proposal_to_contract`, `cron_briefing_postprocess`, `cron_qc_review`, `cron_qc_handover_to_acta`, `cron_consultation_batch`.
- AUDIT.md huérfanos 21→16. CHANGELOG bloque 15. referencia_workflows (2 crons nuevos).



### Bloque 14 (5 puntos): plan 5h
- `cron_collab_review` (id `sJpNiWYCIlCvqB5i`, activo): Fase 2 de 3.20. Cron 10:00 alerta deadline vencido, delivered>7d sin aprobar, invited>5d sin respuesta. Email HTML agrupado. Aplicada lección bloque 12: ambas ramas escriben action='collab_review_clean' (status warning|success). Añadido a `cron_workflow_audit` (INTERVAL 26h).
- `qc_public_form` (id `Pqod9AyvG0opCrLU`, activo): GET `/webhook/qc-form?qc_id=<uuid>` con header x-api-key. Form HTML responsive mobile-first con tarjetas por item (3 botones grandes pass/fail/skip + textarea + indicador estado). Autosave via fetch al endpoint qc-complete existente. La API key se prompt() una vez por sesión (el browser no expone headers del request original).
- `util_admin_trades_summary_html` (id `1CHP5KuDWNGqWvi9`, activo): GET `/webhook/admin-trades-summary`. 6 cards de totales, tabla por gremio (response rate, accept rate, stale, avg amount, suppliers únicos), top 15 suppliers, solicitudes sin respuesta >14d coloreadas.
- 5 stubs huérfanos sincronizados: `agent_normativa_refresh`, `cron_anomaly_detect`, `cron_aftercare_review`, `backup_decrypt`, `aftercare_public_form`.
- AUDIT.md huérfanos 28→21. CHANGELOG + referencia_workflows actualizados (3 endpoints nuevos + 1 cron nuevo).



### Bloque 13 (5 puntos): plan 5h
- `util_admin_pipeline_metrics_html` (id `Zw6iaYTwznmgkeuL`, activo): GET `/webhook/admin-pipeline-metrics`. Dashboard ejecutivo con 4 cards (total, activos, completados, tiempo medio), distribución de fases con barras visuales, actividad de agentes 7d, proyectos estancados >14d, últimos completados.
- 5 stubs huérfanos sincronizados: `agent_compliance_audit`, `agent_certificate_generator`, `agent_contracts` (los 3 reescritos al patrón stub estructural — antes eran versiones obsoletas sin `_n8n_id`), `aftercare_submit`, `cron_drive_cleanup`.
- `studio-multiagente/docs/contexto_para_damian.md` actualizado con header de estado actual (22/26 features ArquitAI sec 3, 4 quick-wins priorizados, qué queda real). El cuerpo del doc original (20 oportunidades, taxonomía, knowledge/) queda intacto como referencia para Fase 2.
- Doc nuevo `studio-multiagente/docs/stub_estructural_pattern.md`: mini-guía técnica del patrón (cuándo usar stub vs full, estructura mínima, reglas, anti-ejemplos, lista de los 20 stubs vivos en bloque 13).
- AUDIT/CHANGELOG/referencia_workflows actualizados.



### Bloque 12 (5 puntos): plan 5h
- `cron_workflow_audit` ahora vigila también `cron_unknown_agent_alert` (action `unknown_agent_check_clean`, ventana 26h). El cron ahora escribe activity_log también cuando count=0 (rama NoOp reemplazada por Postgres).
- 5 stubs estructurales nuevos: `agent_pathology`, `agent_site_monitor`, `agent_documents`, `agent_financial_tracker`, `cron_post_phase_audits`.
- Workflow nuevo `util_admin_llm_stats_html` (id `QlGwyyV9S4AuVtln`, activo): GET `/webhook/admin-llm-stats` con header x-api-key. Dashboard HTML compacto: 3 cards 24h/7d/30d, tabla por agente ordenada por coste, tabla por modelo, banner rojo si hay `agent_name='unknown_agent'` en 24h.
- Script SQL `studio-multiagente/sql/cleanup_test_project.sql` para A6 (limpieza idempotente del proyecto test `5c230fc9-...`, con DO block + verificación).
- AUDIT.md y referencia_workflows.md actualizados con los nuevos endpoints y stubs.

### Bloque 11
- `cron_unknown_agent_alert` (id `3fNPnWuFjjcA7pBG`): cron diario 09:30 que cuenta llamadas en `llm_calls` con `agent_name IN ('unknown_agent','unknown','')` en últimas 24h y manda email crítico al architect_email si count > 0. Blinda regresión del bug A2.

### Bloque 10
- Fix puntual en `agent_materials`: nodo `Load Supplier Catalog` era Code stub (`return [{}]`); reemplazado por Postgres real que filtra por `valid_until` y ordena por `quality_tier`. Tabla supplier_catalog ya existe (migración 003) — el stub estaba obsoleto.

### Bloque 9
- Audit Fase A nodo a nodo. Resultado: A2/A3/A4/A7 ya cerrados desde sesión 24-04. A1/A5/A6 quedan pendientes (no son bugs sino entregables/SQL del usuario).
- Doc nuevo: `studio-multiagente/docs/fase_a_audit.md`.

### Bloque 8 (cierre ciclo notes)
- `util_admin_notes_list` (id `yL2a8zawMoQrZtRH`): GET `/webhook/admin-notes-list[?project_id]`. Cierra ciclo project_notes.
- 4 stubs estructurales sincronizados: `agent_planner`, `agent_memory`, `cron_external_backup`, `util_normativa_fetch`.
- AUDIT.md actualizado.

### Bloque 7
- `agent_proposal.json` sincronizado en local (parcial, sin jsCode largos).
- Setup multi-PC: `.claude-memory-snapshot/` (snapshot del directorio memory) + `.mcp.example.json` con placeholders.

## 2026-04-26 (post-bloque 6) — Bug fixes runtime

- **Fix `cron_quote_expiry`**: IF "Has Expired?" tenía `typeValidation:"strict"` que rechazaba el `Number($json.expired_count)` (Postgres devuelve count como string). Cambiado a `"loose"`. Ahora el cron corre sin error y devuelve `{rows:null, expired_count:"0"}` cuando no hay quotes vencidos. Fix aplicado directamente en n8n (workflow no sincronizado en repo local — uno de los 43 huérfanos del AUDIT.md).


## 2026-04-26 — Sesiones de hardening y observabilidad (5 bloques, 10h)

### Bloque 5: bug fixes + ciclo de vida + workflow audit
- `258d579` referencia_workflows.md: cierre bloque 5
- `1e7831f` util_admin_audit_workflows_html: vista del workflow audit
- `800b1d5` cron_workflow_audit diario 07:30 (verifica crons críticos vivos)
- `cf31c65` util_admin_health_history_html: tendencia del score 30d
- `b91710f` Migration 039 + cron_health_score_snapshot diario 06:30
- `062cf69` cron_business_weekly_email Lun 08:00 (digest semanal del estudio)
- `d7e209e` fix cron_backup_verify: usa finished_at/started_at no created_at

### Bloque 4: mantenimiento + self-service admin + system health
- `b10267b` referencia_workflows.md: cierre bloque 4
- `f83f8cb` admin-index integra system_health_score banner
- `a51d692` Migration 038: vista system_health_score (0-100 unificado)
- `78b66c8` Migration 037: agent_prompts_history (auditoría de cambios de prompts)
- `368e899` cron_normativa_freshness semanal Lun 09:00
- `cbd445f` util_admin_recent_activity_html: timeline de actividad 48h
- `0dddb41` util_admin_search_html: búsqueda transversal con form GET
- `6a075d4` cron_vacuum_analyze semanal Dom 03:30 (mantenimiento PostgreSQL)

### Bloque 3: UX navegable + DR + observabilidad de almacenamiento
- `4b1f9b4` referencia_workflows.md: cierre bloque 3 (UX navegable + DR)
- `2bc6308` README maestro: estado actual + admin-index como punto de entrada
- `6ea6a52` Migration 036 + cron_db_size_check (snapshot + alerta crecimiento)
- `5d4a819` util_admin_tokens_html: vista read-only de tokens cliente
- `9fc33b5` cron_backup_verify diario 07:00 (alerta si backup stale/failed)
- `362a02d` util_admin_export_csv: exportador CSV multi-dataset
- `dd1550a` util_admin_project_view_html: drill-down de un proyecto (admin)
- `fc0ba1b` util_admin_index_html: landing maestro con links a todos los dashboards

### Bloque 2: robustez operacional + UX inicial
- `07c3c4d` referencia_workflows.md: anade workflows del bloque robustez/UX
- `0ad57a4` knowledge/agents/README.md: referencia rápida de agentes
- `a320960` error_handler: clasificación por categoría + dedup por (workflow, nodo)
- `2cfe9c5` util_llm_costs_html: vista HTML de costes LLM
- `12c4bf9` Migration 035: tabla llm_calls + util_llm_call instrumentado
- `ace4515` cron_data_integrity diario 05:30 (orphans + FK inválidas + fases)
- `69fd43a` cron_stuck_executions cada hora (agent_executions huérfanos)
- `93f6514` util_dashboard_summary_html: vista web del dashboard del estudio

### Bloque 1 extra: housekeeping + seguridad final
- `fa186ab` knowledge/seguridad/referencia_workflows.md: índice maestro
- `6e10f16` cron_access_log_purge diario (access_log >90d, condicional)
- `b6207bd` cron_security_events_purge semanal (events resolved >365d)
- `83c4cce` hardening_fase2.md: tabla maestra de workflows + migraciones aplicadas
- `a718153` util_security_dashboard_html: vista HTML del security dashboard
- `468c449` cron_security_events_auto_resolve diario (events >90d)
- `65fd335` cron_security_pentest_lite: 4 tests adicionales (10 -> 14 tests)
- `6394ab8` Security headers en 3 endpoints HTML públicos
- `94c68d7` util_security_check: auto-ban escalada tras 5+ pattern hits/10min
- `03054b0` util_security_dashboard expone KPIs de ip_blocklist
- `b071241` cron_blocklist_cleanup diario (purga ip_blocklist >7d expirados)

### Bloque 1: hardening seguridad core
- `8940d49` PII fase 2 completa: dropea columnas plain, escritores escriben _enc directo
- `b8dd3d6` ip_blocklist + auto-ban tras 3 honeypots/10min
- `fb60fa3` gdpr_client_data_view ahora lee de columnas _enc cifradas
- `3f9035a` util_hmac_verify (Postgres-pgcrypto) + cron_key_rotation_reminder
- `37b08f6` PII encryption fase 2 + honeypot trap
- `fcc6b4b` util_security_check integrado en 4 endpoints públicos
- `9e40846` Cleanup 22 clients test E2E + backfill consent sandbox
- `97ea3a0` Maxima ciberseguridad: auditoría + pentest + multi-tenant template

## 2026-04-25 — Construcción agentes complementarios

- `5e3b95e` compliance_audit + certificate_generator + cron qc->acta
- `fa7ae1e` "esas 8" pendientes (6 features cubiertas)
- `12bfed8` Reporte ejecutivo sesión nocturna 2026-04-26
- `4862041` util_dashboard_summary + cron_weekly_kpis (KPIs estudio)
- `a8bce7e` agent_client_concierge MVP API (sec 3.4 #17)
- `e390b5a` agent_home_automation MVP (sec 3.16 #21)
- `8f25070` crons follow-up: collab_review + contract_followup
- `c607d16` Sesión nocturna: 4 features sec 3 (energy/contracts/bc3/collab) + fix util_llm_call

## 2026-04-24 — QC + aftercare + acceso público

- `0d2bc09` QC: hook handover_date + cron_qc_review
- `9cf1799` Migración 019: centralizar architect_email en system_config
- `76f7e91` error_handler: silenciar workflows TEMP/migration + dedup 60min
- `223148f` agent_qc_checklists MVP + hook pathology→regulatory_tasks
- `8bd6cc4` Acceso público con tokens + project summary HTML + cifrado backup
- `3d32bb0` aftercare: notificación auto al gremio + cron followup stuck
- `c7e3271` Aprobación facturas por email + hook briefing→pathology
- `70de1ae` Mejoras integradoras: weekly summary + hooks + cron quote expiry

## 2026-04-23 — Agentes de obra + financiero

- `91ccda6` agent_anomaly_detector + fix email
- `5ca812d` agent_pathology: detección de patologías con Vision experto
- `d67caa5` agent_aftercare + agent_trade_comms email MVP
- `58af402` cron_weekly_summary
- `82cc04d` agent_financial_tracker (OCR + reconciliación)
- `edb9fca` agent_site_monitor (Claude Vision análisis fotos obra)
- `f16064b` agent_permit_tracker

## 2026-04-22 — Seguridad incremental

- `e25d0d7` Security bloque 5: rotación lecturas PII a pii_decrypt
- `f6f977c` Security bloque 4: cleanup backups + alertas IP bloqueada
- `ee5a7ee` Security bloque 3: prompt-injection + PII encryption + external backup
- `84f46b0` Security bloque 2: rate limit + audit log + PII encryption helpers
- `d77cdd3` Security bloque 1: API key webhooks + email tokens + GDPR básico

## 2026-04-21 — Cobertura inicial

- `ec22dcc` cron_post_phase_audits: auto-trigger accessibility + safety_plan
- `53b5b27` Memory v2: pgvector + similarity search en agent_memory y agent_briefing
- `6ed98ff` agent_accessibility: auditor automático DB-SUA 9 + Orden VIV/561/2010

## 2026-04-19 — Inicio

- `2b39250` agent_safety_plan: Insert Doc Body via HTTP Request directo a Docs API
- `151397e` agent_safety_plan: EBSS/PSS automático según RD 1627/1997
- `3cbb272` Add ArquitAI MVP: documento canónico, knowledge base técnica y fixes E2E
- `4055a23` Add handoff_v2.md with full project context
- `89d5754` primer commit

---

**Total**: ~89 commits, 39 migraciones SQL, 102+ workflows activos, 19 crons housekeeping, 16 endpoints API/HTML.
