-- 087: ADDENDUM 2 Bloque 5: cola para agent_normativa_fetch.
--
-- Cuando un arquitecto trabaja en un municipio que ArquitAI no conoce
-- (sin reglas en municipal_pgou_rules), encolamos un job aqui y el
-- agente lo procesa en segundo plano (Jina AI Reader + LLM extraccion).

BEGIN;

CREATE TABLE IF NOT EXISTS municipal_onboarding_queue (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  municipio_slug      text NOT NULL,
  municipio_nombre    text NOT NULL,
  provincia           text,
  comunidad_autonoma  text,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','done','failed')),
  source_url          text,
  rules_extracted     int DEFAULT 0,
  error_message       text,
  requested_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz,
  completed_at        timestamptz,
  -- Un municipio se encola maximo una vez por tenant (el agente puede
  -- re-correr el mismo job con ON CONFLICT DO UPDATE para reintento).
  UNIQUE (tenant_id, municipio_slug)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_queue_pending
  ON municipal_onboarding_queue (status, created_at)
  WHERE status IN ('pending','running');

CREATE INDEX IF NOT EXISTS idx_onboarding_queue_tenant
  ON municipal_onboarding_queue (tenant_id, status);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE municipal_onboarding_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON municipal_onboarding_queue;
CREATE POLICY tenant_isolation ON municipal_onboarding_queue
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- ============================================================
-- Registro de migracion
-- ============================================================
INSERT INTO applied_migrations (filename, notes) VALUES (
  '087_municipal_onboarding_queue.sql',
  'ADDENDUM 2 Bloque 5: cola para agent_normativa_fetch (alta automatica de municipios desconocidos)'
) ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ============================================================
-- Verificacion
-- ============================================================
-- INSERT INTO municipal_onboarding_queue (tenant_id, municipio_slug, municipio_nombre, provincia, comunidad_autonoma)
-- VALUES ('<tenant_id>', 'alcobendas', 'Alcobendas', 'Madrid', 'Comunidad de Madrid');
-- expected: 1 fila status='pending', UNIQUE (tenant_id, municipio_slug) bloquea duplicados

-- ============================================================
-- Rollback
-- ============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS tenant_isolation ON municipal_onboarding_queue;
-- DROP TABLE IF EXISTS municipal_onboarding_queue;
-- DELETE FROM applied_migrations WHERE filename='087_municipal_onboarding_queue.sql';
-- COMMIT;
