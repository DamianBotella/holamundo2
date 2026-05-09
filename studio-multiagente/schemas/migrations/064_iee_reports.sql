-- 064: iee_reports + iee_reports_draft (Fase A.2 plan Opus, original 023)
-- Patron Draft/Commit obligatorio (principio inmutable Opus #2).

BEGIN;

-- Draft (status mutable, pre-aprobacion)
CREATE TABLE IF NOT EXISTS iee_reports_draft (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                 uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id                  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  estado_conservacion        text,
  condiciones_accesibilidad  text,
  eficiencia_energetica      text,
  calificacion_global        text CHECK (calificacion_global IN ('A','B','C','D','E','F','G')),
  recomendaciones            jsonb,
  draft_content              jsonb,
  status                     text DEFAULT 'draft'
    CHECK (status IN ('draft','approved','rejected','superseded')),
  approved_by                uuid REFERENCES auth.users(id),
  approved_at                timestamptz,
  created_at                 timestamptz DEFAULT now()
);

-- Final commit (status fijo='approved')
CREATE TABLE IF NOT EXISTS iee_reports (LIKE iee_reports_draft INCLUDING ALL);
ALTER TABLE iee_reports DROP CONSTRAINT IF EXISTS iee_reports_status_check;
ALTER TABLE iee_reports ADD CONSTRAINT iee_reports_status_check CHECK (status = 'approved');

CREATE INDEX IF NOT EXISTS idx_iee_draft_project ON iee_reports_draft(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iee_project       ON iee_reports(project_id, created_at DESC);

ALTER TABLE iee_reports_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE iee_reports       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS iee_draft_tenant ON iee_reports_draft;
CREATE POLICY iee_draft_tenant ON iee_reports_draft
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS iee_tenant ON iee_reports;
CREATE POLICY iee_tenant ON iee_reports
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

INSERT INTO applied_migrations (filename, notes) VALUES
  ('064_iee_reports.sql', 'A.2 plan Opus (originalmente 023): IEE draft+final con patron Draft/Commit')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback: DROP POLICY IF EXISTS iee_tenant ON iee_reports; DROP POLICY IF EXISTS iee_draft_tenant ON iee_reports_draft; DROP TABLE IF EXISTS iee_reports; DROP TABLE IF EXISTS iee_reports_draft; DELETE FROM applied_migrations WHERE filename = '064_iee_reports.sql';
