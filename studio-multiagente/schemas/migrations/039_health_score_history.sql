-- Migration 039: tabla health_score_history para tracking del system health score
-- Fecha: 2026-04-26
--
-- cron_health_score_snapshot rellena esta tabla diariamente con el snapshot
-- de la vista system_health_score. Asi tenemos histórico para detectar
-- tendencias (¿el score baja sostenido? ¿sube tras un commit?).

CREATE TABLE IF NOT EXISTS health_score_history (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at              timestamptz NOT NULL DEFAULT now(),
  score                    integer NOT NULL,
  color                    text NOT NULL,
  critical_unresolved      integer,
  ips_blocked              integer,
  workflow_errors_24h      integer,
  stuck_executions_1h      integer,
  hours_since_last_backup  integer,
  health_check_ran_24h     boolean,
  clients_without_consent  integer,
  gdpr_pending             integer
);

CREATE INDEX IF NOT EXISTS idx_health_history_snapshot ON health_score_history (snapshot_at DESC);

-- Verificacion (manual):
-- SELECT score, color, snapshot_at FROM health_score_history ORDER BY snapshot_at DESC LIMIT 30;
