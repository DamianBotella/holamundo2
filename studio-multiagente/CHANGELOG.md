# Changelog ArquitAI

Histórico cronológico de hitos del sistema. Generado a partir de git log.

## 2026-04-26 — Bloques 7-12: sync huérfanos + audits + meta-vigilancia LLM

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
