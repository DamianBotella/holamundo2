-- ============================================================
-- Migration 047: DROP funcion check_rate_limit version vieja
-- Fecha: 2026-04-29 (B29 X1)
-- ============================================================
-- Por que: descubierto en X1 al disparar init_new_project. La funcion
-- check_rate_limit existe DUPLICADA en BD:
--   - 008_security_block2.sql: check_rate_limit(text,text,integer) returns text
--   - 029_security_hardening.sql: check_rate_limit(text,text,integer,integer) returns TABLE
--
-- Postgres no puede resolver llamadas con 3 args (unknown,unknown,integer)
-- porque la nueva acepta 3+ args (con default en el 4to). Esto bloquea
-- util_webhook_security y por tanto init_new_project.
--
-- Esta migration DROPea la vieja. La nueva queda como unica.
-- util_webhook_security se actualiza en paralelo (B29) para usar la
-- firma nueva.
--
-- Es el 4to incidente de schema drift de la sesion (042, 044, 045, ahora
-- check_rate_limit dup). El cron_health_check va a extenderse en B29
-- para detectar duplicados de funciones, no solo existencia.
-- ============================================================

DROP FUNCTION IF EXISTS check_rate_limit(text, text, integer);

INSERT INTO applied_migrations (filename, applied_at, applied_by, notes)
VALUES ('047_drop_check_rate_limit_v1.sql', NOW(), 'B29 X1', 'cleanup duplicado funcion. Solo queda la firma 4-args returns TABLE.')
ON CONFLICT (filename) DO NOTHING;

-- Verificacion:
-- SELECT count(*) FROM pg_proc WHERE proname = 'check_rate_limit';
-- esperado: 1 (la nueva, returns TABLE)
