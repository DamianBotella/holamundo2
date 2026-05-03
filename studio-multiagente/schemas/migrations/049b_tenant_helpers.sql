-- Migration 049b: helpers RLS multi-tenant (sin habilitar RLS)
-- Fecha: 2026-05-03 (X3 paso 2.5)
--
-- Por que separar de 050: necesitamos las funciones DISPONIBLES para que
-- los workflows n8n puedan empezar a llamar set_tenant_context() ANTES de
-- habilitar RLS. Si aplicamos 050 directo (RLS + helpers juntos) y los
-- workflows aun no llaman set_tenant_context, todas sus queries devuelven
-- 0 filas (RLS rechaza). Esto rompe produccion.
--
-- Estrategia segura:
--   1. 049 (ya aplicada) - tenant_id en tablas raiz
--   2. 049b (esta) - helpers DISPONIBLES, RLS sigue desactivada
--   3. Auditar/parchar workflows para usar set_tenant_context()
--   4. 050 - ENABLE ROW LEVEL SECURITY + CREATE POLICY (cuando todos los
--      workflows ya setean tenant context)
--
-- Las 3 funciones se duplican en 050 con CREATE OR REPLACE, asi que aplicar
-- 050 despues no causa conflicto.

BEGIN;

-- ============================================================
-- 1. set_tenant_context - llamar al inicio de cada workflow
-- ============================================================
-- Setea app.current_tenant en la sesion. Valida que el tenant exista
-- y este activo. Devuelve el tenant_id para usar en pipeline.
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id uuid)
RETURNS uuid LANGUAGE plpgsql AS $body$
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id no puede ser NULL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND active = true) THEN
    RAISE EXCEPTION 'tenant_id % no existe o esta inactivo', p_tenant_id;
  END IF;
  -- is_local=false (session-scoped). Tras test empirico en n8n:
  -- el setting persiste entre nodos Postgres distintos del mismo workflow
  -- porque n8n reutiliza la connection del pool. Con true (tx-local) NO
  -- persistiria al siguiente nodo (cada nodo Postgres en n8n abre su propia
  -- transaccion). Con false el setting dura toda la session.
  PERFORM set_config('app.current_tenant', p_tenant_id::text, false);
  RETURN p_tenant_id;
END;
$body$;

-- ============================================================
-- 2. resolve_tenant_from_project - resolver tenant desde project_id
-- ============================================================
-- Util para workflows que reciben project_id pero no tenant_id.
-- SECURITY DEFINER: bypass RLS para que funcione antes de que
-- el workflow setee el tenant context.
CREATE OR REPLACE FUNCTION resolve_tenant_from_project(p_project_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $body$
  SELECT tenant_id FROM projects WHERE id = p_project_id;
$body$;

-- ============================================================
-- 3. is_super_admin - bypass para Damian cross-tenant
-- ============================================================
-- Lee app.role de la sesion. Si es 'super_admin' devuelve true.
-- Las politicas en 050 NO incluyen este bypass por defecto -
-- es opcional para herramientas administrativas.
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql STABLE AS $body$
  SELECT COALESCE(current_setting('app.role', true) = 'super_admin', false);
$body$;

-- ============================================================
-- INSERT en applied_migrations
-- ============================================================
INSERT INTO applied_migrations (filename, applied_by, notes) VALUES (
  '049b_tenant_helpers.sql',
  'X3-multi-tenant',
  'Helpers set_tenant_context, resolve_tenant_from_project, is_super_admin disponibles SIN habilitar RLS. Permite parchar workflows con set_tenant_context() antes de aplicar 050.'
);

COMMIT;

-- ============================================================
-- VERIFICACIONES (esperado: las 3 funciones existen)
-- ============================================================
-- SELECT proname FROM pg_proc WHERE proname IN
--   ('set_tenant_context', 'resolve_tenant_from_project', 'is_super_admin');
-- esperado: 3 filas

-- Test rapido:
-- SELECT set_tenant_context((SELECT id FROM tenants WHERE slug='damian-mtnz'));
-- SELECT current_tenant_id();   -- esperado: el uuid del tenant baseline
