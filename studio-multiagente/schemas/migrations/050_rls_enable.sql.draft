-- Migration 050: habilitar RLS en tablas tenant-scoped
-- Fecha planificada: X3 (multi-tenant + RLS)
-- Estado: DRAFT - aplicar SOLO despues de 049 + tras smoke test exitoso.
--
-- Estrategia:
--   - Tablas raiz (con tenant_id directo): RLS USING (tenant_id = current_tenant_id())
--   - Tablas pipeline (con project_id): RLS USING (project_id IN (SELECT id FROM projects))
--   - Tablas hijas de hijas (ej: material_items via project_id): igual que pipeline
--   - Tablas globales (agent_prompts, normativa_*, system_*): SIN RLS, accesibles para todos
--
-- Cada workflow n8n DEBE setear al inicio:
--   SET LOCAL app.current_tenant = '<tenant_uuid>'
-- Sin eso, current_tenant_id() devuelve NULL y RLS rechaza todas las filas.
--
-- ROLLBACK: cada ENABLE va con su DISABLE comentado para emergencias.

BEGIN;

-- ============================================================
-- BLOQUE A: TABLAS RAIZ (tenant_id directo)
-- ============================================================

-- projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON projects;
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON clients;
CREATE POLICY tenant_isolation ON clients
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- collaborators
ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON collaborators;
CREATE POLICY tenant_isolation ON collaborators
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- studio_profile
ALTER TABLE studio_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON studio_profile;
CREATE POLICY tenant_isolation ON studio_profile
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- onboarding_sessions
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON onboarding_sessions;
CREATE POLICY tenant_isolation ON onboarding_sessions
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- supplier_catalog (permite ver seeds globales con tenant_id NULL)
ALTER TABLE supplier_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON supplier_catalog;
CREATE POLICY tenant_isolation ON supplier_catalog
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- project_notes
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON project_notes;
CREATE POLICY tenant_isolation ON project_notes
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- contract_templates (permite ver templates globales NULL)
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON contract_templates;
CREATE POLICY tenant_isolation ON contract_templates
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- certificates
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON certificates;
CREATE POLICY tenant_isolation ON certificates
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- contracts
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON contracts;
CREATE POLICY tenant_isolation ON contracts
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON invoices;
CREATE POLICY tenant_isolation ON invoices
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================================
-- BLOQUE B: TABLAS PIPELINE (heredan via project_id)
-- ============================================================
-- Patron repetido: USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
-- Postgres optimiza esto con el index en projects.tenant_id (creado en 030).

-- briefings
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON briefings;
CREATE POLICY tenant_isolation ON briefings
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- design_options
ALTER TABLE design_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON design_options;
CREATE POLICY tenant_isolation ON design_options
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- regulatory_tasks
ALTER TABLE regulatory_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON regulatory_tasks;
CREATE POLICY tenant_isolation ON regulatory_tasks
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- material_items
ALTER TABLE material_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON material_items;
CREATE POLICY tenant_isolation ON material_items
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON documents;
CREATE POLICY tenant_isolation ON documents
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- cost_estimates
ALTER TABLE cost_estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON cost_estimates;
CREATE POLICY tenant_isolation ON cost_estimates
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- proposals
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON proposals;
CREATE POLICY tenant_isolation ON proposals
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- project_plans
ALTER TABLE project_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON project_plans;
CREATE POLICY tenant_isolation ON project_plans
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- memory_cases
ALTER TABLE memory_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON memory_cases;
CREATE POLICY tenant_isolation ON memory_cases
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- safety_plans
ALTER TABLE safety_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON safety_plans;
CREATE POLICY tenant_isolation ON safety_plans
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- accessibility_audits
ALTER TABLE accessibility_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON accessibility_audits;
CREATE POLICY tenant_isolation ON accessibility_audits
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- trade_assignments
ALTER TABLE trade_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON trade_assignments;
CREATE POLICY tenant_isolation ON trade_assignments
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- trade_quotes
ALTER TABLE trade_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON trade_quotes;
CREATE POLICY tenant_isolation ON trade_quotes
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- agent_executions
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agent_executions;
CREATE POLICY tenant_isolation ON agent_executions
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- approvals
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON approvals;
CREATE POLICY tenant_isolation ON approvals
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- activity_log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON activity_log;
CREATE POLICY tenant_isolation ON activity_log
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- project_intelligence
ALTER TABLE project_intelligence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON project_intelligence;
CREATE POLICY tenant_isolation ON project_intelligence
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- pathology_findings
ALTER TABLE pathology_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON pathology_findings;
CREATE POLICY tenant_isolation ON pathology_findings
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- qc_checks
ALTER TABLE qc_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON qc_checks;
CREATE POLICY tenant_isolation ON qc_checks
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- permit_applications
ALTER TABLE permit_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON permit_applications;
CREATE POLICY tenant_isolation ON permit_applications
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- energy_assessments
ALTER TABLE energy_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON energy_assessments;
CREATE POLICY tenant_isolation ON energy_assessments
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- aftercare_incidents
ALTER TABLE aftercare_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON aftercare_incidents;
CREATE POLICY tenant_isolation ON aftercare_incidents
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- site_reports
ALTER TABLE site_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON site_reports;
CREATE POLICY tenant_isolation ON site_reports
  USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id()));

-- gdpr_requests (puede tener client_id; chequear via project_id si existe)
-- consent_records (idem)
-- client_access_tokens (idem)
-- estos requieren analisis previo de su schema antes de RLS - ver doc x3

-- ============================================================
-- BLOQUE C: HELPER FUNCTIONS PARA WORKFLOWS N8N
-- ============================================================

-- Setea contexto tenant + lo devuelve. Llamar al inicio de cada workflow.
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id uuid)
RETURNS uuid LANGUAGE plpgsql AS $body$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id no puede ser NULL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND active = true) THEN
    RAISE EXCEPTION 'tenant_id % no existe o esta inactivo', p_tenant_id;
  END IF;
  PERFORM set_config('app.current_tenant', p_tenant_id::text, true);
  RETURN p_tenant_id;
END;
$body$;

-- Helper para resolver tenant_id desde un project_id (uso interno)
CREATE OR REPLACE FUNCTION resolve_tenant_from_project(p_project_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $body$
  SELECT tenant_id FROM projects WHERE id = p_project_id;
$body$;

-- Helper bypass para super_admin (Damian cross-tenant)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql STABLE AS $body$
  SELECT current_setting('app.role', true) = 'super_admin';
$body$;

-- ============================================================
-- INSERT en applied_migrations
-- ============================================================
INSERT INTO applied_migrations (filename, applied_by, notes) VALUES (
  '050_rls_enable.sql',
  'X3-multi-tenant',
  'Habilita RLS en 30+ tablas tenant-scoped. Politicas USING (tenant_id = current_tenant_id()) o subquery via project_id. Workflows DEBEN setear app.current_tenant al inicio. Cross-tenant bypass para super_admin via app.role.'
);

COMMIT;

-- ============================================================
-- ROLLBACK (en caso de emergencia, NO se ejecuta por defecto)
-- ============================================================
-- Para deshabilitar TODAS las RLS de golpe:
--   DO $$
--   DECLARE r record;
--   BEGIN
--     FOR r IN SELECT tablename FROM pg_tables
--              WHERE schemaname='public' AND rowsecurity=true LOOP
--       EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.tablename);
--     END LOOP;
--   END $$;
