-- Migration 018: qc_checks (Quality Control checklists por fase)
-- Fecha: 2026-04-25
--
-- Una checklist de calidad por fase del proyecto. Cada item de la lista
-- vive dentro del jsonb 'items' (id/label/description/status/comment/evidence_url/checked_at).
-- El status del checklist se recalcula automaticamente con un trigger:
--   - todos pass/skip  -> 'complete'
--   - algun fail        -> 'blocked'
--   - algun pass        -> 'in_progress'
--   - todos pending     -> 'open'
--
-- Workflows asociados:
--   - qc_generate (ge3Do1cEeSDuCtzk): POST /webhook/qc-generate genera checklist desde template
--   - qc_complete (JTPN78VZtz8i0ZwB): POST /webhook/qc-complete actualiza un item

CREATE TABLE IF NOT EXISTS qc_checks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_key         text NOT NULL CHECK (phase_key IN (
                      'demolicion','replanteo','albanileria',
                      'instalaciones_electricas','instalaciones_fontaneria','instalaciones_climatizacion',
                      'aislamiento_carpinteria','pavimentos_revestimientos','sanitarios_griferia',
                      'pintura','recepcion_provisional','otros')),
  template_version  text NOT NULL DEFAULT 'v1',
  generated_at      timestamptz NOT NULL DEFAULT now(),
  generated_by      text DEFAULT 'arquitecto',
  items             jsonb NOT NULL DEFAULT '[]'::jsonb,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','complete','blocked','cancelled')),
  completed_at      timestamptz,
  evidence_summary  text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, phase_key, template_version)
);

CREATE INDEX IF NOT EXISTS idx_qc_checks_project ON qc_checks (project_id, phase_key);
CREATE INDEX IF NOT EXISTS idx_qc_checks_status  ON qc_checks (status) WHERE status NOT IN ('complete','cancelled');

-- Trigger: recalcula status segun items y mantiene updated_at + completed_at
CREATE OR REPLACE FUNCTION touch_qc_checks()
RETURNS trigger LANGUAGE plpgsql AS $body$
DECLARE
  v_total   int;
  v_pass    int;
  v_fail    int;
  v_skip    int;
  v_pending int;
BEGIN
  NEW.updated_at := now();

  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_total   FROM jsonb_array_elements(NEW.items);
  SELECT count(*) INTO v_pass    FROM jsonb_array_elements(NEW.items) it WHERE it->>'status' = 'pass';
  SELECT count(*) INTO v_fail    FROM jsonb_array_elements(NEW.items) it WHERE it->>'status' = 'fail';
  SELECT count(*) INTO v_skip    FROM jsonb_array_elements(NEW.items) it WHERE it->>'status' = 'skip';
  SELECT count(*) INTO v_pending FROM jsonb_array_elements(NEW.items) it WHERE it->>'status' = 'pending';

  IF v_total = 0 THEN
    NEW.status := 'open';
  ELSIF v_fail > 0 THEN
    NEW.status := 'blocked';
  ELSIF v_pending = 0 AND (v_pass + v_skip) = v_total THEN
    NEW.status := 'complete';
    IF NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
  ELSIF v_pass > 0 OR v_skip > 0 THEN
    NEW.status := 'in_progress';
  ELSE
    NEW.status := 'open';
  END IF;

  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS qc_checks_touch ON qc_checks;
CREATE TRIGGER qc_checks_touch
  BEFORE INSERT OR UPDATE ON qc_checks
  FOR EACH ROW EXECUTE FUNCTION touch_qc_checks();

-- ============================================================
-- Verificacion
-- ============================================================
-- SELECT count(*) FROM information_schema.columns WHERE table_name='qc_checks';  -- 13
-- SELECT tgname FROM pg_trigger WHERE tgrelid='qc_checks'::regclass;             -- qc_checks_touch
