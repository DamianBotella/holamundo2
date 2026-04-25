-- Migration 004: safety_plans + UNIQUE constraint en agent_prompts
-- Soporte para agent_safety_plan (EBSS/PSS según RD 1627/1997)
-- Fecha: 2026-04-25

-- ============================================================
-- TABLA: safety_plans
-- Documentos de seguridad y salud generados por agent_safety_plan
-- ============================================================
CREATE TABLE IF NOT EXISTS safety_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  version         integer NOT NULL DEFAULT 1,
  document_type   text NOT NULL DEFAULT 'EBSS' CHECK (document_type IN ('EBSS','PSS')),
  content_json    jsonb,
  google_doc_id   text,
  google_doc_url  text,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','superseded')),
  execution_id    uuid REFERENCES agent_executions(id) ON DELETE SET NULL,
  exec_status     text NOT NULL DEFAULT 'confirmed' CHECK (exec_status IN ('draft','confirmed')),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  approved_at     timestamptz,
  approved_by     text
);

CREATE INDEX IF NOT EXISTS idx_safety_plans_project ON safety_plans (project_id);
CREATE INDEX IF NOT EXISTS idx_safety_plans_status ON safety_plans (status);

-- ============================================================
-- UNIQUE constraint en agent_prompts
-- Permite UPSERT idempotente con ON CONFLICT (agent_name, prompt_type) DO UPDATE.
-- ============================================================
ALTER TABLE agent_prompts
  ADD CONSTRAINT agent_prompts_unique_active UNIQUE (agent_name, prompt_type);

-- ============================================================
-- Verificación post-migración
-- ============================================================
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'safety_plans';
-- SELECT COUNT(*) FROM information_schema.table_constraints
--   WHERE table_name = 'agent_prompts' AND constraint_name = 'agent_prompts_unique_active';
