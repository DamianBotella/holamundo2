-- 062: catalog_sync_log (Fase A.2 plan Opus, original 021)
-- Auditoria de sincronizaciones de catalogos externos. Sin RLS (tabla operacional/auditoria).

BEGIN;

CREATE TABLE IF NOT EXISTS catalog_sync_log (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente                   text NOT NULL,
  fecha_sync               timestamptz DEFAULT now(),
  productos_actualizados   integer DEFAULT 0,
  productos_nuevos         integer DEFAULT 0,
  productos_eliminados     integer DEFAULT 0,
  errores                  jsonb,
  duracion_segundos        integer,
  status                   text DEFAULT 'pending'
    CHECK (status IN ('pending','running','success','error','partial'))
);

CREATE INDEX IF NOT EXISTS idx_sync_log_fecha  ON catalog_sync_log(fecha_sync DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON catalog_sync_log(status, fecha_sync DESC);

INSERT INTO applied_migrations (filename, notes) VALUES
  ('062_catalog_sync_log.sql', 'A.2 plan Opus (originalmente 021): auditoria sync catalogos sin RLS')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback: DROP TABLE IF EXISTS catalog_sync_log; DELETE FROM applied_migrations WHERE filename = '062_catalog_sync_log.sql';
