-- Migration 034: drop columnas plaintext de PII tras cambio a _enc directo
-- Fecha: 2026-04-26
--
-- Pre-requisito: workflows escritores ya no usan question/answer/details plain.
--   client_ask "Save Conversation" -> INSERT con pii_encrypt() directo
--   gdpr_request "Insert Request"  -> INSERT con pii_encrypt() directo
-- Vista gdpr_client_data_view ya lee de _enc (migration 032).
-- Ningun otro workflow lee/escribe estas columnas plain (verificado por grep).
--
-- Esta migracion:
--   1) Dropea triggers de sync (ya no necesarios — los workflows escriben _enc)
--   2) Dropea columnas plain (PII en plaintext eliminado de la BD)

BEGIN;

DROP TRIGGER IF EXISTS client_conversations_sync_pii_enc ON client_conversations;
DROP FUNCTION IF EXISTS sync_client_conversations_pii_enc();

DROP TRIGGER IF EXISTS gdpr_requests_sync_pii_enc ON gdpr_requests;
DROP FUNCTION IF EXISTS sync_gdpr_requests_pii_enc();

ALTER TABLE client_conversations
  DROP COLUMN IF EXISTS question,
  DROP COLUMN IF EXISTS answer;

ALTER TABLE gdpr_requests
  DROP COLUMN IF EXISTS details;

COMMIT;

-- Verificacion (manual):
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='client_conversations' AND column_name IN ('question','answer','question_enc','answer_enc');
--  -> debe devolver solo question_enc, answer_enc
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='gdpr_requests' AND column_name IN ('details','details_enc');
--  -> debe devolver solo details_enc
