-- Migration 012: agent_financial_tracker (control financiero de obra)
-- Fecha: 2026-04-25
--
-- Objetivo: tracking de facturas (gremios/proveedores) + certificaciones (al
-- cliente) + reconciliación contra cost_estimates. agent_costs estima al
-- inicio; agent_financial_tracker controla durante la obra.

-- ============================================================
-- 1) Facturas recibidas (gremios + proveedores)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_name   text,
  supplier_nif    text,
  invoice_number  text,
  invoice_date    date,
  base_amount     numeric(12,2),
  vat_amount      numeric(12,2),
  total_amount    numeric(12,2),
  vat_rate        numeric(5,2),
  category        text,             -- materiales | mano_obra | servicios | otros
  trade_type      text,             -- albanileria | fontaneria | electricidad | ...
  description     text,
  photo_url       text,
  ocr_summary     text,
  ocr_raw         jsonb,
  ocr_confidence  text CHECK (ocr_confidence IN ('low','medium','high') OR ocr_confidence IS NULL),
  llm_model       text,
  llm_tokens_in   integer,
  llm_tokens_out  integer,
  llm_cost        numeric(10,5),
  status          text NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'pending_review','approved','disputed','paid','rejected'
  )),
  approved_by     text,
  approved_at     timestamptz,
  paid_at         timestamptz,
  paid_amount     numeric(12,2),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices (project_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status  ON invoices (status) WHERE status IN ('pending_review','disputed');
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid  ON invoices (project_id) WHERE paid_at IS NULL AND status NOT IN ('rejected','disputed');

-- ============================================================
-- 2) Certificaciones al cliente
-- ============================================================
CREATE TABLE IF NOT EXISTS certifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version         integer NOT NULL,
  percentage      numeric(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  amount          numeric(12,2) NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'issued' CHECK (status IN (
    'issued','sent','partially_paid','paid','disputed','cancelled'
  )),
  issued_at       timestamptz NOT NULL DEFAULT now(),
  due_date        date,
  paid_at         timestamptz,
  paid_amount     numeric(12,2),
  payment_reference text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

CREATE INDEX IF NOT EXISTS idx_certifications_project ON certifications (project_id, issued_at);
CREATE INDEX IF NOT EXISTS idx_certifications_unpaid  ON certifications (project_id) WHERE paid_at IS NULL AND status != 'cancelled';

-- ============================================================
-- 3) Triggers updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION touch_invoices_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$body$;

DROP TRIGGER IF EXISTS invoices_touch_updated ON invoices;
CREATE TRIGGER invoices_touch_updated BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION touch_invoices_updated_at();

DROP TRIGGER IF EXISTS certifications_touch_updated ON certifications;
CREATE TRIGGER certifications_touch_updated BEFORE UPDATE ON certifications
  FOR EACH ROW EXECUTE FUNCTION touch_invoices_updated_at();

-- ============================================================
-- Verificación post-migración
-- ============================================================
-- SELECT count(*) FROM information_schema.columns WHERE table_name='invoices';        -- 29
-- SELECT count(*) FROM information_schema.columns WHERE table_name='certifications';  -- 15
-- SELECT count(*) FROM pg_trigger WHERE tgname IN ('invoices_touch_updated','certifications_touch_updated'); -- 2
