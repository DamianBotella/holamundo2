-- ============================================================
-- Migration 054: orchestrator_locks (race condition fix - PA-4)
-- Fecha: 2026-05-03 (B46)
-- ============================================================
-- Por qué: el main_orchestrator no protege contra invocaciones
-- simultáneas. Dos POST /orchestrator para el mismo project_id
-- en <1s ejecutan 2× el mismo agente (briefing duplicado, etc.).
-- Probabilidad baja en single-tenant pero crítica post-X3.
--
-- Estrategia (variante B del plan PA-4): tabla lock con TTL pasivo
-- de 10 min. cleanup_orchestrator_zombies() se llama al inicio
-- de cada nueva invocación del orchestrator. Locks que no se
-- liberan explícitamente se limpian a los 10 min.
--
-- Alternativa rechazada: pg_try_advisory_xact_lock — n8n ejecuta
-- cada nodo Postgres en su propia transacción discreta, el lock
-- liberado al final de la transacción de Load Project no persiste
-- para los nodos posteriores (Run agent_X). Inútil.
--
-- Doc: docs/pa4_advisory_lock_plan.md
-- ============================================================

CREATE TABLE IF NOT EXISTS orchestrator_locks (
  project_id    uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  locked_at     timestamptz NOT NULL DEFAULT now(),
  execution_id  text,
  agent_running text
);

-- Índice para queries por antigüedad (cleanup)
CREATE INDEX IF NOT EXISTS idx_orchestrator_locks_locked_at
  ON orchestrator_locks (locked_at);

-- Función helper: limpia locks zombies (>10 min sin liberar).
-- La llama Load Project en cada nueva invocación.
CREATE OR REPLACE FUNCTION cleanup_orchestrator_zombies()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM orchestrator_locks
  WHERE locked_at < now() - INTERVAL '10 minutes';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Verificación post-aplicación:
--
-- SELECT count(*) FROM orchestrator_locks;  -- esperado: 0
-- SELECT cleanup_orchestrator_zombies();    -- esperado: 0 (sin zombies)
--
-- Después, registrar la migration:
-- INSERT INTO applied_migrations (filename, applied_at)
-- VALUES ('054_orchestrator_locks.sql', now())
-- ON CONFLICT (filename) DO NOTHING;
-- ============================================================
