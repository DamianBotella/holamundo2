-- Migration 011: agent_site_monitor (seguimiento de obra con Claude Vision)
-- Fecha: 2026-04-25
--
-- Objetivo: persistir reportes de obra generados a partir de fotos
-- subidas por el arquitecto. Claude Vision (gpt-4o) compara la imagen
-- con el plan de obra aprobado y devuelve fase detectada, progress_pct,
-- desviaciones e incidencias.

CREATE TABLE IF NOT EXISTS site_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reported_at     timestamptz NOT NULL DEFAULT now(),
  reporter        text DEFAULT 'arquitecto',
  photo_urls      text[] NOT NULL,
  observations    text,
  expected_phase  text,
  detected_phase  text,
  progress_pct    numeric(5,2),
  deviations      jsonb DEFAULT '[]'::jsonb,
  issues_detected jsonb DEFAULT '[]'::jsonb,
  vision_summary  text,
  vision_raw      jsonb,
  llm_model       text,
  llm_tokens_in   integer,
  llm_tokens_out  integer,
  llm_cost        numeric(10,5),
  alert_sent      boolean DEFAULT false,
  status          text NOT NULL DEFAULT 'analyzed' CHECK (status IN (
    'pending','analyzed','flagged','reviewed'
  )),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_reports_project
  ON site_reports (project_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_reports_status
  ON site_reports (status) WHERE status IN ('flagged','pending');

-- ============================================================
-- Verificación post-migración
-- ============================================================
-- SELECT count(*) FROM information_schema.columns WHERE table_name='site_reports'; -- 20
