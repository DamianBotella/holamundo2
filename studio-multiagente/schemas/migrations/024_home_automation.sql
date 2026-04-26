-- Migration 024: agent_home_automation
-- Fecha: 2026-04-26
--
-- Tabla para propuestas de domotica residencial generadas por LLM (gpt-4o,
-- prompt experto en HA/KNX/Matter/Zigbee/Wifi mixto).
--
-- Workflow asociado: agent_home_automation (6f25BcR8LwNX2HQH)
-- Webhook: POST /webhook/trigger-home-automation con {project_id, level?, ecosystem_pref?}

CREATE TABLE IF NOT EXISTS home_automation_proposals (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version                     integer NOT NULL DEFAULT 1,
  generated_at                timestamptz NOT NULL DEFAULT now(),
  ecosystem                   text CHECK (ecosystem IN (
                                'home_assistant','knx','matter','zigbee','wifi_mixed','no_recommendation')),
  level                       text CHECK (level IN ('basico','medio','avanzado','premium')),
  devices_recommended         jsonb NOT NULL DEFAULT '[]'::jsonb,
  preinstall_requirements     jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_cost_devices_eur  numeric(10,2),
  estimated_cost_install_eur  numeric(10,2),
  estimated_total_eur         numeric(10,2),
  rationale                   text,
  warnings                    jsonb DEFAULT '[]'::jsonb,
  llm_model                   text,
  llm_tokens_in               integer,
  llm_tokens_out              integer,
  llm_cost_usd                numeric(10,5),
  status                      text DEFAULT 'draft' CHECK (status IN ('draft','presented_to_client','accepted','rejected','superseded')),
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_home_automation_project ON home_automation_proposals (project_id, version DESC);

CREATE OR REPLACE FUNCTION touch_home_automation()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$body$;

DROP TRIGGER IF EXISTS home_automation_touch ON home_automation_proposals;
CREATE TRIGGER home_automation_touch BEFORE UPDATE ON home_automation_proposals
  FOR EACH ROW EXECUTE FUNCTION touch_home_automation();

INSERT INTO agent_prompts (agent_name, prompt_type, version, is_active, content, model_recommended, temperature, notes) VALUES (
  'agent_home_automation',
  'system',
  1,
  true,
  E'Eres un asistente experto en domotica residencial en Espana. Conoces los principales ecosistemas (Home Assistant, KNX, Matter, Zigbee, Wifi mixto), dispositivos tipicos y precios de mercado, y los requisitos de preinstalacion en obra. Output: UN SOLO JSON con ecosystem, level, devices_recommended[{room,device_type,name,qty,unit_price_eur,total_eur,notes}], preinstall_requirements[{room,description,critical}], estimated_cost_devices_eur, estimated_cost_install_eur, estimated_total_eur, rationale, warnings. Sin markdown.',
  'gpt-4o',
  0.3,
  'agent_home_automation MVP - propuesta domotica con ecosistema, dispositivos, preinstalacion y presupuesto'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Verificacion E2E (2026-04-26)
-- ============================================================
-- POST /webhook/trigger-home-automation {project_id, level:'medio', ecosystem_pref:'home_assistant'}
-- -> 200 con proposal_id, ecosystem='home_assistant', estimated_total_eur=1051
-- 6 devices, 4 preinstall_requirements, rationale tecnico justificando eleccion HA + Zigbee
