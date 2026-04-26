-- Migration 029: Security hardening fase 2
-- Fecha: 2026-04-26
--
-- Tablas para auditoria, eventos de seguridad y rate limiting + funciones helper
-- + vista security_dashboard para snapshot del estado.

CREATE TABLE IF NOT EXISTS access_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  source_ip       text,
  user_agent      text,
  endpoint        text,
  method          text,
  resource_type   text,
  resource_id     uuid,
  token_id        uuid REFERENCES client_access_tokens(id) ON DELETE SET NULL,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  action          text NOT NULL,
  result          text NOT NULL CHECK (result IN ('success','denied','error','partial')),
  pii_accessed    boolean DEFAULT false,
  rows_affected   integer,
  duration_ms     integer,
  metadata        jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_access_log_occurred ON access_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_log_ip       ON access_log (source_ip, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_log_resource ON access_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_access_log_pii      ON access_log (occurred_at DESC) WHERE pii_accessed = true;
CREATE INDEX IF NOT EXISTS idx_access_log_denied   ON access_log (occurred_at DESC) WHERE result IN ('denied','error');

CREATE TABLE IF NOT EXISTS security_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  event_type      text NOT NULL CHECK (event_type IN (
                    'auth_failed','rate_limit_hit','suspicious_pattern','token_revoked',
                    'token_expired_used','token_compromised','key_rotated','prompt_injection',
                    'sql_injection_attempt','xss_attempt','pen_test_finding','gdpr_violation_risk',
                    'unusual_access_pattern','unauthorized_endpoint','consent_missing','data_breach_suspected')),
  severity        text NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  source_ip       text,
  endpoint        text,
  resource_type   text,
  resource_id     uuid,
  description     text NOT NULL,
  details         jsonb DEFAULT '{}'::jsonb,
  resolved        boolean NOT NULL DEFAULT false,
  resolved_at     timestamptz,
  resolved_by     text,
  resolution_notes text,
  alert_sent      boolean DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sec_events_unresolved ON security_events (severity, occurred_at DESC) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_sec_events_type       ON security_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_ip         ON security_events (source_ip, occurred_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ip       text NOT NULL,
  endpoint        text NOT NULL,
  window_start    timestamptz NOT NULL,
  hit_count       integer NOT NULL DEFAULT 1,
  last_hit_at     timestamptz NOT NULL DEFAULT now(),
  blocked         boolean NOT NULL DEFAULT false,
  blocked_until   timestamptz,
  UNIQUE (source_ip, endpoint, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON rate_limits (blocked_until) WHERE blocked = true;

-- Funcion atomica check_rate_limit(source_ip, endpoint, max_per_minute, max_per_hour)
-- Returns: (allowed boolean, reason text, current_minute integer, current_hour integer)
-- Ver el SQL completo en el script aplicado 2026-04-26.

-- Vista security_dashboard: snapshot del estado de seguridad
-- Cuenta: critical/medium unresolved, eventos 24h, auth failures, rate limit hits,
-- injection attempts, accesos denegados, IPs unicas, tokens activos/stale/expiring,
-- consents activos, clientes sin consent, GDPR pending/near deadline,
-- last_key_rotation, last_pen_test.
