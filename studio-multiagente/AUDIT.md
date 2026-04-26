# Auditoría JSONs locales vs workflows en n8n

Fecha: 2026-04-26

## Resumen

| | Total |
|---|---|
| Workflows activos en n8n | **~127** (suma 2: cron_unknown_agent_alert + util_admin_llm_stats_html) |
| JSONs locales en `workflows/` | **88+** |
| En n8n SIN JSON local | **~33** (era 44, sincronizados 11 entre bloques 7-12) |
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

> **Stub estructural** = `_n8n_id` + `_purpose` + nodes (id+name+type+position) + connections completas + settings. Sin `parameters` detallados (jsCode, SQL queries largos, HTML emails). Para versión completa: `mcp__n8n__n8n_get_workflow id=<n8n_id> mode=full`.

## ~33 workflows aún sin JSON local (era 44)

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
