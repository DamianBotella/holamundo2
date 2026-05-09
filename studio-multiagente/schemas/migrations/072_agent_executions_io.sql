-- 072: agent_executions.input + output (Fase B descubrimiento)
-- B63/B64 escribian silenciosamente con continueOnFail:true porque los nodos
-- INSERT INTO agent_executions (..., input, output, metadata) hacian referencia
-- a columnas que no existen. Esta migracion las anade para que los logs reales
-- de los agentes pre-launch (grants/rcd/iee/telematic) queden persistidos.

BEGIN;

ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS input    jsonb;
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS output   jsonb;
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_agent_executions_finished
  ON agent_executions(agent_name, finished_at DESC)
  WHERE status = 'completed';

INSERT INTO applied_migrations (filename, notes) VALUES
  ('072_agent_executions_io.sql', 'B65 fix: anade input/output/metadata jsonb a agent_executions (Fase B agentes los necesitan)')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- Verificacion
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'agent_executions' AND table_schema = 'public'
ORDER BY ordinal_position;

-- rollback: ALTER TABLE agent_executions DROP COLUMN IF EXISTS input; DROP COLUMN IF EXISTS output; DROP COLUMN IF EXISTS metadata; DELETE FROM applied_migrations WHERE filename = '072_agent_executions_io.sql';
