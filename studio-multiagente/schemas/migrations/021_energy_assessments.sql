-- Migration 021: agent_energy_assessor
-- Fecha: 2026-04-26
--
-- Tabla para almacenar evaluaciones energeticas estimadas (no certificadas) de
-- proyectos de reforma. Genera datos a partir de design + materials usando LLM
-- con conocimiento CTE DB-HE0/HE1, y calcula huella de carbono embebida desde
-- tabla embebida de factores CO2 por categoria/material.
--
-- Workflow asociado: agent_energy_assessor (63XFqhlsg0d1cXav)
-- Webhook: POST /webhook/trigger-energy-assessor con {project_id}
-- Tambien invocable como sub-workflow (executeWorkflowTrigger).
--
-- IMPORTANTE: el resultado es ESTIMACION, no certificacion CEE oficial.
-- La calificacion oficial requiere CE3X/CYPETherm + tecnico certificador.

CREATE TABLE IF NOT EXISTS energy_assessments (
  id                                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                              uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  execution_id                            uuid,
  exec_status                             text DEFAULT 'committed' CHECK (exec_status IN ('draft','committed','rolled_back')),
  version                                 integer NOT NULL DEFAULT 1,
  generated_at                            timestamptz NOT NULL DEFAULT now(),
  zona_climatica                          text,
  -- Demandas energeticas (kWh/m2 anyo)
  demanda_calefaccion_kwh_m2_anyo         numeric(8,2),
  demanda_refrigeracion_kwh_m2_anyo       numeric(8,2),
  demanda_total_kwh_m2_anyo               numeric(8,2),
  -- Envolvente termica
  transmitancia_envolvente_global         numeric(6,3),
  -- Consumo y emisiones
  consumo_energia_primaria_kwh_m2_anyo    numeric(8,2),
  emisiones_co2_kg_m2_anyo                numeric(8,2),
  -- Calificaciones estimadas A-G
  calificacion_demanda                    text CHECK (calificacion_demanda IN ('A','B','C','D','E','F','G')),
  calificacion_emisiones                  text CHECK (calificacion_emisiones IN ('A','B','C','D','E','F','G')),
  -- Huella de carbono embebida (materiales) en kg CO2eq
  huella_carbono_embebida_kg              numeric(12,2),
  huella_carbono_breakdown                jsonb DEFAULT '{}'::jsonb,
  -- Analisis y recomendaciones
  analysis_summary                        text,
  recomendaciones                         jsonb DEFAULT '[]'::jsonb,
  cumple_he0                              boolean,
  cumple_he1                              boolean,
  warnings                                jsonb DEFAULT '[]'::jsonb,
  -- LLM
  llm_model                               text,
  llm_tokens_in                           integer,
  llm_tokens_out                          integer,
  llm_cost_usd                            numeric(10,5),
  created_at                              timestamptz NOT NULL DEFAULT now(),
  updated_at                              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_energy_assessments_project ON energy_assessments (project_id, version DESC);

CREATE OR REPLACE FUNCTION touch_energy_assessments()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$body$;

DROP TRIGGER IF EXISTS energy_assessments_touch ON energy_assessments;
CREATE TRIGGER energy_assessments_touch BEFORE UPDATE ON energy_assessments
  FOR EACH ROW EXECUTE FUNCTION touch_energy_assessments();

-- ============================================================
-- Insertar prompt del agente
-- ============================================================
INSERT INTO agent_prompts (agent_name, prompt_type, version, is_active, content, model_recommended, temperature, notes) VALUES (
  'agent_energy_assessor',
  'system',
  1,
  true,
  E'Eres un asistente experto en eficiencia energetica residencial en Espana. Conoces el CTE DB-HE (HE0/HE1), el procedimiento simplificado CE3X, y los datos de huella de carbono embebida tipicos (ITeC BEDEC). Dado un proyecto con ubicacion + area + design + materiales, ESTIMAS demanda energetica y huella, y generas recomendaciones. NO certificas. Output: UN SOLO JSON con campos zona_climatica, demanda_calefaccion_kwh_m2_anyo, demanda_refrigeracion_kwh_m2_anyo, demanda_total_kwh_m2_anyo, transmitancia_envolvente_global, consumo_energia_primaria_kwh_m2_anyo, emisiones_co2_kg_m2_anyo, calificacion_demanda (A-G), calificacion_emisiones (A-G), cumple_he0 (bool), cumple_he1 (bool), analysis_summary, recomendaciones [{descripcion, impacto_kwh_m2_anyo, prioridad}], warnings [string]. Sin texto adicional, sin markdown.',
  'gpt-4o',
  0.2,
  'agent_energy_assessor MVP - estima demanda CTE HE0/HE1 + recomendaciones'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- Verificacion
-- ============================================================
-- SELECT count(*) FROM information_schema.columns WHERE table_name='energy_assessments';  -- 28
-- SELECT count(*) FROM agent_prompts WHERE agent_name='agent_energy_assessor';  -- 1

-- E2E verificado 2026-04-25/26: proyecto Madrid 72m2 -> zona_climatica='D3',
-- recomendaciones (ventanas PVC bajo emisivo, aislamiento techos+suelos,
-- ventilacion mecanica con recuperacion). Sin materiales declarados los
-- valores numericos quedan null por diseno (LLM no inventa).
