-- Migration 027: gdpr_requests + gdpr_client_data_view
-- Fecha: 2026-04-26
--
-- Tabla `gdpr_requests` para registrar solicitudes de derechos RGPD del cliente:
--   access (Art. 15), export/portability (Art. 20), rectification (Art. 16),
--   erasure (Art. 17 - derecho al olvido), restriction (Art. 18), objection (Art. 21).
--
-- Vista `gdpr_client_data_view` consolida todos los datos de un cliente
-- (proyectos, briefings descifrados, design_options, aftercare, conversations,
-- consents) para facilitar el export RGPD Art. 15/20.
--
-- Workflow asociado: gdpr_request (BLSm6Tfo0mJIDuFt)
-- Endpoint publico: POST /webhook/gdpr-request {token, request_type, details, client_email?}
-- Si request_type es access/export/portability: email automatico a Damian con
-- los datos del cliente compilados (para que los reenvie al cliente).
-- Si es erasure/rectification/etc: email a Damian indicando accion manual.
--
-- RGPD obliga a responder en plazo maximo de 1 MES.

CREATE TABLE IF NOT EXISTS gdpr_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  token_id        uuid REFERENCES client_access_tokens(id) ON DELETE SET NULL,
  request_type    text NOT NULL CHECK (request_type IN (
                    'access','export','rectification','erasure','restriction','objection','portability')),
  client_email    text,
  client_ip       text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending','in_review','completed','rejected','partial')),
  details         text,
  response_sent_at timestamptz,
  response_notes  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gdpr_status ON gdpr_requests (status) WHERE status IN ('pending','in_review');
CREATE INDEX IF NOT EXISTS idx_gdpr_client ON gdpr_requests (client_id);

CREATE OR REPLACE FUNCTION touch_gdpr_requests()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$body$;

DROP TRIGGER IF EXISTS gdpr_requests_touch ON gdpr_requests;
CREATE TRIGGER gdpr_requests_touch BEFORE UPDATE ON gdpr_requests
  FOR EACH ROW EXECUTE FUNCTION touch_gdpr_requests();

-- Vista helper: datos personales del cliente exportables (RGPD Art. 15/20)
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
  (SELECT json_agg(json_build_object('id', cc.id, 'asked_at', cc.asked_at, 'question', cc.question, 'answer', cc.answer, 'escalated', cc.escalated))
     FROM client_conversations cc WHERE cc.project_id IN (SELECT id FROM projects WHERE client_id = c.id)) AS conversations,
  (SELECT json_agg(json_build_object('id', cr.id, 'consent_type', cr.consent_type, 'granted_at', cr.granted_at, 'revoked_at', cr.revoked_at))
     FROM consent_records cr WHERE cr.client_id = c.id) AS consents
FROM clients c;
