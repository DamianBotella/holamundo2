-- ============================================================
-- Migration 045: anade columna activity_log.details
-- Fecha: 2026-04-29 (B27)
-- ============================================================
-- Por que: Reality Checker detecto que 6+ crons activos fallan todos los
-- dias porque insertan en activity_log.details, pero esa columna NUNCA
-- existio en el schema deployado (mvp_schema.sql:474-495). Es la misma
-- clase de bug que migration 042 sin aplicar: schema drift silencioso.
--
-- Crons afectados (todos rotos hasta aplicar esta migration):
-- - cron_health_check (ztTrZupYJiQmkNGW) - log OK falla, los checks
--   pasan pero el "todo bien" nunca se registra. Estamos ciegos.
-- - cron_proposal_response_followup (YHTfBfLeaSFD7Vma)
-- - cron_backup_verify (ERiFhqiHEpcwHEbz)
-- - cron_db_size_check (edBWaDXssbrp96X0)
-- - cron_data_integrity (XP04imsIGNlr1smJ)
-- - cron_normativa_freshness (bMhUwi8PdlIlh5aW)
--
-- Solucion elegida: anadir la columna (en lugar de refactor 6 workflows).
-- Es coherente con la convencion implicita de los crons recientes y
-- mantiene compatible los workflows existentes que ya usan output_summary.
-- ============================================================

ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}'::jsonb;

-- Indice para queries que filtran por keys especificos del JSON
CREATE INDEX IF NOT EXISTS idx_activity_log_details_gin
  ON activity_log USING GIN (details);

-- Verificacion:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'activity_log' AND column_name = 'details';
-- esperado: 1 fila con details
