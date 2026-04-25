-- Migration 015: agent_anomaly_detector
-- Tabla idempotente para registrar anomalias estadisticas detectadas
-- en datos acumulados (invoices, certifications, site_reports, aftercare,
-- permit_applications, trade_quotes).
--
-- UNIQUE constraint (entity_type, entity_id, anomaly_type) garantiza que
-- la misma anomalia sobre la misma entidad no se duplica si el cron corre
-- varias veces.

CREATE TABLE IF NOT EXISTS anomalies_detected (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  entity_type     text NOT NULL CHECK (entity_type IN (
    'invoice','certification','site_report','aftercare_incident',
    'permit_application','trade_quote','project'
  )),
  entity_id       uuid NOT NULL,
  anomaly_type    text NOT NULL,
  severity        text NOT NULL DEFAULT 'medium' CHECK (severity IN (
    'info','low','medium','high','critical'
  )),
  description     text NOT NULL,
  baseline_value  numeric,
  observed_value  numeric,
  deviation_pct   numeric(8,2),
  reference_set   text,
  status          text NOT NULL DEFAULT 'new' CHECK (status IN (
    'new','reviewed','accepted','dismissed','escalated'
  )),
  reviewed_by     text,
  reviewed_at     timestamptz,
  alert_sent      boolean DEFAULT false,
  notes           text,
  detected_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anomaly_unique_per_entity UNIQUE (entity_type, entity_id, anomaly_type)
);

CREATE INDEX IF NOT EXISTS idx_anomalies_project  ON anomalies_detected (project_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_status   ON anomalies_detected (status) WHERE status = 'new';
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies_detected (severity) WHERE severity IN ('high','critical');

CREATE OR REPLACE FUNCTION touch_anomalies()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IN ('reviewed','accepted','dismissed','escalated') AND NEW.reviewed_at IS NULL THEN
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS anomalies_touch ON anomalies_detected;
CREATE TRIGGER anomalies_touch BEFORE UPDATE ON anomalies_detected
  FOR EACH ROW EXECUTE FUNCTION touch_anomalies();

-- ============================================================
-- Verificacion post-migracion
-- ============================================================
-- SELECT count(*) FROM information_schema.columns WHERE table_name='anomalies_detected'; -- 19
-- SELECT count(*) FROM pg_constraint WHERE conname='anomaly_unique_per_entity';          -- 1
