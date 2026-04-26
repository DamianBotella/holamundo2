-- Migration 032: gdpr_client_data_view ahora lee de columnas _enc cifradas
-- Fecha: 2026-04-26
--
-- Tras migration 031 (cifrado de client_conversations.question/answer y
-- gdpr_requests.details), actualizamos la vista de exportacion GDPR para que
-- lea de pii_decrypt(_enc) en lugar de las columnas plain. Asi:
--   - Si en una proxima fase se hace DROP COLUMN question/answer/details
--     (limpieza definitiva de PII en plain), la vista sigue funcionando.
--   - El export GDPR ya solo contiene texto descifrado en runtime, nunca
--     accede al texto plano de las columnas que iremos retirando.
--
-- Esta migracion NO dropea las columnas plain todavia (eso requiere actualizar
-- workflows escritores antes — pendiente fase 5+). Pero deja la vista lista.

CREATE OR REPLACE VIEW gdpr_client_data_view AS
SELECT
  c.id AS client_id,
  c.name AS client_name,
  pii_decrypt(c.email_enc) AS client_email,
  pii_decrypt(c.phone_enc) AS client_phone,
  pii_decrypt(c.notes_enc) AS client_notes,
  c.created_at AS client_created_at,
  (SELECT json_agg(row_to_json(p2)) FROM projects p2 WHERE p2.client_id = c.id) AS projects,
  (SELECT json_agg(json_build_object(
    'briefing_id', b.id, 'project_id', b.project_id,
    'summary', b.summary, 'objectives', b.objectives,
    'client_needs', pii_decrypt(b.client_needs_enc),
    'created_at', b.created_at
  )) FROM briefings b WHERE b.project_id IN (SELECT id FROM projects WHERE client_id = c.id)) AS briefings,
  (SELECT json_agg(row_to_json(d)) FROM design_options d WHERE d.project_id IN (SELECT id FROM projects WHERE client_id = c.id)) AS design_options,
  (SELECT json_agg(row_to_json(a)) FROM aftercare_incidents a WHERE a.project_id IN (SELECT id FROM projects WHERE client_id = c.id)) AS aftercare_incidents,
  (SELECT json_agg(json_build_object(
     'id', cc.id,
     'asked_at', cc.asked_at,
     'question', pii_decrypt(cc.question_enc),
     'answer',   pii_decrypt(cc.answer_enc),
     'escalated', cc.escalated
   ))
     FROM client_conversations cc WHERE cc.project_id IN (SELECT id FROM projects WHERE client_id = c.id)) AS conversations,
  (SELECT json_agg(json_build_object('id', cr.id, 'consent_type', cr.consent_type, 'granted_at', cr.granted_at, 'revoked_at', cr.revoked_at))
     FROM consent_records cr WHERE cr.client_id = c.id) AS consents,
  (SELECT json_agg(json_build_object(
     'id', gr.id,
     'request_type', gr.request_type,
     'status', gr.status,
     'details', pii_decrypt(gr.details_enc),
     'created_at', gr.created_at
   ))
     FROM gdpr_requests gr WHERE gr.client_id = c.id) AS gdpr_requests
FROM clients c;

-- Verificacion (manual):
-- SELECT client_id, conversations FROM gdpr_client_data_view LIMIT 1;
-- -> conversations.question debe ser texto descifrado
