-- Migration 009: columnas PII cifradas con auto-sync via trigger
-- Fecha: 2026-04-25
--
-- Objetivo: añadir columnas `_enc` (bytea) paralelas a las columnas PII en texto plano,
-- y mantenerlas sincronizadas automáticamente con un trigger BEFORE INSERT/UPDATE.
-- Esto es BACKWARD COMPATIBLE — los workflows existentes siguen leyendo `email`/`phone`/`client_needs`
-- sin cambios. La rotación a "leer solo `_enc`" se hará en una migración futura cuando los
-- agentes estén actualizados para usar `pii_decrypt(...)` en sus SELECT.

-- ============================================================
-- 1) Columnas cifradas paralelas
-- ============================================================
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS email_enc bytea,
  ADD COLUMN IF NOT EXISTS phone_enc bytea,
  ADD COLUMN IF NOT EXISTS notes_enc bytea;

ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS client_needs_enc bytea;

-- ============================================================
-- 2) Trigger de sincronización automática (clients)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_clients_pii_enc()
RETURNS trigger
LANGUAGE plpgsql
AS $body$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email OR (TG_OP = 'INSERT' AND NEW.email IS NOT NULL) THEN
    NEW.email_enc := pii_encrypt(NEW.email);
  END IF;
  IF NEW.phone IS DISTINCT FROM OLD.phone OR (TG_OP = 'INSERT' AND NEW.phone IS NOT NULL) THEN
    NEW.phone_enc := pii_encrypt(NEW.phone);
  END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes OR (TG_OP = 'INSERT' AND NEW.notes IS NOT NULL) THEN
    NEW.notes_enc := pii_encrypt(NEW.notes);
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS clients_sync_pii_enc ON clients;
CREATE TRIGGER clients_sync_pii_enc
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION sync_clients_pii_enc();

-- ============================================================
-- 3) Trigger de sincronización automática (briefings)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_briefings_pii_enc()
RETURNS trigger
LANGUAGE plpgsql
AS $body$
BEGIN
  IF NEW.client_needs IS DISTINCT FROM OLD.client_needs OR (TG_OP = 'INSERT' AND NEW.client_needs IS NOT NULL) THEN
    NEW.client_needs_enc := pii_encrypt(NEW.client_needs::text);
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS briefings_sync_pii_enc ON briefings;
CREATE TRIGGER briefings_sync_pii_enc
  BEFORE INSERT OR UPDATE ON briefings
  FOR EACH ROW EXECUTE FUNCTION sync_briefings_pii_enc();

-- ============================================================
-- 4) Backfill de datos existentes
-- ============================================================
UPDATE clients   SET email_enc = pii_encrypt(email) WHERE email IS NOT NULL AND email_enc IS NULL;
UPDATE clients   SET phone_enc = pii_encrypt(phone) WHERE phone IS NOT NULL AND phone_enc IS NULL;
UPDATE clients   SET notes_enc = pii_encrypt(notes) WHERE notes IS NOT NULL AND notes_enc IS NULL;
UPDATE briefings SET client_needs_enc = pii_encrypt(client_needs::text)
  WHERE client_needs IS NOT NULL AND client_needs_enc IS NULL;

-- ============================================================
-- Verificación post-migración
-- ============================================================
-- SELECT
--   (SELECT count(*) FROM clients   WHERE email IS NOT NULL AND email_enc IS NOT NULL) AS clients_email_paired,
--   (SELECT count(*) FROM clients   WHERE phone IS NOT NULL AND phone_enc IS NOT NULL) AS clients_phone_paired,
--   (SELECT count(*) FROM briefings WHERE client_needs IS NOT NULL AND client_needs_enc IS NOT NULL) AS briefings_paired,
--   (SELECT pii_decrypt(email_enc) = email FROM clients WHERE email IS NOT NULL LIMIT 1) AS roundtrip_ok;

-- ============================================================
-- Próxima fase (manual, no incluida aquí)
-- ============================================================
-- 1. Adaptar agentes a leer `pii_decrypt(email_enc)` en lugar de `email`.
--    Lugares afectados: agent_briefing.Load Project + Client, util_notification, agent_proposal.
-- 2. Una vez todos los agentes leen de `_enc`, dropear las columnas en plano:
--      ALTER TABLE clients   DROP COLUMN email, DROP COLUMN phone, DROP COLUMN notes;
--      ALTER TABLE briefings DROP COLUMN client_needs;
-- 3. Renombrar `email_enc` → `email_pii` (o similar) si se quiere claridad.
-- ATENCIÓN: rotar `encryption_key` en system_config requiere primero descifrar
-- todas las columnas con la clave vieja, luego cambiar la clave, luego re-cifrar.
