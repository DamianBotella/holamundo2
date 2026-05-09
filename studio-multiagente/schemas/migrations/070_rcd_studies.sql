-- 070: rcd_studies + rcd_studies_draft (Fase A.2 plan Opus, original 029)
-- Estudios de gestion de residuos RD 105/2008. Patron Draft/Commit.
-- Lo usa agent_rcd en Fase B.2.

BEGIN;

-- Draft (status mutable)
CREATE TABLE IF NOT EXISTS rcd_studies_draft (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo_obra                text NOT NULL CHECK (tipo_obra IN ('demolicion','reforma','obra_nueva','rehabilitacion')),
  superficie_m2            numeric(10,2),
  estimacion_residuos      jsonb NOT NULL,
  total_toneladas          numeric(10,3),
  plan_gestion             jsonb,
  gestores_autorizados     jsonb,
  coste_gestion_eur        numeric(10,2),
  alertas_peligrosos       jsonb,
  draft_content            jsonb,
  status                   text DEFAULT 'draft'
    CHECK (status IN ('draft','approved','rejected','superseded')),
  approved_by              uuid REFERENCES auth.users(id),
  approved_at              timestamptz,
  created_at               timestamptz DEFAULT now()
);

-- Final commit (status fijo)
CREATE TABLE IF NOT EXISTS rcd_studies (LIKE rcd_studies_draft INCLUDING ALL);
ALTER TABLE rcd_studies DROP CONSTRAINT IF EXISTS rcd_studies_status_check;
ALTER TABLE rcd_studies ADD CONSTRAINT rcd_studies_status_check CHECK (status = 'approved');

CREATE INDEX IF NOT EXISTS idx_rcd_draft_project ON rcd_studies_draft(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rcd_project       ON rcd_studies(project_id, created_at DESC);

ALTER TABLE rcd_studies_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE rcd_studies       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rcd_draft_tenant ON rcd_studies_draft;
CREATE POLICY rcd_draft_tenant ON rcd_studies_draft
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS rcd_tenant ON rcd_studies;
CREATE POLICY rcd_tenant ON rcd_studies
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

INSERT INTO applied_migrations (filename, notes) VALUES
  ('070_rcd_studies.sql', 'A.2 plan Opus (originalmente 029): RCD draft+final con patron Draft/Commit (Fase B.2)')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback: DROP POLICY IF EXISTS rcd_tenant ON rcd_studies; DROP POLICY IF EXISTS rcd_draft_tenant ON rcd_studies_draft; DROP TABLE IF EXISTS rcd_studies; DROP TABLE IF EXISTS rcd_studies_draft; DELETE FROM applied_migrations WHERE filename = '070_rcd_studies.sql';
