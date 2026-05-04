-- Migration 051: user_profiles + linkear con Supabase Auth
-- Fecha planificada: X4 (auth real)
-- Estado: DRAFT - aplicar tras verificar que 049 + 050 funcionan en produccion.
--
-- Premisa: Supabase Auth ya provee tabla auth.users (UUID, email, encrypted_password, etc.)
-- Esta migration crea la capa de "perfil de aplicacion" que linka:
--   auth.users <-> tenants (a que estudio pertenece el usuario)
--   auth.users <-> rol (architect | colaborador | super_admin)
--
-- Y define el patron para que los workflows n8n autenticados resuelvan:
--   1. Token JWT del header
--   2. user_id desde JWT
--   3. tenant_id desde user_profiles
--   4. SET LOCAL app.current_tenant = tenant_id

BEGIN;

-- ============================================================
-- 1. user_profiles - linker auth.users <-> tenants
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id     uuid PRIMARY KEY,  -- FK a auth.users.id (NO usamos REFERENCES porque auth schema cross-schema)
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  role        text NOT NULL DEFAULT 'architect'
    CHECK (role IN ('architect', 'colaborador', 'super_admin')),
  full_name   text,
  email       text NOT NULL,  -- denormalizado para queries sin cross-schema join
  active      boolean NOT NULL DEFAULT true,
  last_login  timestamptz,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_user_profiles_updated
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant ON user_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles (role) WHERE role = 'super_admin';
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles (lower(email));

COMMENT ON TABLE user_profiles IS
  'Capa de perfil de aplicacion encima de auth.users (Supabase Auth). Cada user pertenece a un tenant y tiene un rol. Los super_admin (Damian) bypass RLS.';

-- ============================================================
-- 2. RLS en user_profiles - cada user ve su propio perfil + super_admin ve todos
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_self_or_admin ON user_profiles;
CREATE POLICY user_self_or_admin ON user_profiles
  USING (
    user_id = NULLIF(current_setting('app.current_user', true), '')::uuid
    OR is_super_admin()
    OR tenant_id = current_tenant_id()
  );

-- ============================================================
-- 3. Helper: resolver tenant + role desde user_id (para workflow auth)
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_session_from_user(p_user_id uuid)
RETURNS TABLE (tenant_id uuid, role text, full_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER AS $body$
  SELECT tenant_id, role, full_name, email
    FROM user_profiles
   WHERE user_id = p_user_id AND active = true
   LIMIT 1;
$body$;

-- ============================================================
-- 4. Helper: setear sesion completa (tenant + user + role)
-- ============================================================
CREATE OR REPLACE FUNCTION set_session_context(
  p_user_id uuid,
  p_tenant_id uuid,
  p_role text DEFAULT 'architect'
)
RETURNS void LANGUAGE plpgsql AS $body$
BEGIN
  PERFORM set_config('app.current_user', p_user_id::text, true);
  PERFORM set_config('app.current_tenant', p_tenant_id::text, true);
  PERFORM set_config('app.role', COALESCE(p_role, 'architect'), true);
END;
$body$;

-- ============================================================
-- 5. Vista para UI: perfil + tenant info en una sola query
-- ============================================================
CREATE OR REPLACE VIEW v_my_profile AS
SELECT
  up.user_id,
  up.email,
  up.full_name,
  up.role,
  up.active,
  up.last_login,
  t.id            AS tenant_id,
  t.name          AS tenant_name,
  t.slug          AS tenant_slug,
  t.plan          AS tenant_plan,
  t.active        AS tenant_active
FROM user_profiles up
JOIN tenants t ON t.id = up.tenant_id
WHERE up.user_id = NULLIF(current_setting('app.current_user', true), '')::uuid;

COMMENT ON VIEW v_my_profile IS
  'Vista que la UI consume en /me. Devuelve perfil + tenant del usuario logueado segun app.current_user de la sesion.';

-- ============================================================
-- 6. Seed: crear perfil para Damian (super_admin baseline)
-- ============================================================
-- IMPORTANTE: este INSERT requiere que ya exista un user en auth.users.
-- Si Damian aun no se registro en Supabase Auth, este INSERT falla pero
-- el resto de la migration continua. Aplicar el INSERT manual despues.

-- INSERT INTO user_profiles (user_id, tenant_id, role, full_name, email)
-- SELECT
--   (SELECT id FROM auth.users WHERE email = 'botelladesdeel98@gmail.com' LIMIT 1),
--   (SELECT id FROM tenants WHERE slug = 'damian-mtnz'),
--   'super_admin',
--   'Damian Martinez',
--   'botelladesdeel98@gmail.com'
-- WHERE EXISTS (SELECT 1 FROM auth.users WHERE email = 'botelladesdeel98@gmail.com')
-- ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 7. INSERT en applied_migrations
-- ============================================================
INSERT INTO applied_migrations (filename, applied_by, notes) VALUES (
  '051_user_profiles_auth.sql',
  'X4-auth',
  'Crea user_profiles linker entre auth.users y tenants. Roles: architect/colaborador/super_admin. Helpers set_session_context() y resolve_session_from_user(). Vista v_my_profile para endpoint GET /me. Seed manual de Damian super_admin pendiente tras registro en Supabase Auth.'
);

COMMIT;
