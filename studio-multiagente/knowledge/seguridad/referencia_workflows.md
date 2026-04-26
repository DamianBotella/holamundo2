# Referencia — Workflows y funciones SQL del bloque de seguridad

## Workflows activos (n8n)

### Sub-workflows reusables

| Nombre | ID | Tipo entrada | Output | Uso |
|---|---|---|---|---|
| `util_security_check` | `5LEflgQnjSvgGAYK` | Execute Sub-workflow Trigger | `{allowed, blocked_reason, rate_minute, rate_hour, patterns_detected}` | Rate limit + pattern detection + ip_blocklist + auto-ban escalado. Llamar antes del primer hit a BD. |
| `util_hmac_verify` | `g4k5UkQgPryA9Riz` | Execute Sub-workflow Trigger | `{valid, reason, expected_preview, given_preview}` | Verificación HMAC para webhooks externos firmados. |

### Endpoints API JSON

| Path | Workflow | Auth | Función |
|---|---|---|---|
| `GET /webhook/security-dashboard` | `util_security_dashboard` (`k7sXYc50Ta1Y8NhN`) | Header X-API-Key | Snapshot completo en JSON (snapshot, recent_critical, top_ips_24h, blocklist) |
| `GET /webhook/security-dashboard-html` | `util_security_dashboard_html` (`hhjRkb0aBnCIsHg7`) | Header X-API-Key | Vista HTML del dashboard de seguridad (cards + 3 tablas) |
| `GET /webhook/dashboard-summary` | `util_dashboard_summary` (`BfNjUhQECJY6J5n6`) | Header X-API-Key | KPIs estudio en JSON |
| `GET /webhook/dashboard-html` | `util_dashboard_summary_html` (`3GKoism5dRILkE9T`) | Header X-API-Key | Vista HTML del dashboard del estudio (proyectos, finance, concierge) |
| `GET /webhook/llm-costs-html` | `util_llm_costs_html` (`SM5LbXSelBgt3B1U`) | Header X-API-Key | Vista HTML de costes LLM (por agente, proyecto, modelo, errores) |
| `GET /webhook/admin-index` | `util_admin_index_html` (`cRk4zHYROjVHzUBf`) | Header X-API-Key | Landing maestro con links a todos los dashboards |
| `GET /webhook/admin-project?project_id=<uuid>` | `util_admin_project_view_html` (`OMtABOaVexcIAF8V`) | Header X-API-Key | Drill-down de un proyecto (admin view, todos los datos) |
| `GET /webhook/admin-tokens` | `util_admin_tokens_html` (`iDgnbEj9bRBBp3Pb`) | Header X-API-Key | Vista read-only de tokens cliente |
| `GET /webhook/admin-export?dataset=<name>` | `util_admin_export_csv` (`fKn8F4cXN17QXydM`) | Header X-API-Key | Export CSV multi-dataset |
| `GET /webhook/admin-search?q=<term>` | `util_admin_search_html` (`64dANKQHPVyfKnbG`) | Header X-API-Key | Búsqueda transversal proyectos/clientes/eventos |
| `GET /webhook/admin-activity` | `util_admin_recent_activity_html` (`6Rk662AIopY93BGw`) | Header X-API-Key | Timeline 48h security events + activity_log |
| `GET /webhook/admin-health-history` | `util_admin_health_history_html` (`PbSh6qd4wD2pHfO4`) | Header X-API-Key | Tendencia 30d del health score (SVG bar chart) |
| `GET /webhook/admin-workflows` | `util_admin_audit_workflows_html` (`zP7NQ6wfhQFyw2ZB`) | Header X-API-Key | Status de 14 crons críticos (OK/STALE/NEVER/NO_TRACK) |
| `GET /webhook/admin-pipeline` | `util_admin_pipeline_html` (`KdkEHQuMDQMpgckP`) | Header X-API-Key | Kanban visual de proyectos por fase (10 columnas) |
| `GET /webhook/admin-help` | `util_admin_help_html` (`x45X3jL6MWhTjjaA`) | Header X-API-Key | Página de ayuda con FAQ + endpoints + comandos |
| `POST /webhook/admin-note` | `util_admin_note_create` (`8okwSwHgLtU4fUac`) | Header X-API-Key | Crear nota rápida en proyecto (body 3-2000 chars) |
| `POST /webhook/admin-note-toggle` | `util_admin_note_toggle` (`FOLt1PzhD1wh9WhX`) | Header X-API-Key | Pin/unpin/delete una nota existente |
| `GET /webhook/admin-notes-list?project_id=<uuid>` | `util_admin_notes_list` (`yL2a8zawMoQrZtRH`) | Header X-API-Key | Listar notas del estudio (filtra por proyecto si se pasa). Cierra ciclo notes. |
| `GET /webhook/admin-llm-stats` | `util_admin_llm_stats_html` (`QlGwyyV9S4AuVtln`) | Header X-API-Key | Dashboard HTML de costes LLM 24h/7d/30d, por agente y modelo, banner si hay `unknown_agent` en 24h |
| `GET /webhook/admin-pipeline-metrics` | `util_admin_pipeline_metrics_html` (`Zw6iaYTwznmgkeuL`) | Header X-API-Key | Dashboard ejecutivo: distribución por fase con barras, totales, agentes 7d, proyectos estancados >14d, recientes completados |

### Endpoints públicos (con security_check integrado)

| Path | Workflow | Auth | Notas |
|---|---|---|---|
| `POST /webhook/client-ask` | `client_ask` (`LEcfyzK2EHa8PIZ5`) | Body token | LLM concierge cliente. Cifra question/answer con `pii_encrypt()`. Rate 10/min, 60/h. |
| `POST /webhook/gdpr-request` | `gdpr_request` (`BLSm6Tfo0mJIDuFt`) | Body token | RGPD Art. 15-22. Cifra details. Rate 5/min, 20/h. |
| `POST /webhook/aftercare-public-submit` | `aftercare_public_submit` (`x5j2VKbz9tfQyqzl`) | Body token (+ Header Auth previo) | Postventa LOE. Rate 5/min, 30/h. |
| `POST /webhook/contract-signed` | `contract_mark_signed` (`QK640K7iJ9dPJATR`) | Header Auth previo | Webhook DocuSign. Rate 10/min, 100/h. HMAC verify futuro. |

### Endpoints públicos HTML (con security headers)

| Path | Workflow | Headers añadidos |
|---|---|---|
| `GET /webhook/client-ask-form` | `client_ask_form` (`YlJpehVGSKGI4PgF`) | HSTS, X-Frame DENY, nosniff, referrer-policy, permissions-policy |
| `GET /webhook/aftercare-public-form` | `aftercare_public_form` (`WHtdrr3tJpei3IM8`) | idem |
| `GET /webhook/project-summary` | `project_summary` (`LuTpknJdwLwzUVqc`) | idem |

### Honeypots

| Paths trampa | Workflow | Acción |
|---|---|---|
| `/admin`, `/wp-admin`, `/wp-login.php`, `/.env`, `/.git/config`, `/phpmyadmin`, `/api/v1/admin`, `/console`, `POST /login` | `honeypot_trap` (`Gjsc6nxHY3KIlKj3`) | Log `unauthorized_endpoint` severity high + auto-ban 24h tras 3+/10min + 404 genérico |

### Crons de seguridad

| Schedule | Workflow | Función |
|---|---|---|
| `0 9 1 * *` (mensual día 1 09:00) | `cron_key_rotation_reminder` (`b7po76socKIE0WhZ`) | Revisa antigüedad de keys en system_config y avisa por email |
| `30 2 * * *` (diario 02:30) | `cron_security_events_auto_resolve` (`gfWt4Uq94TUK9gch`) | Marca resolved=true events >90d (excepto critical) |
| `0 3 * * 0` (semanal Dom 03:00) | `cron_security_events_purge` (`n702LDg8Y76oUs8k`) | DELETE events resolved >365d |
| `30 4 * * *` (diario 04:30) | `cron_access_log_purge` (`AUwmuKSQTlIaC3W9`) | DELETE access_log >90d (preserva pii_accessed=true y denied/error) |
| `0 4 * * *` (diario 04:00) | `cron_blocklist_cleanup` (`EiAh32GInzjAfS1S`) | DELETE ip_blocklist con blocked_until >7d expirados |
| `0 3 * * 0` (semanal Dom 03:00) | `cron_inactive_token_cleanup` (`LmnF0ePvXEzT2ZdP`) | Revoca tokens inactivos |
| `0 4 * * 0` (semanal Dom 04:00) | `cron_security_pentest_lite` (`9drH5gGPV9hweKp2`) | 14 tests E2E de regresión |
| `30 8 * * 1` (semanal Lun 08:30) | `cron_security_dashboard_alert` (`YSQHEhh0IRI93k7C`) | Email semanal con KPIs y eventos |
| `0 3 * * 0` (semanal Dom 03:00) | `cron_security_events_purge` (`n702LDg8Y76oUs8k`) | DELETE events resolved >365d |
| `30 4 * * *` (diario 04:30) | `cron_access_log_purge` (`AUwmuKSQTlIaC3W9`) | DELETE access_log >90d (preserva PII y errores) |
| `0 6 * * *` (diario 06:00) | `cron_health_check` (`ztTrZupYJiQmkNGW`) | Verifica funciones SQL + tablas + roundtrip pii. Email crítico si falla |
| `15 * * * *` (cada hora :15) | `cron_stuck_executions` (`eJD0DhgAvZXW5bYW`) | agent_executions running >10min → marcar failed |
| `30 5 * * *` (diario 05:30) | `cron_data_integrity` (`XP04imsIGNlr1smJ`) | 15 chequeos de orphans / FKs / fases / enums |
| `0 7 * * *` (diario 07:00) | `cron_backup_verify` (`ERiFhqiHEpcwHEbz`) | Alerta crítica si último backup >7d o failed |
| `45 4 * * *` (diario 04:45) | `cron_db_size_check` (`edBWaDXssbrp96X0`) | Snapshot db_size + alerta si crece >50% en 7d |
| `30 3 * * 0` (semanal Dom 03:30) | `cron_vacuum_analyze` (`TGie3Mfy5jKqTF7z`) | VACUUM ANALYZE sobre 12 tablas core |
| `0 9 * * 1` (semanal Lun 09:00) | `cron_normativa_freshness` (`bMhUwi8PdlIlh5aW`) | Alerta si normativa_knowledge stale >90d |
| `30 6 * * *` (diario 06:30) | `cron_health_score_snapshot` (`FQaWcUybqapIEoAg`) | Snapshot diario en health_score_history |
| `30 7 * * *` (diario 07:30) | `cron_workflow_audit` (`YzFIE4H1RLrLDbt9`) | Verifica que 10 crons criticos hayan corrido en su ventana |
| `0 8 * * 1` (semanal Lun 08:00) | `cron_business_weekly_email` (`J09y2O7LWrWoTn4B`) | Digest semanal del estudio (KPIs business + score) |
| `0 11 * * *` (diario 11:00) | `cron_proposal_response_followup` (`YHTfBfLeaSFD7Vma`) | Email a Damián si propuestas sin respuesta cliente >7d |
| `30 9 * * *` (diario 09:30) | `cron_unknown_agent_alert` (`3fNPnWuFjjcA7pBG`) | Vigila regresión del bug A2: alerta crítica si hay llm_calls con `agent_name IN ('unknown_agent','unknown','')` en últimas 24h |

## Funciones SQL (PostgreSQL)

### Cifrado PII

| Función | Args | Returns | Uso |
|---|---|---|---|
| `pii_encrypt(text)` | texto plano | bytea | Cifra con `pgp_sym_encrypt` usando clave en `system_config.encryption_key` |
| `pii_decrypt(bytea)` | dato cifrado | text | Descifra con la misma clave |

### Rate limit + IP block

| Función | Args | Returns | Uso |
|---|---|---|---|
| `check_rate_limit(ip, endpoint, max_per_minute, max_per_hour)` | text, text, int, int | tabla(allowed, reason, current_minute, current_hour) | Atomic rate check por (ip, endpoint) en ventanas móviles. Inserta hit en `rate_limits`. |
| `is_ip_blocked(ip)` | text | boolean | TRUE si la IP está en `ip_blocklist` con `blocked_until > now()` |
| `ban_ip(ip, duration, reason, evidence_event_id)` | text, interval, text, uuid | uuid | UPSERT en `ip_blocklist`: si ya existe, extiende `blocked_until` y appendea evidencia |

### Eventos de seguridad

| Función | Args | Returns | Uso |
|---|---|---|---|
| `raise_security_event(type, severity, ip, endpoint, resource_type, resource_id, description, details)` | varios | uuid | Inserta en `security_events`. 16 event_types válidos (ver enum). |
| `log_access(...)` | varios | uuid | Inserta en `access_log` |

### Multi-tenant

| Función | Args | Returns | Uso |
|---|---|---|---|
| `current_tenant_id()` | — | uuid | Lee `app.current_tenant` del session config — listo para policies RLS futuras |

### Triggers automáticos

| Trigger | Tabla | Acción |
|---|---|---|
| `clients_sync_pii_enc` | clients | BEFORE INSERT/UPDATE → setea email_enc, phone_enc, notes_enc |
| `briefings_sync_pii_enc` | briefings | BEFORE INSERT/UPDATE → setea client_needs_enc |
| `gdpr_requests_touch` | gdpr_requests | BEFORE UPDATE → setea updated_at |

(Triggers de sync para client_conversations y gdpr_requests fueron eliminados en migration 034 — los workflows escriben `_enc` directamente con `pii_encrypt()`.)

## Tablas relevantes

| Tabla | Propósito | Retención |
|---|---|---|
| `access_log` | Auditoría de cada request | 90d (excepto pii_accessed=true y denied/error que perpetuo) |
| `security_events` | Incidencias de seguridad clasificadas | resolved >365d → purge; unresolved infinito |
| `rate_limits` | Sliding window counters | (managed por la función) |
| `ip_blocklist` | IPs bannadas temporalmente | 7d post-expiry → cleanup |
| `tenants` | Multi-tenant (1 tenant actual) | infinito |
| `system_config` | Config + secrets (encryption_key, webhook_api_key, etc.) | infinito |

## Vistas

| Vista | Función |
|---|---|
| `security_dashboard` | Snapshot agregado (counts, IPs únicos, eventos, tokens, GDPR, consents) |
| `gdpr_client_data_view` | Export RGPD Art. 15/20 — usa `pii_decrypt()` para todo |

## Migraciones aplicadas (orden)

| # | Archivo | Resumen |
|---|---|---|
| 008 | `008_security_block2.sql` | pgcrypto + pii_encrypt/pii_decrypt + check_rate_limit |
| 009 | `009_pii_encryption_columns.sql` | Columnas _enc en clients y briefings + triggers |
| 027 | `027_gdpr_requests.sql` | Tabla gdpr_requests + vista inicial |
| 029 | `029_security_hardening.sql` | access_log + security_events + raise_security_event + view security_dashboard |
| 030 | `030_rls_template.sql` | Tabla tenants + columnas tenant_id + current_tenant_id() |
| 031 | `031_pii_encryption_phase2.sql` | _enc en client_conversations y gdpr_requests |
| 032 | `032_gdpr_view_uses_enc.sql` | gdpr_client_data_view → pii_decrypt(_enc) |
| 033 | `033_ip_blocklist.sql` | Tabla ip_blocklist + is_ip_blocked() + ban_ip() |
| 034 | `034_drop_pii_plain_columns.sql` | DROP COLUMN question, answer, details (PII en plain eliminada) |
| 035 | `035_llm_calls_tracking.sql` | Tabla llm_calls + función log_llm_call() + vista llm_costs_summary |
| 036 | `036_db_size_history.sql` | Tabla db_size_history para tracking de crecimiento |
| 037 | `037_agent_prompts_history.sql` | Tabla agent_prompts_history + trigger snapshot + vista churn |
| 038 | `038_system_health_score.sql` | Vista system_health_score (0-100 con color green/yellow/red) |
| 039 | `039_health_score_history.sql` | Tabla health_score_history para trends del score |
| 040 | `040_project_notes.sql` | Tabla project_notes para anotaciones rápidas del arquitecto |
