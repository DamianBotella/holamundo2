-- 071: agents_catalog.status (Fase A.2 plan Opus, definicion de hecho)
-- Anade columna status para distinguir agentes built (workflow desplegado)
-- de planned (a construir en Fase B+).
-- Marca los 4 agentes pre-launch como 'planned'.

BEGIN;

ALTER TABLE agents_catalog
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'built'
    CHECK (status IN ('built', 'planned', 'deprecated', 'wip'));

CREATE INDEX IF NOT EXISTS idx_agents_catalog_status
  ON agents_catalog(status);

-- Marcar los 4 agentes Fase B como 'planned' (workflows aun no desplegados)
UPDATE agents_catalog SET status = 'planned'
  WHERE agent_name IN (
    'agent_grants_finder',
    'agent_rcd',
    'agent_iee',
    'agent_telematic_filing'
  );

INSERT INTO applied_migrations (filename, notes) VALUES
  ('071_agents_catalog_status.sql', 'A.2 plan Opus definicion hecho: status en agents_catalog + 4 agentes Fase B planned')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- Verificacion
SELECT status, COUNT(*) AS total FROM agents_catalog GROUP BY status ORDER BY status;
SELECT agent_name, display_name, status FROM agents_catalog WHERE status = 'planned' ORDER BY agent_name;

-- rollback: ALTER TABLE agents_catalog DROP COLUMN IF EXISTS status; DELETE FROM applied_migrations WHERE filename = '071_agents_catalog_status.sql';
