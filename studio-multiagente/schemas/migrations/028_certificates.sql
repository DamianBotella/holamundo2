-- Migration 028: certificates + certificate_templates
-- Fecha: 2026-04-26
--
-- Tabla `certificates` para registrar los certificados tecnicos generados
-- desde plantillas en BD (similar al patron contract_templates).
--
-- Tipos: cfo (Certificado Final de Obra), certificado_habitabilidad,
-- certificado_estructural, certificado_instalacion_electrica (BIE),
-- certificado_instalacion_termica (RITE), informe_idoneidad, otros.
--
-- Plantillas usan single brace {var} (mismo patron contract_templates).
--
-- Workflow asociado: agent_certificate_generator (OqOHU6Uc6FkVWPEu)
-- Endpoint: POST /webhook/certificate-generate con
--   {project_id, certificate_type, signer_name?, collegiate_no?, scope}
-- Crea Google Doc + registra en certificates con status='draft' + email a Damian.

CREATE TABLE IF NOT EXISTS certificates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  certificate_type text NOT NULL CHECK (certificate_type IN (
                    'cfo','certificado_habitabilidad','certificado_estructural',
                    'certificado_instalacion_electrica','certificado_instalacion_termica',
                    'informe_idoneidad','otros')),
  title           text NOT NULL,
  collegiate_no   text,
  signer_name     text,
  doc_url         text,
  doc_id          text,
  issued_at       date,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','signed','registered','cancelled')),
  metadata        jsonb DEFAULT '{}'::jsonb,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_certificates_project ON certificates (project_id, certificate_type);

CREATE TABLE IF NOT EXISTS certificate_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_type text NOT NULL,
  version         integer NOT NULL DEFAULT 1,
  is_active       boolean NOT NULL DEFAULT true,
  title_template  text NOT NULL,
  body_template   text NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (certificate_type, version)
);

CREATE OR REPLACE FUNCTION touch_certificates()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$body$;

DROP TRIGGER IF EXISTS certificates_touch ON certificates;
CREATE TRIGGER certificates_touch BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION touch_certificates();

DROP TRIGGER IF EXISTS certificate_templates_touch ON certificate_templates;
CREATE TRIGGER certificate_templates_touch BEFORE UPDATE ON certificate_templates
  FOR EACH ROW EXECUTE FUNCTION touch_certificates();

-- Plantillas iniciales (7) cargadas via INSERT separado el 2026-04-26.
-- Variables: {project_name} {location_city} {location} {property_area_m2}
--   {today} {client_name} {signer_name} {collegiate_no} {scope}
