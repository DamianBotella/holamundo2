-- Migration 026: contract_templates en BD
-- Fecha: 2026-04-26
--
-- Mueve las 9 plantillas de contratos del jsCode inline (agent_contracts) a BD,
-- permitiendo edicion sin tocar workflow + versionado.
--
-- Variables sustitutuibles en title_template/body_template (single brace):
--   {project_name} {location_city} {location} {property_area_m2} {today}
--   {partiesText} {scope} {amount_text} {client_name}
--
-- IMPORTANTE: usar single brace {var} (no double {{var}}) porque n8n procesa
-- {{}} como expresion al evaluar queryReplacement, transformando los nombres
-- en undefined. Single brace es seguro.
--
-- agent_contracts (Abwnfh4BtHPU9lHg) actualizado para leer plantilla de BD
-- y aplicar regex /\{(\w+)\}/g con render var-by-var.

CREATE TABLE IF NOT EXISTS contract_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_type   text NOT NULL,
  version         integer NOT NULL DEFAULT 1,
  is_active       boolean NOT NULL DEFAULT true,
  title_template  text NOT NULL,
  body_template   text NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_type, version)
);
CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON contract_templates (contract_type) WHERE is_active = true;

CREATE OR REPLACE FUNCTION touch_contract_templates()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$body$;

DROP TRIGGER IF EXISTS contract_templates_touch ON contract_templates;
CREATE TRIGGER contract_templates_touch BEFORE UPDATE ON contract_templates
  FOR EACH ROW EXECUTE FUNCTION touch_contract_templates();

-- Las 9 plantillas iniciales (encargo_profesional, contrato_cliente, contrato_gremio,
-- acta_replanteo, acta_recepcion_provisional, acta_recepcion_definitiva, modificado_obra,
-- renuncia_garantia, otros) se cargan via INSERT en otro batch para mantener este
-- archivo legible. Ver INSERT script aplicado 2026-04-26.
