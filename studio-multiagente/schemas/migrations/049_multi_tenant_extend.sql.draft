-- Migration 049: extender multi-tenant a tablas raiz
-- Fecha planificada: X3 (multi-tenant + RLS)
-- Estado: DRAFT - no aplicar hasta cerrar diseno X3 con Damian.
--
-- Premisa: 030 anadio tenant_id a projects/clients/collaborators.
-- 049 anade tenant_id a las tablas raiz que NO heredan via project_id
-- (las tablas pipeline heredaran tenant via JOIN a projects en 050).
--
-- Tablas afectadas:
--   - studio_profile        (cada estudio su perfil)
--   - onboarding_sessions   (sesion del onboarding chat de un tenant)
--   - supplier_catalog      (catalogo de proveedores del estudio)
--   - project_notes         (notas internas de un estudio)
--   - contract_templates    (plantillas; algunas globales, otras por tenant)
--   - certificates          (cuando se generan, pertenecen a tenant)
--
-- NO se anade tenant_id a:
--   - agent_prompts             (compartido todos los tenants - prompts globales)
--   - normativa_knowledge       (compartido - normativa espanola es la misma)
--   - normativa_sources         (compartido)
--   - price_references          (CYPE/BEDEC son globales)
--   - llm_calls                 (global - tracking total)
--   - security_events           (global - infra)
--   - access_log                (global - infra)
--   - rate_limits               (global - infra)
--   - ip_blocklist              (global - infra)
--   - applied_migrations        (global - meta)
--   - system_config             (global - meta)
--   - system_health_score       (global - meta)
--   - db_size_history           (global - meta)
--   - tenants                   (la propia tabla de tenants)

BEGIN;

-- ============================================================
-- 1. studio_profile - cada estudio su perfil
-- ============================================================
ALTER TABLE studio_profile
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

UPDATE studio_profile
   SET tenant_id = (SELECT id FROM tenants WHERE slug='damian-mtnz')
 WHERE tenant_id IS NULL;

-- garantia: 1 perfil activo por tenant (en lugar del global active=true)
DROP INDEX IF EXISTS idx_studio_profile_active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_profile_active_per_tenant
  ON studio_profile (tenant_id) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_studio_profile_tenant
  ON studio_profile (tenant_id);

-- ============================================================
-- 2. onboarding_sessions - sesion onboarding por tenant
-- ============================================================
ALTER TABLE onboarding_sessions
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

UPDATE onboarding_sessions
   SET tenant_id = (SELECT id FROM tenants WHERE slug='damian-mtnz')
 WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_tenant
  ON onboarding_sessions (tenant_id);

-- ============================================================
-- 3. supplier_catalog - catalogo del estudio
-- ============================================================
ALTER TABLE supplier_catalog
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

-- los 22 items seed son genericos -> los marcamos como NULL tenant
-- (cross-tenant) y los nuevos tendran tenant_id real.
-- RLS politica permitira ver tenant_id IS NULL O tenant_id = current.
-- Items que YA insertaron usuarios se asignan al tenant baseline.
UPDATE supplier_catalog
   SET tenant_id = (SELECT id FROM tenants WHERE slug='damian-mtnz')
 WHERE tenant_id IS NULL
   AND source_type IN ('catalog', 'quote');  -- no tocar 'global_seed'

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_tenant
  ON supplier_catalog (tenant_id);

-- ============================================================
-- 4. project_notes - notas internas del tenant
-- ============================================================
ALTER TABLE project_notes
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

UPDATE project_notes pn
   SET tenant_id = p.tenant_id
  FROM projects p
 WHERE pn.project_id = p.id
   AND pn.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_notes_tenant
  ON project_notes (tenant_id);

-- ============================================================
-- 5. contract_templates - algunas globales (NULL), otras por tenant
-- ============================================================
ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

-- los seeds globales se quedan con tenant_id NULL (visibles para todos);
-- los creados por usuarios se asignan al tenant baseline.
-- (Aplicar manualmente segun politica de la organizacion.)

CREATE INDEX IF NOT EXISTS idx_contract_templates_tenant
  ON contract_templates (tenant_id);

-- ============================================================
-- 6. certificates - generados pertenecen a tenant via project
-- ============================================================
ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

UPDATE certificates c
   SET tenant_id = p.tenant_id
  FROM projects p
 WHERE c.project_id = p.id
   AND c.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_tenant
  ON certificates (tenant_id);

-- ============================================================
-- 7. contracts - tienen project_id, heredan via JOIN o columna directa
-- ============================================================
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

UPDATE contracts c
   SET tenant_id = p.tenant_id
  FROM projects p
 WHERE c.project_id = p.id
   AND c.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_tenant
  ON contracts (tenant_id);

-- ============================================================
-- 8. invoices - heredan via project
-- ============================================================
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

UPDATE invoices i
   SET tenant_id = p.tenant_id
  FROM projects p
 WHERE i.project_id = p.id
   AND i.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant
  ON invoices (tenant_id);

-- ============================================================
-- VERIFICACIONES POST-MIGRATION (no se ejecutan, solo referencia)
-- ============================================================
-- SELECT count(*) FROM studio_profile WHERE tenant_id IS NULL;       -- 0 esperado
-- SELECT count(*) FROM onboarding_sessions WHERE tenant_id IS NULL;  -- 0 esperado
-- SELECT count(*) FROM supplier_catalog WHERE tenant_id IS NULL
--   AND source_type IN ('catalog', 'quote');                         -- 0 esperado
-- SELECT count(*) FROM contracts WHERE tenant_id IS NULL;            -- 0 esperado
-- SELECT count(*) FROM invoices WHERE tenant_id IS NULL;             -- 0 esperado

INSERT INTO applied_migrations (filename, applied_by, notes) VALUES (
  '049_multi_tenant_extend.sql',
  'X3-multi-tenant',
  'Extiende tenant_id a 8 tablas raiz adicionales (studio_profile, onboarding_sessions, supplier_catalog, project_notes, contract_templates, certificates, contracts, invoices). Backfill al tenant baseline damian-mtnz. Tablas pipeline heredaran via JOIN en migration 050.'
);

COMMIT;
