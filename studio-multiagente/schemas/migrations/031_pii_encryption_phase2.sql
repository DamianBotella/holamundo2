-- Migration 031: PII encryption fase 2 (client_conversations + gdpr_requests)
-- Fecha: 2026-04-26
--
-- Continua el patron de migration 009 (backward compatible: columnas _enc paralelas
-- + trigger BEFORE INSERT/UPDATE auto-sincroniza). Los workflows existentes no
-- necesitan cambios — el trigger cifra al insertar/actualizar.
--
-- Cubre PII residual de fase 1:
--   - client_conversations.question / .answer (puede contener detalles personales del cliente)
--   - gdpr_requests.details (descripcion en texto libre — puede contener PII sensible)

-- ============================================================
-- 1) Columnas cifradas paralelas
-- ============================================================
ALTER TABLE client_conversations
  ADD COLUMN IF NOT EXISTS question_enc bytea,
  ADD COLUMN IF NOT EXISTS answer_enc   bytea;

ALTER TABLE gdpr_requests
  ADD COLUMN IF NOT EXISTS details_enc bytea;

-- ============================================================
-- 2) Trigger sincronizacion (client_conversations)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_client_conversations_pii_enc()
RETURNS trigger
LANGUAGE plpgsql
AS $body$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.question IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.question IS DISTINCT FROM OLD.question) THEN
    NEW.question_enc := pii_encrypt(NEW.question);
  END IF;
  IF (TG_OP = 'INSERT' AND NEW.answer IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.answer IS DISTINCT FROM OLD.answer) THEN
    NEW.answer_enc := pii_encrypt(NEW.answer);
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS client_conversations_sync_pii_enc ON client_conversations;
CREATE TRIGGER client_conversations_sync_pii_enc
  BEFORE INSERT OR UPDATE ON client_conversations
  FOR EACH ROW EXECUTE FUNCTION sync_client_conversations_pii_enc();

-- ============================================================
-- 3) Trigger sincronizacion (gdpr_requests)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_gdpr_requests_pii_enc()
RETURNS trigger
LANGUAGE plpgsql
AS $body$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.details IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.details IS DISTINCT FROM OLD.details) THEN
    NEW.details_enc := pii_encrypt(NEW.details);
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS gdpr_requests_sync_pii_enc ON gdpr_requests;
CREATE TRIGGER gdpr_requests_sync_pii_enc
  BEFORE INSERT OR UPDATE ON gdpr_requests
  FOR EACH ROW EXECUTE FUNCTION sync_gdpr_requests_pii_enc();

-- ============================================================
-- 4) Backfill datos existentes
-- ============================================================
UPDATE client_conversations
   SET question_enc = pii_encrypt(question)
 WHERE question IS NOT NULL AND question_enc IS NULL;

UPDATE client_conversations
   SET answer_enc = pii_encrypt(answer)
 WHERE answer IS NOT NULL AND answer_enc IS NULL;

UPDATE gdpr_requests
   SET details_enc = pii_encrypt(details)
 WHERE details IS NOT NULL AND details_enc IS NULL;

-- ============================================================
-- Verificacion (manual)
-- ============================================================
-- SELECT
--   (SELECT count(*) FROM client_conversations WHERE question IS NOT NULL AND question_enc IS NOT NULL) AS conv_question_paired,
--   (SELECT count(*) FROM client_conversations WHERE answer   IS NOT NULL AND answer_enc   IS NOT NULL) AS conv_answer_paired,
--   (SELECT count(*) FROM gdpr_requests WHERE details IS NOT NULL AND details_enc IS NOT NULL) AS gdpr_paired,
--   (SELECT pii_decrypt(question_enc) = question FROM client_conversations WHERE question IS NOT NULL LIMIT 1) AS roundtrip_ok;

-- ============================================================
-- Proxima fase (manual)
-- ============================================================
-- Cuando todos los lectores usen pii_decrypt(question_enc):
--   ALTER TABLE client_conversations DROP COLUMN question, DROP COLUMN answer;
--   ALTER TABLE gdpr_requests        DROP COLUMN details;
