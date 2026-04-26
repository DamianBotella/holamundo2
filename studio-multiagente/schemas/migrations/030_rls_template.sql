-- Migration 030: RLS multi-tenant template
-- Fecha: 2026-04-26
--
-- Prepara la infraestructura para Row-Level Security multi-tenant pero
-- NO la habilita aun (sigue siendo single-tenant: Damian).
--
-- Crea:
--   - Tabla `tenants` con un unico tenant inicial (Damian).
--   - Columnas tenant_id en projects/clients/collaborators (NULLABLE)
--     con backfill al tenant unico.
--   - Funcion current_tenant_id() que lee 'app.current_tenant' del session config.
--
-- Para habilitar RLS en V2 multi-estudio:
--   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY tenant_isolation ON projects
--     USING (tenant_id = current_tenant_id());
--   CREATE POLICY tenant_insert ON projects FOR INSERT
--     WITH CHECK (tenant_id = current_tenant_id());
-- (repetir por cada tabla con tenant_id)
-- Y en cada conexion: SET LOCAL app.current_tenant = '<tenant_uuid>'

CREATE TABLE IF NOT EXISTS tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  contact_email text,
  active      boolean NOT NULL DEFAULT true,
  plan        text DEFAULT 'free',
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants (slug);

INSERT INTO tenants (slug, name, contact_email)
SELECT 'damian-mtnz', 'Estudio Damian Martinez', value
  FROM system_config WHERE key='architect_email'
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE projects     ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE clients      ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

UPDATE projects     SET tenant_id = (SELECT id FROM tenants WHERE slug='damian-mtnz') WHERE tenant_id IS NULL;
UPDATE clients      SET tenant_id = (SELECT id FROM tenants WHERE slug='damian-mtnz') WHERE tenant_id IS NULL;
UPDATE collaborators SET tenant_id = (SELECT id FROM tenants WHERE slug='damian-mtnz') WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects (tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant  ON clients (tenant_id);
CREATE INDEX IF NOT EXISTS idx_collab_tenant   ON collaborators (tenant_id);

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE AS $body$
  SELECT NULLIF(current_setting('app.current_tenant', true), '')::uuid;
$body$;
