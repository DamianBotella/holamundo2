-- 085: ADDENDUM 2 Bloque 4.1: extender architect_directives para soporte
-- de directivas dirigidas a un agente concreto desde el chat individual.
--
-- Premisa esquema real (mig 066):
--   architect_directives ya existe con: id, tenant_id, categoria,
--   directiva, contexto, prioridad, activa, aplicable_a_agentes (text[]),
--   embedding, source (manual|learned_from_project|imported),
--   origin_project_id, created_at, updated_at.
--
--   El ADDENDUM 2 (POST /api/v1/studio/agent/directive) introduce un caso
--   nuevo: el arquitecto pulsa "Aplicar como directiva" en el chat con un
--   agente concreto, sobre un proyecto concreto. Necesitamos:
--   - agent_name (singular, no array aplicable_a_agentes)
--   - project_id (opcional; NULL = directiva global del estudio)
--   - directive_text (alias semantico de "directiva", para que el agente
--     consuma .directive_text en el SELECT pendientes)
--   - directive_type (correction|question|instruction|pause)
--   - source = 'chat' (ampliar CHECK constraint)
--   - applied_at + applied_in_execution_id (ciclo de vida pendiente->aplicada)
--   - created_by (uuid del arquitecto que dio la directiva)

BEGIN;

-- ============================================================
-- 1. Aniadir columnas faltantes
-- ============================================================
ALTER TABLE architect_directives
  ADD COLUMN IF NOT EXISTS agent_name              text,
  ADD COLUMN IF NOT EXISTS project_id              uuid REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS directive_text          text,
  ADD COLUMN IF NOT EXISTS directive_type          text NOT NULL DEFAULT 'correction',
  ADD COLUMN IF NOT EXISTS applied_at              timestamptz,
  ADD COLUMN IF NOT EXISTS applied_in_execution_id uuid,
  ADD COLUMN IF NOT EXISTS created_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Ampliar CHECK constraint de source para incluir 'chat'
-- ============================================================
ALTER TABLE architect_directives
  DROP CONSTRAINT IF EXISTS architect_directives_source_check;
ALTER TABLE architect_directives
  ADD CONSTRAINT architect_directives_source_check
  CHECK (source IN ('manual','learned_from_project','imported','chat'));

-- ============================================================
-- 3. CHECK constraint para directive_type
-- ============================================================
ALTER TABLE architect_directives
  DROP CONSTRAINT IF EXISTS architect_directives_type_check;
ALTER TABLE architect_directives
  ADD CONSTRAINT architect_directives_type_check
  CHECK (directive_type IN ('correction','question','instruction','pause'));

-- ============================================================
-- 4. Backfill directive_text desde directiva en filas existentes
--    (el agente al consumir lee .directive_text; las filas viejas
--    no se rompen.)
-- ============================================================
UPDATE architect_directives
   SET directive_text = directiva
 WHERE directive_text IS NULL;

-- ============================================================
-- 5. Indice para que cada agente lea sus pendientes en O(log n)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_directives_agent_pending
  ON architect_directives (agent_name, tenant_id, applied_at)
  WHERE applied_at IS NULL AND agent_name IS NOT NULL;

-- ============================================================
-- 6. Registro de migracion
-- ============================================================
INSERT INTO applied_migrations (filename, notes) VALUES (
  '085_architect_directives_extension.sql',
  'ADDENDUM 2 Bloque 4.1: agent_name+project_id+directive_text+directive_type+applied_at+applied_in_execution_id+created_by en architect_directives; source ampliado con chat'
) ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ============================================================
-- Verificacion
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='architect_directives'
--    AND column_name IN ('agent_name','project_id','directive_text','directive_type','applied_at','applied_in_execution_id','created_by');
-- expected: 7 filas
--
-- Probar consumo del agente (simula lo que hara cada agente al arrancar):
-- SELECT id, directive_text, directive_type
--   FROM architect_directives
--  WHERE agent_name = 'agent_costs'
--    AND tenant_id = '<algun tenant>'
--    AND (project_id = '<algun proyecto>' OR project_id IS NULL)
--    AND applied_at IS NULL
--  ORDER BY created_at ASC;

-- ============================================================
-- Rollback
-- ============================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_directives_agent_pending;
-- ALTER TABLE architect_directives DROP CONSTRAINT IF EXISTS architect_directives_type_check;
-- ALTER TABLE architect_directives DROP CONSTRAINT IF EXISTS architect_directives_source_check;
-- ALTER TABLE architect_directives
--   ADD CONSTRAINT architect_directives_source_check
--   CHECK (source IN ('manual','learned_from_project','imported'));
-- ALTER TABLE architect_directives DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE architect_directives DROP COLUMN IF EXISTS applied_in_execution_id;
-- ALTER TABLE architect_directives DROP COLUMN IF EXISTS applied_at;
-- ALTER TABLE architect_directives DROP COLUMN IF EXISTS directive_type;
-- ALTER TABLE architect_directives DROP COLUMN IF EXISTS directive_text;
-- ALTER TABLE architect_directives DROP COLUMN IF EXISTS project_id;
-- ALTER TABLE architect_directives DROP COLUMN IF EXISTS agent_name;
-- DELETE FROM applied_migrations WHERE filename='085_architect_directives_extension.sql';
-- COMMIT;
