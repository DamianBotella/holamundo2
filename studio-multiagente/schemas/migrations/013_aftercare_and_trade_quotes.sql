-- Migration 013: agent_aftercare (postventa LOE) + agent_trade_comms email MVP
-- Fecha: 2026-04-25
--
-- 1. projects.handover_date — fecha de entrega para calcular periodo LOE.
-- 2. aftercare_incidents — incidencias post-entrega clasificadas con Vision.
-- 3. trade_quotes — solicitudes de presupuesto a gremios via email + token de respuesta.

-- ============================================================
-- 1) projects.handover_date
-- ============================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS handover_date date;

-- ============================================================
-- 2) aftercare_incidents
-- ============================================================
CREATE TABLE IF NOT EXISTS aftercare_incidents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  reported_at     timestamptz NOT NULL DEFAULT now(),
  reporter        text NOT NULL DEFAULT 'cliente' CHECK (reporter IN (
    'cliente','arquitecto','gremio','otro'
  )),
  description     text NOT NULL,
  photo_urls      text[],
  category        text CHECK (category IN (
    'acabado','habitabilidad','estructura','instalaciones','otro'
  ) OR category IS NULL),
  responsible_trade text,
  severity        text DEFAULT 'medium' CHECK (severity IN (
    'low','medium','high','urgent'
  )),
  loe_period      integer CHECK (loe_period IN (1,3,10) OR loe_period IS NULL),
  under_warranty  boolean,
  days_since_handover integer,
  status          text NOT NULL DEFAULT 'reported' CHECK (status IN (
    'reported','assigned','in_progress','resolved','escalated','closed','disputed'
  )),
  assigned_to     text,
  assigned_at     timestamptz,
  resolved_at     timestamptz,
  resolved_evidence text[],
  resolution_notes text,
  vision_summary  text,
  vision_raw      jsonb,
  llm_model       text,
  llm_tokens_in   integer,
  llm_tokens_out  integer,
  llm_cost        numeric(10,5),
  alert_sent      boolean DEFAULT false,
  client_contact  text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aftercare_project   ON aftercare_incidents (project_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_aftercare_open      ON aftercare_incidents (status) WHERE status NOT IN ('resolved','closed','disputed');
CREATE INDEX IF NOT EXISTS idx_aftercare_warranty  ON aftercare_incidents (under_warranty, loe_period) WHERE under_warranty IS NOT NULL;

-- Trigger: updated_at + auto-resolved_at cuando status terminal
CREATE OR REPLACE FUNCTION touch_aftercare()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  NEW.updated_at := now();
  IF NEW.status IN ('resolved','closed') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS aftercare_touch ON aftercare_incidents;
CREATE TRIGGER aftercare_touch BEFORE UPDATE ON aftercare_incidents
  FOR EACH ROW EXECUTE FUNCTION touch_aftercare();

-- ============================================================
-- 3) trade_quotes (agent_trade_comms email MVP)
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  trade_request_id uuid REFERENCES trade_requests(id) ON DELETE SET NULL,
  trade_type      text,
  supplier_name   text NOT NULL,
  supplier_email  text NOT NULL,
  supplier_phone  text,
  request_sent_at timestamptz,
  request_email_id text,
  amount          numeric(12,2),
  currency        text DEFAULT 'EUR',
  payment_terms   text,
  estimated_duration text,
  notes           text,
  status          text NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested','quoted','rejected_by_us','rejected_by_supplier',
    'expired','accepted','withdrawn'
  )),
  reply_received_at timestamptz,
  reply_text      text,
  webhook_token   text DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_quotes_project ON trade_quotes (project_id);
CREATE INDEX IF NOT EXISTS idx_trade_quotes_status  ON trade_quotes (status) WHERE status IN ('requested','quoted');
CREATE INDEX IF NOT EXISTS idx_trade_quotes_token   ON trade_quotes (webhook_token);

-- Reuse trigger touch_invoices_updated_at de migración 012
DROP TRIGGER IF EXISTS trade_quotes_touch ON trade_quotes;
CREATE TRIGGER trade_quotes_touch BEFORE UPDATE ON trade_quotes
  FOR EACH ROW EXECUTE FUNCTION touch_invoices_updated_at();

-- ============================================================
-- Verificación post-migración
-- ============================================================
-- SELECT count(*) FROM information_schema.columns WHERE table_name='aftercare_incidents'; -- 30
-- SELECT count(*) FROM information_schema.columns WHERE table_name='trade_quotes';        -- 20
-- SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='handover_date';
