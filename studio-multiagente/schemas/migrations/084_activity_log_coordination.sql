-- 084: ADDENDUM 2 Bloque 3+4.2: coordinacion entre agentes en activity_log
-- + vista agent_registry (alias sobre agents_catalog mig 056)
-- + vista v_activity_feed_natural (feed natural del sidebar)
--
-- Premisa esquema real (mvp_schema + 008 + 045):
--   activity_log NO tenia tenant_id; RLS heredaba via project_id -> projects.
--   El ADDENDUM 2 (Bloque 3) requiere filter realtime tenant_id=eq.X, por lo
--   que aqui aniadimos la columna y hacemos backfill desde projects.
-- Premisa agents_catalog (mig 056):
--   Existe ya con agent_name, display_name, category, room_id,
--   default_position (jsonb), status. NO existe agent_registry como tabla;
--   se crea VISTA para no duplicar el seed v7.

BEGIN;

-- ============================================================
-- 1. activity_log: tenant_id + columnas de coordinacion
-- ============================================================
ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS tenant_id    uuid REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS from_agent   text,
  ADD COLUMN IF NOT EXISTS to_agent     text,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'action';

-- Backfill tenant_id desde projects (filas existentes con project_id)
UPDATE activity_log al
   SET tenant_id = p.tenant_id
  FROM projects p
 WHERE al.project_id = p.id
   AND al.tenant_id IS NULL;

-- CHECK constraint para message_type
ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_message_type_check;
ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_message_type_check
  CHECK (message_type IN ('action', 'coordination', 'directive', 'system'));

-- Indices nuevos para sidebar (Bloque 3) y panel coordinacion (Bloque 4.2)
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_project_created
  ON activity_log (tenant_id, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_message_type_created
  ON activity_log (message_type, created_at DESC);

-- ============================================================
-- 2. RLS: anidir politica directa por tenant_id
--    (mantenemos la politica original via project_id en mig 050 para
--    compatibilidad; PostgreSQL combina politicas FOR ALL con OR).
-- ============================================================
DROP POLICY IF EXISTS tenant_isolation_direct ON activity_log;
CREATE POLICY tenant_isolation_direct ON activity_log
  FOR ALL
  USING (tenant_id IS NOT NULL AND (tenant_id = current_tenant_id() OR is_super_admin()))
  WITH CHECK (tenant_id IS NOT NULL AND (tenant_id = current_tenant_id() OR is_super_admin()));

-- ============================================================
-- 3. Vista agent_registry: alias sobre agents_catalog
--    Mapea: category -> agent_type, deriva color_hex,
--    expone default_position.x/y como columnas escalares.
-- ============================================================
CREATE OR REPLACE VIEW agent_registry AS
SELECT
  ac.agent_name,
  ac.display_name,
  CASE
    WHEN ac.category = 'orchestrator' THEN 'orchestrator'
    WHEN ac.category = 'core'         THEN 'core'
    WHEN ac.category = 'util'         THEN 'auxiliary'
    ELSE                                   'auxiliary'
  END AS agent_type,
  CASE
    WHEN ac.category = 'orchestrator' THEN '#F4C430'  -- amarillo (Director)
    WHEN ac.category = 'core'         THEN '#4A90D9'  -- azul (core)
    ELSE                                   '#8A9BA8'  -- gris (auxiliary + util)
  END AS color_hex,
  COALESCE((ac.default_position->>'x')::int, 0) AS default_position_x,
  COALESCE((ac.default_position->>'y')::int, 0) AS default_position_y,
  ac.room_id,
  ac.status,
  ac.display_order
FROM agents_catalog ac;

GRANT SELECT ON agent_registry TO authenticated;

-- ============================================================
-- 4. Vista v_activity_feed_natural: feed para ActivitySidebar
--    Solo message_type='action' (las directivas y coordinacion
--    se muestran en paneles separados).
-- ============================================================
CREATE OR REPLACE VIEW v_activity_feed_natural AS
SELECT
  al.id,
  al.tenant_id,
  al.project_id,
  al.agent_name,
  al.action,
  al.output_summary,
  al.created_at,
  ar.display_name,
  ar.agent_type,
  ar.color_hex
FROM activity_log al
LEFT JOIN agent_registry ar ON ar.agent_name = al.agent_name
WHERE al.message_type = 'action'
ORDER BY al.created_at DESC;

GRANT SELECT ON v_activity_feed_natural TO authenticated;

-- ============================================================
-- 5. Registro de migracion
-- ============================================================
INSERT INTO applied_migrations (filename, notes) VALUES (
  '084_activity_log_coordination.sql',
  'ADDENDUM 2 Bloque 3+4.2: tenant_id/from_agent/to_agent/message_type en activity_log; vista agent_registry sobre agents_catalog; vista v_activity_feed_natural para sidebar'
) ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ============================================================
-- Verificacion
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='activity_log' AND column_name IN ('tenant_id','from_agent','to_agent','message_type');
-- expected: 4 filas
--
-- SELECT agent_name, agent_type, color_hex FROM agent_registry LIMIT 5;
-- expected: 35 filas total, mix orchestrator/core/auxiliary con color_hex correcto
--
-- SELECT COUNT(*) FROM v_activity_feed_natural;
-- expected: >= 0 (filas existentes con message_type='action' default)

-- ============================================================
-- Rollback
-- ============================================================
-- BEGIN;
-- DROP VIEW IF EXISTS v_activity_feed_natural;
-- DROP VIEW IF EXISTS agent_registry;
-- DROP POLICY IF EXISTS tenant_isolation_direct ON activity_log;
-- DROP INDEX IF EXISTS idx_activity_log_message_type_created;
-- DROP INDEX IF EXISTS idx_activity_log_tenant_project_created;
-- ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_message_type_check;
-- ALTER TABLE activity_log DROP COLUMN IF EXISTS message_type;
-- ALTER TABLE activity_log DROP COLUMN IF EXISTS to_agent;
-- ALTER TABLE activity_log DROP COLUMN IF EXISTS from_agent;
-- ALTER TABLE activity_log DROP COLUMN IF EXISTS tenant_id;
-- DELETE FROM applied_migrations WHERE filename='084_activity_log_coordination.sql';
-- COMMIT;
