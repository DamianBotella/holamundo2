-- Migration 005: accessibility_audits
-- Soporte para agent_accessibility (auditor DB-SUA 9 + Orden VIV/561/2010)
-- Fecha: 2026-04-25

CREATE TABLE IF NOT EXISTS accessibility_audits (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               uuid REFERENCES projects(id) ON DELETE CASCADE,
  version                  integer NOT NULL DEFAULT 1,
  applies_to_project       boolean NOT NULL DEFAULT true,
  applies_justification    text,
  overall_compliance       text NOT NULL DEFAULT 'pending'
                             CHECK (overall_compliance IN ('compliant','partial','non_compliant','pending')),
  compliance_issues        jsonb DEFAULT '[]',
  recommendations          jsonb DEFAULT '[]',
  commercial_argumentation text,
  content_json             jsonb,
  status                   text NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','approved','superseded')),
  execution_id             uuid REFERENCES agent_executions(id) ON DELETE SET NULL,
  exec_status              text NOT NULL DEFAULT 'confirmed'
                             CHECK (exec_status IN ('draft','confirmed')),
  created_at               timestamptz DEFAULT now(),
  approved_at              timestamptz
);

CREATE INDEX IF NOT EXISTS idx_accessibility_audits_project ON accessibility_audits (project_id);

-- Verificación
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'accessibility_audits';
