-- Migration 050b: super_admin bypass en RLS policies
-- Fecha: 2026-05-03 (X3 paso 4)
--
-- Por que: tras aplicar 050, los 47 crones que tocan tablas tenant-scoped
-- (activity_log, projects, agent_executions, etc) fallan porque no tienen
-- set_tenant_context activo y RLS rechaza sus queries.
--
-- Solucion: anadir OR is_super_admin() a cada policy. Crones setean
-- app.role = 'super_admin' al inicio y operan cross-tenant (necesario para
-- reports globales, monitoreo, cleanup, etc).
--
-- En multi-tenant V2 cada cron se refactorizara para iterar tenants
-- (Patron C del doc x3_multi_tenant_design.md). Por ahora bypass.

BEGIN;

-- BLOQUE A: TABLAS RAIZ (tenant_id directo)
DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'projects','clients','collaborators','studio_profile','onboarding_sessions',
    'project_notes','certificates','contracts','invoices'
  ]) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl) THEN
      RAISE NOTICE 'Skip %: no existe', tbl;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_tenant_id() OR is_super_admin()) WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin())', tbl);
  END LOOP;
END $$;

-- supplier_catalog y contract_templates: NULL = global, mantenemos
DROP POLICY IF EXISTS tenant_isolation ON supplier_catalog;
CREATE POLICY tenant_isolation ON supplier_catalog
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS tenant_isolation ON contract_templates;
CREATE POLICY tenant_isolation ON contract_templates
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- BLOQUE B: TABLAS PIPELINE (heredan via project_id)
DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'briefings','design_options','regulatory_tasks','material_items','documents',
    'cost_estimates','proposals','project_plans','memory_cases','safety_plans',
    'accessibility_audits','trade_assignments','trade_quotes','agent_executions',
    'approvals','activity_log','project_intelligence','pathology_findings',
    'qc_checks','permit_applications','energy_assessments','aftercare_incidents','site_reports'
  ]) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl) THEN
      RAISE NOTICE 'Skip %: no existe', tbl;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id() OR is_super_admin()) OR is_super_admin()) WITH CHECK (project_id IN (SELECT id FROM projects WHERE tenant_id = current_tenant_id() OR is_super_admin()) OR is_super_admin())', tbl);
  END LOOP;
END $$;

INSERT INTO applied_migrations (filename, applied_by, notes) VALUES (
  '050b_super_admin_bypass.sql',
  'X3-multi-tenant',
  'Anade OR is_super_admin() bypass a las policies de 050. Permite a crones operar cross-tenant seteando app.role=super_admin al inicio. En V2 multi-tenant los crones iteraran tenants en lugar de bypass.'
);

COMMIT;

-- Verificacion: cuantas policies con is_super_admin
SELECT count(*) AS policies_con_bypass FROM pg_policies
WHERE schemaname='public' AND qual LIKE '%is_super_admin%';

SELECT filename, applied_at FROM applied_migrations WHERE filename = '050b_super_admin_bypass.sql';
