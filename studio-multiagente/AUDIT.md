# Auditoría JSONs locales vs workflows en n8n

Fecha: 2026-04-26

## Resumen

| | Total |
|---|---|
| Workflows activos en n8n | **~136** (bloque 16 añade 3: cron_compliance_audit_weekly + cron_pathology_review + util_admin_compliance_overview_html) |
| JSONs locales en `workflows/` | **112+** |
| En n8n SIN JSON local | **~16** (era 44 — bloque 16 no sincroniza más huérfanos, los 3 son nuevos) |
| En local SIN n8n | **0** |

## Sincronizados en bloque 7-12

**Bloque 7-8** (5 stubs):
- `agent_proposal.json` (bloque 7, 2fd83bb) — versión simplificada con queries SQL completas, jsCode embedded omitido
- `agent_planner.json` (bloque 8, stub estructural)
- `agent_memory.json` (bloque 8, stub estructural)
- `cron_external_backup.json` (bloque 8, stub estructural)
- `util_normativa_fetch.json` (bloque 8, stub estructural)

**Bloque 8** (cierre ciclo notes): `util_admin_notes_list.json` (stub completo, endpoint nuevo).

**Bloque 10** (fix cableado): `agent_materials.json` (stub estructural creado por primera vez tras fix Load Supplier Catalog).

**Bloque 11** (cron preventivo): `cron_unknown_agent_alert.json` (workflow nuevo, vigila regresión bug A2).

**Bloque 12** (5 huérfanos críticos sincronizados + 1 nuevo workflow):
- `agent_pathology.json` (stub estructural — Vision LLM, detección patologías)
- `agent_site_monitor.json` (stub estructural — Vision LLM, monitoreo obra)
- `agent_documents.json` (stub estructural — gestor documental Drive determinista)
- `agent_financial_tracker.json` (stub estructural — OCR facturas)
- `cron_post_phase_audits.json` (stub estructural — cron 30min auditorías post-fase)
- `util_admin_llm_stats_html.json` (workflow NUEVO — dashboard de costes LLM con drill-down)

**Bloque 16** (Fase 2 hooks: 3 workflows nuevos):
- `cron_compliance_audit_weekly.json` (workflow NUEVO `tTZaWj86DPW0TNRt`, activo — domingos 08:00 corre audit por cada proyecto activo via HTTP loop a agent_compliance_audit, agrega scorecards y manda digest si grade < B o critical>0)
- `cron_pathology_review.json` (workflow NUEVO `tFYGrFmo3zBwirre`, activo — diario 12:00 alerta findings >30d sin actualizar + criticos sin resolver)
- `util_admin_compliance_overview_html.json` (workflow NUEVO `jxCwiphu6ahrBNXv`, activo — GET /webhook/admin-compliance-overview, snapshot deterministico todos proyectos sin LLM)
- Hook `agent_briefing` ↔ `pathology_findings` verificado en n8n vivo: el SQL de `Load Project + Client` ya inyecta el array de findings unresolved. P3 del plan no requirió cambios — ya implementado en sesiones previas. Documentado en CHANGELOG.

**Bloque 15** (5 huérfanos + 2 nuevos crons + admin-index actualizado):
- `cron_contract_followup.json` (workflow NUEVO `ZlzJpRwOnoG1altD`, activo — Fase 2 de 3.13: alerta contracts esperando firma >7d, drafts olvidados >14d, expirados)
- `cron_invoice_approval_followup.json` (workflow NUEVO `xM7YlAGwbbgbFaGI`, activo — Fase 2 de 3.5: alerta invoices pending >5d, aprobadas sin pagar >30d, disputed >14d)
- `cron_proposal_to_contract.json` (stub — cron 10:30 detecta proposals aprobadas sin contract activo)
- `cron_briefing_postprocess.json` (stub — cron horario auto-dispara agent_home_automation si briefing menciona smart)
- `cron_qc_review.json` (stub — cron 09:15 alerta qc_checks bloqueados >7d)
- `cron_qc_handover_to_acta.json` (stub — cron 11:00 cierra ciclo QC→acta_recepcion_provisional→CFO)
- `cron_consultation_batch.json` (stub — cron cada 4h backup del sistema de presencia)
- `util_admin_index_html` modificado in-place: añade 4 dashboards nuevos (admin-llm-stats, admin-pipeline-metrics, admin-trades-summary, admin-notes-list) en sección "Dashboards web".

**Bloque 14** (5 huérfanos + 3 workflows nuevos):
- `cron_collab_review.json` (workflow NUEVO `sJpNiWYCIlCvqB5i` — cron 10:00 alerta deadline vencido + delivered>7d sin approved + invited>5d sin respuesta)
- `qc_public_form.json` (workflow NUEVO `Pqod9AyvG0opCrLU` — form HTML responsive móvil para QC durante visita a obra)
- `util_admin_trades_summary_html.json` (workflow NUEVO `1CHP5KuDWNGqWvi9` — dashboard agregado por gremio)
- `agent_normativa_refresh.json` (stub — cache warmer normativa con djb2 hash detection)
- `cron_anomaly_detect.json` (stub — cron 06:00 con 8 heurísticas SQL)
- `cron_aftercare_review.json` (stub — cron 09:30 incidencias postventa pending)
- `backup_decrypt.json` (stub — webhook puntual para descifrar backups del Drive)
- `aftercare_public_form.json` (stub — endpoint público postventa con token cliente)

**Bloque 13** (5 huérfanos sincronizados + 1 nuevo workflow + doc patrón stub):
- `util_admin_pipeline_metrics_html.json` (workflow NUEVO — dashboard ejecutivo: cards 24h/7d/30d, distribucion de fases, agentes 7d, estancados, completados)
- `agent_compliance_audit.json` (stub estructural — auditoría compliance, scorecard /100)
- `agent_certificate_generator.json` (stub estructural — 7 tipos de certificados)
- `agent_contracts.json` (stub estructural — 6 tipos de contrato)
- `aftercare_submit.json` (stub estructural — webhook público postventa LOE con Vision)
- `cron_drive_cleanup.json` (stub estructural — limpieza mensual de backups Drive)
- `studio-multiagente/docs/stub_estructural_pattern.md` — guía técnica del patrón (cuándo usarlo, anti-ejemplos, lista de stubs vivos).

> **Stub estructural** = `_n8n_id` + `_purpose` + nodes (id+name+type+position) + connections completas + settings. Sin `parameters` detallados (jsCode, SQL queries largos, HTML emails). Para versión completa: `mcp__n8n__n8n_get_workflow id=<n8n_id> mode=full`.

## ~16 workflows aún sin JSON local (era 44)

Estos son workflows que existen y están activos en n8n, pero no tienen su JSON sincronizado en `workflows/`. Razón típica: son piezas heredadas de sesiones anteriores donde el patrón "todo en JSON local" todavía no se aplicaba sistemáticamente.

### Agentes (16)
- `agent_accessibility`
- `agent_costs`
- `agent_documents`
- `agent_financial_tracker`
- `agent_materials`
- `agent_memory`
- `agent_normativa_refresh`
- `agent_pathology`
- `agent_planner`
- `agent_proposal`
- `agent_safety_plan`
- `agent_site_monitor`
- `agent_trades`

### Aftercare (3)
- `aftercare_assign_resolve`
- `aftercare_public_form`
- `aftercare_submit`

### Crons (12)
- `cron_aftercare_followup`
- `cron_aftercare_review`
- `cron_anomaly_detect`
- `cron_drive_cleanup`
- `cron_external_backup`
- `cron_financial_review`
- `cron_gdpr_retention`
- `cron_permit_review`
- `cron_post_phase_audits`
- `cron_project_review`
- `cron_quote_expiry`
- `cron_security_alerts`
- `cron_weekly_summary`

### Permits + certificaciones + facturas (5)
- `certification_payment`
- `certification_register`
- `permit_register`
- `permit_update_status`
- `invoice_decision`

### Trade comms (2)
- `trade_quote_reply`
- `trade_quote_request`

### Project summary HTML (cliente-facing)
- `project_summary`

### Anomaly review
- `anomaly_review`

### Backup
- `backup_decrypt`

### Utilities (5)
- `util_generate_embedding`
- `util_normativa_fetch`
- `util_price_search`
- `util_search_similar_cases`
- `util_webhook_security`

## Recuperar JSON de un workflow específico

```bash
# Vía MCP en sesión de Claude:
mcp__n8n__n8n_get_workflow id="<workflow_id>" mode="full"
```

Y luego copiar el `data.activeVersion.{nodes, connections, settings}` a un nuevo archivo `studio-multiagente/workflows/<name>.json`.

## Recomendación

No es urgente sincronizar los 44 — son workflows estables que no se modifican a menudo y tienen su backup en n8n. Si alguno se va a modificar significativamente, sincronizarlo entonces para tener el commit local del cambio.

Workflows críticos que sí merece la pena sincronizar (próxima iteración):
- `agent_proposal` (1 de los 11 core, usa LLM) — drift del prompt podría perderse
- `agent_planner` (similar)
- `agent_memory` (similar)
- `cron_external_backup` (crítico para DR — perdida de configuración significaría pérdida de backup destination)
- `util_normativa_fetch` (muy invocado por agent_regulatory)

## Verificación periódica

Este audit se puede regenerar comparando `mcp__n8n__n8n_list_workflows` con `ls workflows/*.json`. No hay cron automatizado por ahora — es manual al final de cada sesión grande.
