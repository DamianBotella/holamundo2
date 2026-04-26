-- Migration 038: vista system_health_score — score 0-100 del sistema
-- Fecha: 2026-04-26
--
-- Combina señales de seguridad, integridad y operación en un único score
-- 0-100. Permite responder de un vistazo "como va el sistema?".
--
-- Penalizaciones (cada una resta del 100):
--   -25 si critical_unresolved > 0
--   -10 por cada IP en blocklist activa (max -20)
--   -15 si workflow_errors_24h > 0
--   -10 si stuck_executions (failed) ultima hora > 0
--   -10 si ultimo backup > 7 dias
--   -10 si ultimo health_check no corrio en 24h
--   -10 si clients_without_consent > 0
--   -5 si gdpr_pending > 0
--
-- Score >=85: GREEN (todo bien)
-- Score 60-84: YELLOW (vigilar)
-- Score <60: RED (intervenir)

CREATE OR REPLACE VIEW system_health_score AS
WITH signals AS (
  SELECT
    (SELECT count(*) FROM security_events WHERE resolved=false AND severity='critical') AS critical_unresolved,
    (SELECT count(*) FROM ip_blocklist WHERE blocked_until > now()) AS ips_blocked,
    (SELECT count(*) FROM activity_log WHERE action='workflow_error' AND created_at > now() - INTERVAL '24 hours') AS workflow_errors_24h,
    (SELECT count(*) FROM agent_executions WHERE status='failed' AND finished_at > now() - INTERVAL '1 hour') AS stuck_executions_1h,
    (SELECT EXTRACT(EPOCH FROM (now() - max(COALESCE(finished_at, started_at))))/3600 FROM system_backups WHERE status='success') AS hours_since_last_backup,
    (SELECT count(*) FROM activity_log WHERE action='health_check_ok' AND created_at > now() - INTERVAL '24 hours') AS health_check_ran_24h,
    (SELECT count(*) FROM clients c WHERE NOT EXISTS (SELECT 1 FROM consent_records cr WHERE cr.client_id = c.id AND cr.revoked_at IS NULL)) AS clients_without_consent,
    (SELECT count(*) FROM gdpr_requests WHERE status IN ('pending','in_review')) AS gdpr_pending
)
SELECT
  GREATEST(0, 100
    - CASE WHEN s.critical_unresolved > 0 THEN 25 ELSE 0 END
    - LEAST(20, s.ips_blocked * 10)
    - CASE WHEN s.workflow_errors_24h > 0 THEN 15 ELSE 0 END
    - CASE WHEN s.stuck_executions_1h > 0 THEN 10 ELSE 0 END
    - CASE WHEN COALESCE(s.hours_since_last_backup, 9999) > 168 THEN 10 ELSE 0 END
    - CASE WHEN s.health_check_ran_24h = 0 THEN 10 ELSE 0 END
    - CASE WHEN s.clients_without_consent > 0 THEN 10 ELSE 0 END
    - CASE WHEN s.gdpr_pending > 0 THEN 5 ELSE 0 END
  )::int AS score,
  CASE
    WHEN GREATEST(0, 100 - (CASE WHEN s.critical_unresolved > 0 THEN 25 ELSE 0 END) - LEAST(20, s.ips_blocked * 10) - (CASE WHEN s.workflow_errors_24h > 0 THEN 15 ELSE 0 END) - (CASE WHEN s.stuck_executions_1h > 0 THEN 10 ELSE 0 END) - (CASE WHEN COALESCE(s.hours_since_last_backup, 9999) > 168 THEN 10 ELSE 0 END) - (CASE WHEN s.health_check_ran_24h = 0 THEN 10 ELSE 0 END) - (CASE WHEN s.clients_without_consent > 0 THEN 10 ELSE 0 END) - (CASE WHEN s.gdpr_pending > 0 THEN 5 ELSE 0 END)) >= 85 THEN 'green'
    WHEN GREATEST(0, 100 - (CASE WHEN s.critical_unresolved > 0 THEN 25 ELSE 0 END) - LEAST(20, s.ips_blocked * 10) - (CASE WHEN s.workflow_errors_24h > 0 THEN 15 ELSE 0 END) - (CASE WHEN s.stuck_executions_1h > 0 THEN 10 ELSE 0 END) - (CASE WHEN COALESCE(s.hours_since_last_backup, 9999) > 168 THEN 10 ELSE 0 END) - (CASE WHEN s.health_check_ran_24h = 0 THEN 10 ELSE 0 END) - (CASE WHEN s.clients_without_consent > 0 THEN 10 ELSE 0 END) - (CASE WHEN s.gdpr_pending > 0 THEN 5 ELSE 0 END)) >= 60 THEN 'yellow'
    ELSE 'red'
  END AS color,
  s.critical_unresolved,
  s.ips_blocked,
  s.workflow_errors_24h,
  s.stuck_executions_1h,
  COALESCE(s.hours_since_last_backup::int, 9999) AS hours_since_last_backup,
  (s.health_check_ran_24h > 0) AS health_check_ran_24h,
  s.clients_without_consent,
  s.gdpr_pending,
  now() AS computed_at
FROM signals s;

-- Verificacion (manual):
-- SELECT * FROM system_health_score;
