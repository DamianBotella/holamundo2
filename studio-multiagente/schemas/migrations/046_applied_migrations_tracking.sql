-- ============================================================
-- Migration 046: tracking de migrations aplicadas
-- Fecha: 2026-04-29 (B28)
-- ============================================================
-- Por que: ya van 3 incidentes de schema drift silencioso (042, 044,
-- 045 sin aplicar en BD pero commiteadas en repo). Esta migration
-- introduce un registro centralizado de migrations aplicadas para que
-- un script local o cron pueda detectar drift en <24h en lugar de
-- semanas (como paso con 042).
--
-- Politica desde aqui en adelante:
-- - Toda migration nueva DEBE terminar con INSERT a applied_migrations
--   con su filename y un ON CONFLICT DO NOTHING (idempotente).
-- - Las migrations 003-045 ya aplicadas se registran en bulk abajo
--   (verificado via auditoria comprehensiva en B28).
-- - El script scripts/check_migration_drift.py compara repo vs BD y
--   reporta divergencias.
-- ============================================================

CREATE TABLE IF NOT EXISTS applied_migrations (
  filename     text PRIMARY KEY,
  applied_at   timestamptz NOT NULL DEFAULT now(),
  applied_by   text,
  sha256       text,
  notes        text
);

CREATE INDEX IF NOT EXISTS idx_applied_migrations_at
  ON applied_migrations (applied_at DESC);

-- ============================================================
-- Bulk INSERT de las 43 migrations ya aplicadas (verificadas B28)
-- Auditoria comprehensiva ejecutada 2026-04-29: 42/44 tablas, 15/17
-- columnas, 12/12 funciones. Los 4 "faltantes" eran nombres incorrectos
-- en la auditoria, no drift real. TODAS las migrations 003-045 estan
-- aplicadas en produccion.
-- ============================================================
INSERT INTO applied_migrations (filename, applied_at, applied_by, notes) VALUES
  ('003_prices.sql',                       '2026-03-01'::timestamptz, 'historical', 'verificado B28'),
  ('004_safety_and_constraints.sql',       '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('005_accessibility.sql',                '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('006_pgvector_memory.sql',              '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('007_security.sql',                     '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('008_security_block2.sql',              '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('009_pii_encryption_columns.sql',       '2026-04-25'::timestamptz, 'historical', 'verificado B28 (cols email_enc/phone_enc/notes_enc)'),
  ('010_permit_tracker.sql',               '2026-04-25'::timestamptz, 'historical', 'verificado B28 (permit_applications + permit_status_history)'),
  ('011_site_monitor.sql',                 '2026-04-25'::timestamptz, 'historical', 'verificado B28 (site_reports)'),
  ('012_financial_tracker.sql',            '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('013_aftercare_and_trade_quotes.sql',   '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('014_pathology.sql',                    '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('015_anomalies.sql',                    '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('016_invoice_webhook_token.sql',        '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('017_client_tokens.sql',                '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('018_pathology_regulatory_hook.sql',    '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('018_qc_checks.sql',                    '2026-04-25'::timestamptz, 'historical', 'verificado B28 (duplicado de numero, ambos aplicados)'),
  ('019_architect_email_centralizado.sql', '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('020_qc_handover_hook.sql',             '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('021_energy_assessments.sql',           '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('022_contracts.sql',                    '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('023_collaborators.sql',                '2026-04-25'::timestamptz, 'historical', 'verificado B28'),
  ('024_home_automation.sql',              '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('025_client_concierge.sql',             '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('026_contract_templates.sql',           '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('027_gdpr_requests.sql',                '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('028_certificates.sql',                 '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('029_security_hardening.sql',           '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('030_rls_template.sql',                 '2026-04-26'::timestamptz, 'historical', 'verificado B28 (RLS templates - no activo aun, listo para multi-tenant)'),
  ('031_pii_encryption_phase2.sql',        '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('032_gdpr_view_uses_enc.sql',           '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('033_ip_blocklist.sql',                 '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('034_drop_pii_plain_columns.sql',       '2026-04-26'::timestamptz, 'historical', 'verificado B28 (cols email/phone/notes plain dropped)'),
  ('035_llm_calls_tracking.sql',           '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('036_db_size_history.sql',              '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('037_agent_prompts_history.sql',        '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('038_system_health_score.sql',          '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('039_health_score_history.sql',         '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('040_project_notes.sql',                '2026-04-26'::timestamptz, 'historical', 'verificado B28'),
  ('041_supplier_catalog_seed.sql',        '2026-04-26'::timestamptz, 'historical', 'verificado B28 (22 items seed)'),
  ('042_studio_profile_onboarding.sql',    '2026-04-27'::timestamptz, 'B25 P2 fix critico', 'aplicada via workflow MCP tras descubrir drift'),
  ('043_baseline_identity_fix.sql',        '2026-04-27'::timestamptz, 'B25 P2 fix critico', 'aplicada inline con 042 (identity Demo ArquitAI)'),
  ('044_agent_regulatory_prompt_v2.sql',   '2026-04-29'::timestamptz, 'B27', 'aplicada via workflow MCP tras Reality Check'),
  ('045_activity_log_details.sql',         '2026-04-29'::timestamptz, 'B27', 'aplicada via workflow MCP - desbloqueo 6 crons')
ON CONFLICT (filename) DO NOTHING;

-- Auto-registro de esta misma migration:
INSERT INTO applied_migrations (filename, applied_at, applied_by, notes)
VALUES ('046_applied_migrations_tracking.sql', NOW(), 'B28', 'mecanismo anti-drift introducido')
ON CONFLICT (filename) DO NOTHING;

-- Verificacion:
-- SELECT count(*) FROM applied_migrations; -- esperado: 45 (43 historicas + 044/045 + esta)
