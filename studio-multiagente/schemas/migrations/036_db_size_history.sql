-- Migration 036: histórico de tamaño de BD para detectar crecimientos anómalos
-- Fecha: 2026-04-26
--
-- Tabla simple que cron_db_size_check rellena diariamente con snapshot del
-- pg_database_size + tamaño por tabla (top 20). Permite detectar:
-- - Crecimiento anormal de la BD (>50% en 7d)
-- - Tabla individual que crece >100% en 7d (probable bug de logging
--   descontrolado)
-- - Tendencia para presupuestar storage

CREATE TABLE IF NOT EXISTS db_size_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at     timestamptz NOT NULL DEFAULT now(),
  total_bytes     bigint NOT NULL,
  total_mb        numeric(12,2) GENERATED ALWAYS AS (round(total_bytes::numeric / 1048576, 2)) STORED,
  table_count     integer,
  by_table_top20  jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes           text
);

CREATE INDEX IF NOT EXISTS idx_db_size_snapshot ON db_size_history (snapshot_at DESC);

-- Verificacion (manual):
-- SELECT total_mb, snapshot_at FROM db_size_history ORDER BY snapshot_at DESC LIMIT 7;
