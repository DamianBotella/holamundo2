-- Migration 014: agent_pathology (deteccion de patologias durante visita previa)
-- Fecha: 2026-04-25
--
-- Casos de uso especificos en edificacion espanola: humedades por capilaridad,
-- aluminosis (forjados Magne 1958-1972), carbonatacion del hormigon,
-- instalaciones REBT pre-2002, carpinteria con puente termico, terrazo con
-- potencial amianto, plomo en fontaneria pre-1980.

CREATE TABLE IF NOT EXISTS pathology_findings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inspection_date timestamptz NOT NULL DEFAULT now(),
  inspector       text DEFAULT 'arquitecto' CHECK (inspector IN (
    'arquitecto','aparejador','cliente','perito','otro'
  )),
  location_in_property text,
  photo_urls      text[] NOT NULL,
  description     text,
  pathology_type  text CHECK (pathology_type IN (
    'humedad_capilaridad','humedad_filtracion','humedad_condensacion',
    'fisura_estructural','fisura_no_estructural','asentamiento',
    'aluminosis','carbonatacion','oxidacion_armadura',
    'instalacion_electrica_obsoleta','instalacion_fontaneria_obsoleta','instalacion_gas_obsoleta',
    'carpinteria_deteriorada','puente_termico','sin_aislamiento',
    'amianto_sospechoso','plomo_sospechoso','radon_sospechoso',
    'termitas','xilofagos','moho',
    'material_deteriorado','superficie_irregular','otra'
  ) OR pathology_type IS NULL),
  severity        text DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  urgency         text DEFAULT 'programar' CHECK (urgency IN (
    'informativo','programar','urgente','inmediato'
  )),
  structural      boolean,
  affects_safety  boolean DEFAULT false,
  affects_habitability boolean DEFAULT false,
  recommended_action text,
  estimated_intervention_cost_min numeric(10,2),
  estimated_intervention_cost_max numeric(10,2),
  requires_specialist boolean DEFAULT false,
  specialist_type text,
  vision_summary  text,
  vision_raw      jsonb,
  llm_model       text,
  llm_tokens_in   integer,
  llm_tokens_out  integer,
  llm_cost        numeric(10,5),
  status          text NOT NULL DEFAULT 'detected' CHECK (status IN (
    'detected','confirmed','scheduled','in_repair','repaired','monitored','dismissed'
  )),
  alert_sent      boolean DEFAULT false,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pathology_project    ON pathology_findings (project_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_pathology_open       ON pathology_findings (status) WHERE status NOT IN ('repaired','dismissed');
CREATE INDEX IF NOT EXISTS idx_pathology_critical   ON pathology_findings (severity) WHERE severity IN ('high','critical');
CREATE INDEX IF NOT EXISTS idx_pathology_safety     ON pathology_findings (affects_safety) WHERE affects_safety = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION touch_pathology()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS pathology_touch ON pathology_findings;
CREATE TRIGGER pathology_touch BEFORE UPDATE ON pathology_findings
  FOR EACH ROW EXECUTE FUNCTION touch_pathology();

-- ============================================================
-- Verificacion post-migracion
-- ============================================================
-- SELECT count(*) FROM information_schema.columns WHERE table_name='pathology_findings'; -- 29
-- SELECT count(*) FROM pg_indexes WHERE tablename='pathology_findings';                  -- 5
-- SELECT count(*) FROM pg_trigger WHERE tgname='pathology_touch';                        -- 1
