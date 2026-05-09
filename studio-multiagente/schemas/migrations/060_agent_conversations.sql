-- 060: Persistencia del chat con agentes (Fase A.4 plan Opus)
-- Reemplaza el chat in-memory por historial real consultable y reentrante.
-- RLS por tenant_id, idempotente, rollback al final.

BEGIN;

-- ============================================================
-- 1. Tabla agent_conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  agent_name   text NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role         text NOT NULL CHECK (role IN ('user', 'agent')),
  content      text NOT NULL,
  metadata     jsonb DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_agent_conv_lookup
  ON agent_conversations (tenant_id, agent_name, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_conv_project
  ON agent_conversations (project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

-- ============================================================
-- 3. RLS por tenant_id (principio inmutable Opus #10)
-- ============================================================
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_conv_tenant_select ON agent_conversations;
CREATE POLICY agent_conv_tenant_select ON agent_conversations
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS agent_conv_tenant_insert ON agent_conversations;
CREATE POLICY agent_conv_tenant_insert ON agent_conversations
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR is_super_admin()
  );

-- ============================================================
-- 4. Tracking
-- ============================================================
INSERT INTO applied_migrations (filename, notes) VALUES
  ('060_agent_conversations.sql', 'A.4 plan Opus: tabla agent_conversations + RLS para chat persistido')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ============================================================
-- VERIFICACION
-- ============================================================
SELECT
  (SELECT COUNT(*) FROM agent_conversations) AS rows_initial,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'agent_conversations') AS indices_count,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'agent_conversations') AS policies_count;

-- ============================================================
-- ROLLBACK (si algo va mal):
-- DROP POLICY IF EXISTS agent_conv_tenant_select ON agent_conversations;
-- DROP POLICY IF EXISTS agent_conv_tenant_insert ON agent_conversations;
-- DROP TABLE IF EXISTS agent_conversations;
-- DELETE FROM applied_migrations WHERE filename = '060_agent_conversations.sql';
-- ============================================================
