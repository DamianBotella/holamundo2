-- Migration 022: agent_contracts
-- Fecha: 2026-04-26
--
-- Tabla para gestionar el ciclo de vida de contratos y actas del estudio:
-- generacion (Google Doc desde plantilla embebida) -> revision -> envio
-- al firmante -> firmado -> archivado.
--
-- Plantillas embebidas (MVP, en jsCode del workflow agent_contracts):
--   - encargo_profesional (cliente <-> arquitecto)
--   - contrato_cliente (contratista <-> cliente, obra)
--   - contrato_gremio (subcontratista <-> contratista)
--   - acta_replanteo
--   - acta_recepcion_provisional
--   - acta_recepcion_definitiva
--   - modificado_obra
--   - renuncia_garantia (cliente renuncia a garantia tras desoir DF)
--   - otros (placeholder editable)
--
-- Workflows:
--   - agent_contracts (Abwnfh4BtHPU9lHg): POST /webhook/contract-generate
--   - contract_mark_signed (QK640K7iJ9dPJATR): POST /webhook/contract-signed
--
-- Firma digital en MVP: manual. Damian descarga PDF, manda al firmante por
-- email/whatsapp, recibe firmado, marca como signed via webhook. Fase 2:
-- integracion DocuSign/Autofirma/FNMT.

CREATE TABLE IF NOT EXISTS contracts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_type   text NOT NULL CHECK (contract_type IN (
                    'encargo_profesional','contrato_cliente','contrato_gremio',
                    'acta_replanteo','acta_recepcion_provisional','acta_recepcion_definitiva',
                    'modificado_obra','renuncia_garantia','otros')),
  title           text NOT NULL,
  parties         jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_used   text,
  doc_url         text,
  doc_id          text,
  pdf_url         text,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN (
                    'draft','ready_to_sign','sent','partially_signed','signed','rejected','expired','cancelled')),
  generated_at    timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  signed_at       timestamptz,
  signer_email    text,
  signature_hash  text,
  signed_doc_url  text,
  expires_at      timestamptz,
  amount_eur      numeric(12,2),
  scope           text,
  notes           text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts (project_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_status  ON contracts (status) WHERE status NOT IN ('signed','cancelled','rejected');

CREATE OR REPLACE FUNCTION touch_contracts()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed' AND NEW.signed_at IS NULL THEN
    NEW.signed_at := now();
  END IF;
  IF NEW.status = 'sent' AND OLD.status IS DISTINCT FROM 'sent' AND NEW.sent_at IS NULL THEN
    NEW.sent_at := now();
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS contracts_touch ON contracts;
CREATE TRIGGER contracts_touch BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION touch_contracts();

-- ============================================================
-- Verificacion E2E (2026-04-25/26)
-- ============================================================
-- POST /webhook/contract-generate {project_id, contract_type='encargo_profesional',
--   parties:[{role:'cliente', name:'Maria', dni, email}, {role:'arquitecto',...}],
--   scope, amount_eur:4800, expires_days:60}
-- -> 201 con contract_id, doc_url Google Docs, expires_at +60d
-- POST /webhook/contract-signed {contract_id, signer_email, signed_doc_url}
-- -> 200 con contract_status='signed', signed_at=now() (touch trigger)
