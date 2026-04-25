-- Migration 008: bloque seguridad #2 (cifrado PII, rate limit, audit log enriquecido, backups)
-- Fecha: 2026-04-25
--
-- Cambios:
--  1. Extensión pgcrypto + funciones helper pii_encrypt() / pii_decrypt() con clave en system_config.
--  2. Tabla rate_limit_log + función check_rate_limit() para limitar peticiones por IP/endpoint.
--  3. Tabla system_backups para registrar dumps externos (uso futuro por cron_external_backup).
--  4. Columnas source_ip + user_agent en activity_log (enriquecimiento de auditoría).

-- ============================================================
-- 1) pgcrypto + clave maestra de cifrado
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO system_config (key, value, description) VALUES
  ('encryption_key',
   encode(gen_random_bytes(32), 'hex'),
   'Clave simétrica usada por pii_encrypt/pii_decrypt (pgp_sym_*). Rotar siguiendo el mismo procedimiento que webhook_api_key.')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2) Helpers de cifrado PII
-- ============================================================
-- Se usan SECURITY DEFINER para que la clave nunca aparezca en logs de queries normales.
CREATE OR REPLACE FUNCTION pii_encrypt(p_text text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
AS $body$
DECLARE
  v_key text;
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  SELECT value INTO v_key FROM system_config WHERE key = 'encryption_key';
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'encryption_key missing in system_config';
  END IF;
  RETURN pgp_sym_encrypt(p_text, v_key);
END;
$body$;

CREATE OR REPLACE FUNCTION pii_decrypt(p_data bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $body$
DECLARE
  v_key text;
BEGIN
  IF p_data IS NULL THEN RETURN NULL; END IF;
  SELECT value INTO v_key FROM system_config WHERE key = 'encryption_key';
  RETURN pgp_sym_decrypt(p_data, v_key);
END;
$body$;

-- ============================================================
-- 3) Rate limit por IP / endpoint
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id              bigserial PRIMARY KEY,
  source_ip       text NOT NULL,
  endpoint        text NOT NULL,
  request_count   integer NOT NULL DEFAULT 1,
  window_start    timestamptz NOT NULL,
  blocked         boolean NOT NULL DEFAULT false,
  last_request_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_limit_unique_window UNIQUE (source_ip, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window
  ON rate_limit_log (window_start DESC);

-- Devuelve 'allowed' o 'blocked'. La cuenta se mantiene por minuto truncado.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip text,
  p_endpoint text,
  p_max_per_minute integer DEFAULT 60
)
RETURNS text
LANGUAGE plpgsql
AS $body$
DECLARE
  v_window timestamptz := date_trunc('minute', now());
  v_count  integer;
BEGIN
  INSERT INTO rate_limit_log (source_ip, endpoint, request_count, window_start, last_request_at, blocked)
  VALUES (p_ip, p_endpoint, 1, v_window, now(), false)
  ON CONFLICT (source_ip, endpoint, window_start) DO UPDATE
    SET request_count   = rate_limit_log.request_count + 1,
        last_request_at = now()
  RETURNING request_count INTO v_count;

  IF v_count > p_max_per_minute THEN
    UPDATE rate_limit_log
       SET blocked = true
     WHERE source_ip = p_ip
       AND endpoint = p_endpoint
       AND window_start = v_window;
    RETURN 'blocked';
  END IF;

  RETURN 'allowed';
END;
$body$;

-- ============================================================
-- 4) Registro de backups externos
-- ============================================================
CREATE TABLE IF NOT EXISTS system_backups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type   text NOT NULL CHECK (backup_type IN ('postgres_dump','json_export','partial')),
  destination   text NOT NULL,            -- 'gdrive:/folder/file', 's3://...'
  size_bytes    bigint,
  duration_ms   integer,
  status        text NOT NULL CHECK (status IN ('success','failed','partial')),
  error_message text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_backups_created
  ON system_backups (created_at DESC);

-- ============================================================
-- 5) Audit log enriquecido (IP + user-agent)
-- ============================================================
ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS source_ip  text,
  ADD COLUMN IF NOT EXISTS user_agent text;

-- ============================================================
-- Verificación post-migración
-- ============================================================
-- SELECT count(*) FROM pg_proc WHERE proname IN ('pii_encrypt','pii_decrypt','check_rate_limit'); -- 3
-- SELECT pii_decrypt(pii_encrypt('hola')); -- 'hola'
-- SELECT check_rate_limit('127.0.0.1','test',5); -- 'allowed'
-- SELECT column_name FROM information_schema.columns WHERE table_name='activity_log' AND column_name IN ('source_ip','user_agent');

-- ============================================================
-- Rotación de la clave de cifrado
-- ============================================================
-- IMPORTANTE: si rotas encryption_key, todos los pii_decrypt() sobre datos previos fallarán.
-- Procedimiento correcto:
--   1) Descifrar columnas con la clave vieja a texto plano temporalmente.
--   2) UPDATE system_config SET value = encode(gen_random_bytes(32),'hex') WHERE key='encryption_key';
--   3) Re-cifrar las columnas con la clave nueva.
-- Se recomienda rotación cada 12 meses o tras sospecha de filtración.
