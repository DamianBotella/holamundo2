-- 082: ArquitAI Fase G - Stripe billing + 3 tiers + trial 14 dias
-- Crea:
--   - subscription_plans: catalogo de 3 tiers (starter, pro, equipo)
--   - tenant_subscriptions: estado por tenant (status, trial, periodo)
--   - stripe_events_log: idempotencia de webhooks (Stripe puede reenviar)
--   - tenant_usage: contadores acumulados por mes (projects, ai_tokens, etc)
--   - check_tenant_quota(tenant_id, resource): helper SQL para middleware
--   - Seeds: 3 planes + 14 dias trial activo para damian-mtnz
--   - system_config: stripe_secret_key, stripe_webhook_secret, stripe_publishable_key (placeholders)

BEGIN;

-- 1. Catalog de planes
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_slug             text NOT NULL UNIQUE CHECK (tier_slug IN ('starter','pro','equipo')),
  name                  text NOT NULL,
  description           text,
  price_eur_monthly     numeric(7,2) NOT NULL,
  stripe_price_id       text,
  stripe_product_id     text,
  features              jsonb NOT NULL DEFAULT '[]'::jsonb,
  limits                jsonb NOT NULL DEFAULT '{}'::jsonb,
  trial_days            int NOT NULL DEFAULT 14,
  sort_order            int NOT NULL DEFAULT 0,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_active ON subscription_plans(is_active, sort_order);

-- 2. Subscription state por tenant
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id                  uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status                   text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing','active','past_due','canceled','incomplete','incomplete_expired','paused','unpaid')),
  stripe_customer_id       text UNIQUE,
  stripe_subscription_id   text UNIQUE,
  trial_started_at         timestamptz,
  trial_ends_at            timestamptz,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  canceled_at              timestamptz,
  ended_at                 timestamptz,
  last_payment_at          timestamptz,
  next_payment_amount_eur  numeric(10,2),
  payment_method_last4     text,
  metadata                 jsonb DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subs_status            ON tenant_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subs_trial_ends        ON tenant_subscriptions(trial_ends_at) WHERE status = 'trialing';
CREATE INDEX IF NOT EXISTS idx_subs_period_end        ON tenant_subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subs_stripe_customer   ON tenant_subscriptions(stripe_customer_id);

ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subs_tenant ON tenant_subscriptions;
CREATE POLICY subs_tenant ON tenant_subscriptions
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- 3. Log de eventos Stripe para idempotencia (Stripe reenvia tras fallo)
CREATE TABLE IF NOT EXISTS stripe_events_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          text NOT NULL UNIQUE,
  event_type        text NOT NULL,
  livemode          boolean NOT NULL DEFAULT false,
  processed_at      timestamptz NOT NULL DEFAULT now(),
  status            text NOT NULL DEFAULT 'processed'
    CHECK (status IN ('processed','failed','skipped','duplicate')),
  error_message     text,
  raw_event         jsonb,
  affected_tenant   uuid REFERENCES tenants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events_log(event_type, processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_events_tenant ON stripe_events_log(affected_tenant, processed_at DESC);

-- 4. Tenant usage (contadores por mes para enforcement de limites)
CREATE TABLE IF NOT EXISTS tenant_usage (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_month             date NOT NULL,
  projects_created         int NOT NULL DEFAULT 0,
  projects_active          int NOT NULL DEFAULT 0,
  ai_tokens_used           bigint NOT NULL DEFAULT 0,
  agent_executions_count   int NOT NULL DEFAULT 0,
  users_active             int NOT NULL DEFAULT 1,
  last_recalculated_at     timestamptz NOT NULL DEFAULT now(),
  metadata                 jsonb DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_usage_tenant_period ON tenant_usage(tenant_id, period_month DESC);

ALTER TABLE tenant_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usage_tenant ON tenant_usage;
CREATE POLICY usage_tenant ON tenant_usage
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- 5. Helper: estado del tenant (plan, limits, usage, allowed)
CREATE OR REPLACE FUNCTION get_tenant_billing_state(p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_sub        tenant_subscriptions%ROWTYPE;
  v_plan       subscription_plans%ROWTYPE;
  v_usage      tenant_usage%ROWTYPE;
  v_proj_count int;
  v_state      jsonb;
BEGIN
  SELECT * INTO v_sub FROM tenant_subscriptions WHERE tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_subscription', false,
      'tier', NULL,
      'status', 'no_subscription',
      'limits', '{}'::jsonb,
      'usage', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_plan FROM subscription_plans WHERE id = v_sub.plan_id;

  SELECT * INTO v_usage FROM tenant_usage
    WHERE tenant_id = p_tenant_id
      AND period_month = date_trunc('month', now())::date;

  -- Recalcula projects activos (live count, no cached)
  SELECT count(*) INTO v_proj_count FROM projects WHERE tenant_id = p_tenant_id;

  v_state := jsonb_build_object(
    'has_subscription', true,
    'tier', v_plan.tier_slug,
    'plan_name', v_plan.name,
    'price_eur_monthly', v_plan.price_eur_monthly,
    'status', v_sub.status,
    'is_trialing', (v_sub.status = 'trialing'),
    'trial_ends_at', v_sub.trial_ends_at,
    'trial_days_left', CASE WHEN v_sub.trial_ends_at IS NOT NULL THEN GREATEST(0, EXTRACT(DAY FROM v_sub.trial_ends_at - now())::int) ELSE NULL END,
    'current_period_end', v_sub.current_period_end,
    'cancel_at_period_end', v_sub.cancel_at_period_end,
    'limits', v_plan.limits,
    'usage', jsonb_build_object(
      'projects_active', v_proj_count,
      'projects_created_this_month', COALESCE(v_usage.projects_created, 0),
      'ai_tokens_used_this_month', COALESCE(v_usage.ai_tokens_used, 0),
      'agent_executions_this_month', COALESCE(v_usage.agent_executions_count, 0)
    ),
    'features', v_plan.features
  );
  RETURN v_state;
END;
$$;

-- 6. Helper: check si tenant puede crear/consumir recurso
CREATE OR REPLACE FUNCTION check_tenant_quota(p_tenant_id uuid, p_resource text)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_state    jsonb;
  v_limit    int;
  v_used     int;
  v_unlimited boolean;
BEGIN
  v_state := get_tenant_billing_state(p_tenant_id);

  IF (v_state->>'has_subscription')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_subscription', 'state', v_state);
  END IF;

  IF v_state->>'status' NOT IN ('trialing','active') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_inactive', 'status', v_state->>'status', 'state', v_state);
  END IF;

  -- Resource lookup
  v_limit := (v_state->'limits'->>('max_'||p_resource))::int;
  v_unlimited := (v_state->'limits'->>('max_'||p_resource)) = '-1';

  IF v_limit IS NULL THEN
    -- Resource no esta limitado en este plan
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_limit_defined', 'resource', p_resource);
  END IF;

  IF v_unlimited THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited', 'resource', p_resource);
  END IF;

  -- Usage actual
  CASE p_resource
    WHEN 'projects' THEN v_used := (v_state->'usage'->>'projects_active')::int;
    WHEN 'ai_tokens' THEN v_used := (v_state->'usage'->>'ai_tokens_used_this_month')::int;
    WHEN 'agent_executions' THEN v_used := (v_state->'usage'->>'agent_executions_this_month')::int;
    ELSE v_used := 0;
  END CASE;

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'resource', p_resource, 'limit', v_limit, 'used', v_used, 'tier', v_state->>'tier');
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', 'within_quota', 'resource', p_resource, 'limit', v_limit, 'used', v_used, 'remaining', v_limit - v_used);
END;
$$;

-- 7. Seed: 3 planes
INSERT INTO subscription_plans (tier_slug, name, description, price_eur_monthly, stripe_price_id, features, limits, trial_days, sort_order) VALUES
('starter','Starter','Para arquitecto individual que arranca con ArquitAI. Hasta 5 proyectos simultaneos y 8 agentes esenciales.',
 49.00,
 'price_REPLACE_WITH_REAL_STARTER',
 '["agentes_core_basicos","precheck_normativa_top5","propuesta_basica","moodboard_ia","cliente_translator"]'::jsonb,
 '{"max_projects": 5, "max_users": 1, "max_ai_tokens": 50000, "max_agents": 8, "max_agent_executions": 200, "render_mnml_per_month": 5, "support": "email"}'::jsonb,
 14, 1),

('pro','Pro','Para arquitecto consolidado o estudio pequeno. Hasta 25 proyectos y todos los agentes (CORE + AUX). 250k tokens IA al mes.',
 149.00,
 'price_REPLACE_WITH_REAL_PRO',
 '["todos_agentes","precheck_normativa_top5","propuesta_visual_completa","render_mnml_unlimited","cliente_translator","decision_engine","memoria_proyectos","integracion_drive_gmail"]'::jsonb,
 '{"max_projects": 25, "max_users": 5, "max_ai_tokens": 250000, "max_agents": 30, "max_agent_executions": 2000, "render_mnml_per_month": -1, "support": "email_priority"}'::jsonb,
 14, 2),

('equipo','Equipo','Para estudios medianos y grandes. Proyectos ilimitados, 15 usuarios, 1M tokens IA al mes, soporte prioritario telefonico.',
 299.00,
 'price_REPLACE_WITH_REAL_EQUIPO',
 '["todos_agentes","precheck_normativa_top5_plus","propuesta_visual_premium","render_mnml_unlimited","cliente_translator","decision_engine","memoria_proyectos","integracion_drive_gmail","multi_arquitecto","onboarding_dedicado","sso_saml","webhook_alertas_custom"]'::jsonb,
 '{"max_projects": -1, "max_users": 15, "max_ai_tokens": 1000000, "max_agents": -1, "max_agent_executions": -1, "render_mnml_per_month": -1, "support": "phone_priority"}'::jsonb,
 14, 3)

ON CONFLICT (tier_slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_eur_monthly = EXCLUDED.price_eur_monthly,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 8. Seed: arrancar damian-mtnz en trial de Pro (14 dias)
INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, trial_started_at, trial_ends_at)
SELECT t.id, p.id, 'trialing', now(), now() + interval '14 days'
FROM tenants t
CROSS JOIN subscription_plans p
WHERE t.slug = 'damian-mtnz' AND p.tier_slug = 'pro'
ON CONFLICT (tenant_id) DO NOTHING;

-- 9. Seed: tenant_usage actual para mes en curso
INSERT INTO tenant_usage (tenant_id, period_month, projects_active)
SELECT t.id, date_trunc('month', now())::date, (SELECT count(*) FROM projects WHERE tenant_id = t.id)
FROM tenants t
WHERE t.slug = 'damian-mtnz'
ON CONFLICT (tenant_id, period_month) DO NOTHING;

-- 10. Stripe credentials en system_config (placeholders - actualizar con keys reales)
INSERT INTO system_config (key, value, description) VALUES
  ('stripe_secret_key',     'sk_test_REPLACE_WITH_REAL', 'Stripe Secret Key (modo test sk_test_... o live sk_live_...). Lo lee api_billing_* y webhook_stripe.'),
  ('stripe_publishable_key','pk_test_REPLACE_WITH_REAL', 'Stripe Publishable Key para frontend (Customer Portal embed).'),
  ('stripe_webhook_secret', 'whsec_REPLACE_WITH_REAL', 'Stripe Webhook Signing Secret (whsec_...). Lo usa webhook_stripe para verificar firma HMAC SHA256.'),
  ('billing_success_url',   'https://arquitai.studio/billing/success', 'URL de retorno tras Stripe Checkout exitoso. Recibe ?session_id={CHECKOUT_SESSION_ID}.'),
  ('billing_cancel_url',    'https://arquitai.studio/billing/cancel',  'URL de retorno si cancela Stripe Checkout.'),
  ('billing_portal_return_url', 'https://arquitai.studio/settings',    'URL de retorno desde Stripe Customer Portal.')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO applied_migrations (filename, notes) VALUES
  ('082_stripe_billing.sql', 'G plan Opus: Stripe billing (3 tiers 49/149/299 EUR), trial 14 dias, helpers SQL get_tenant_billing_state + check_tenant_quota, RLS por tenant')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback:
-- BEGIN;
-- DROP FUNCTION IF EXISTS check_tenant_quota(uuid, text);
-- DROP FUNCTION IF EXISTS get_tenant_billing_state(uuid);
-- DROP TABLE IF EXISTS tenant_usage;
-- DROP TABLE IF EXISTS stripe_events_log;
-- DROP TABLE IF EXISTS tenant_subscriptions;
-- DROP TABLE IF EXISTS subscription_plans;
-- DELETE FROM system_config WHERE key IN ('stripe_secret_key','stripe_publishable_key','stripe_webhook_secret','billing_success_url','billing_cancel_url','billing_portal_return_url');
-- DELETE FROM applied_migrations WHERE filename = '082_stripe_billing.sql';
-- COMMIT;
