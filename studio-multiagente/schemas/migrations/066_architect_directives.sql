-- 066: architect_directives (Fase A.2 plan Opus, original 025)
-- Directivas del estudio para guiar a los agentes (estilo, materiales, normativa, etc.).

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS architect_directives (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  categoria           text NOT NULL CHECK (categoria IN (
    'materiales','diseno','presupuesto','normativa','comunicacion_cliente',
    'gremios','contratos','documentacion','estilo'
  )),
  directiva           text NOT NULL,
  contexto            text,
  prioridad           integer DEFAULT 50 CHECK (prioridad BETWEEN 0 AND 100),
  activa              boolean DEFAULT true,
  aplicable_a_agentes text[],
  embedding           vector(1536),
  source              text DEFAULT 'manual'
    CHECK (source IN ('manual','learned_from_project','imported')),
  origin_project_id   uuid REFERENCES projects(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_directives_tenant
  ON architect_directives(tenant_id) WHERE activa = true;
CREATE INDEX IF NOT EXISTS idx_directives_categoria
  ON architect_directives(tenant_id, categoria) WHERE activa = true;
CREATE INDEX IF NOT EXISTS idx_directives_embedding
  ON architect_directives USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

ALTER TABLE architect_directives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS directives_tenant ON architect_directives;
CREATE POLICY directives_tenant ON architect_directives
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

INSERT INTO applied_migrations (filename, notes) VALUES
  ('066_architect_directives.sql', 'A.2 plan Opus (originalmente 025): directivas del estudio + embedding semantico')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback: DROP POLICY IF EXISTS directives_tenant ON architect_directives; DROP TABLE IF EXISTS architect_directives; DELETE FROM applied_migrations WHERE filename = '066_architect_directives.sql';
