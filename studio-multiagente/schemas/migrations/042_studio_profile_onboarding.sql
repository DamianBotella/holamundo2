-- Migration 042: studio_profile + onboarding_sessions
-- Fecha: 2026-04-27
--
-- Convierte ArquitAI de "demo personalizada para Damian" a "software vendible
-- a cualquier estudio". Cada profesional que use el software completa un
-- onboarding conversacional con agent_onboarding (LLM) y el resultado se
-- estructura en studio_profile.
--
-- Los 11 agentes nucleo del pipeline (briefing/design/regulatory/materials/
-- costs/trades/proposal/planner/memory/safety_plan/accessibility) leeran este
-- perfil dinamicamente al construir sus prompts, en lugar de tener tono
-- hardcoded.
--
-- Multi-tenant ready: studio_id desde el principio. Hoy mono-tenant (una
-- sola fila), cuando llegue el segundo cliente se activa RLS sin refactor
-- de schema.
--
-- Ver docs:
--   - studio-multiagente/docs/idea_onboarding_conversacional.md (arquitectura)
--   - studio-multiagente/docs/perfil_predeterminado_arquitecto.md (baseline)

-- ============================================================
-- TABLA 1: studio_profile
-- ============================================================
CREATE TABLE IF NOT EXISTS studio_profile (
  studio_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sec 1: Identidad
  identity           jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- ej: {"nombre_estudio":"...", "persona_principal":"...", "ciudad":"...",
  --      "ambito":["reformas","obra_nueva"], "tamano":"1-3", "anos_exp":10,
  --      "colegiado_no":"..."}

  -- Sec 2: Tono comunicacion
  tone               jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- ej: {"clientes":{"formalidad":"cercano","tutea":true,"tecnicidad":"llano",
  --      "longitud":"conciso","ejemplo_mal":"...", "ejemplo_bien":"..."},
  --      "gremios":{"formalidad":"directo","longitud":"breve"},
  --      "promotores":{"formalidad":"formal","longitud":"detallado"}}

  -- Sec 3: Prioridades absolutas (orden estricto)
  priorities         jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- ej: [{"orden":1,"prioridad":"seguridad estructural","detalle":"..."}, ...]

  -- Sec 4: Lineas rojas (cosas que NUNCA hago)
  red_lines          jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- ej: [{"id":"no_cfo_sin_acta","texto":"Nunca firmo CFO sin acta..."}, ...]

  -- Sec 5: Visita inicial - checklist
  visit_checklist    jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- ej: [{"pregunta":"¿Hay vecinos sensibles al ruido?","contexto":"comunidad"}, ...]

  -- Sec 6: Materiales/proveedores preferidos
  materials_pref     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- ej: {"gama_default":"media","prefiere_local":true,
  --      "marcas_preferidas_por_categoria":{"sanitarios":["Roca","Geberit"],...}}

  -- Sec 7: Gremios y colaboradores
  trades_pref        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- ej: {"criterios_seleccion":["referencias","seguro_RC","desglosado",...],
  --      "trade_to_contact":{"electricidad":"Pepe Ruiz","fontaneria":"...","..."},
  --      "blacklist":["nombre1","nombre2"]}

  -- Sec 8: Jurisdiccion
  jurisdiction       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- ej: {"ccaa":"Madrid","ayuntamientos_habituales":["Madrid","Pozuelo",...],
  --      "normativa_autonomica_aplicable":["..."],
  --      "normativa_estatal_siempre":["CTE","LOE","RD 1627/1997","REBT","RITE"]}

  -- Metadata
  setup_completed_at timestamptz,
  setup_source       text DEFAULT 'manual'
                     CHECK (setup_source IN ('manual','onboarding_chat','admin_edit','baseline')),
  active             boolean NOT NULL DEFAULT true,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_profile_active ON studio_profile (active) WHERE active = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION touch_studio_profile()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS studio_profile_touch ON studio_profile;
CREATE TRIGGER studio_profile_touch BEFORE UPDATE ON studio_profile
  FOR EACH ROW EXECUTE FUNCTION touch_studio_profile();


-- ============================================================
-- TABLA 2: onboarding_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vinculacion a studio_profile (NULL durante la sesion, se rellena al
  -- completarse con el extractor que crea/actualiza la fila en studio_profile)
  studio_id           uuid REFERENCES studio_profile(studio_id) ON DELETE SET NULL,

  -- Identificador opcional para retomar sesion sin login (token simple)
  resume_token        text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),

  -- Estado de la conversacion
  status              text NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress','completed','abandoned')),

  -- Mensajes acumulados: [{role:'user'|'assistant', content:'...', ts:...}, ...]
  messages            jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Tracking de cobertura por seccion (1-8)
  -- ej: {"identity":true, "tone":true, "priorities":false, ...}
  sections_covered    jsonb NOT NULL DEFAULT
    '{"identity":false,"tone":false,"priorities":false,"red_lines":false,"visit_checklist":false,"materials_pref":false,"trades_pref":false,"jurisdiction":false}'::jsonb,

  -- Metadata
  started_at          timestamptz NOT NULL DEFAULT now(),
  last_message_at     timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  abandoned_reason    text,
  llm_total_cost_usd  numeric(10,5) DEFAULT 0,
  llm_total_tokens    integer DEFAULT 0,
  llm_message_count   integer DEFAULT 0,

  -- Email del profesional que esta en la conversacion (para retomar)
  contact_email       text,
  contact_name        text
);

CREATE INDEX IF NOT EXISTS idx_onboarding_token   ON onboarding_sessions (resume_token);
CREATE INDEX IF NOT EXISTS idx_onboarding_status  ON onboarding_sessions (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_studio  ON onboarding_sessions (studio_id) WHERE studio_id IS NOT NULL;

-- Trigger touch last_message_at automaticamente cuando crece messages
CREATE OR REPLACE FUNCTION touch_onboarding_session()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  NEW.last_message_at := now();
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS onboarding_sessions_touch ON onboarding_sessions;
CREATE TRIGGER onboarding_sessions_touch BEFORE UPDATE ON onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION touch_onboarding_session();


-- ============================================================
-- HELPER: get_active_studio_profile() — para que los 11 agentes lo usen
-- ============================================================
-- En mono-tenant retorna la unica fila activa. Cuando se haga multi-tenant V2
-- esta funcion se reescribe para filtrar por current_tenant_id() (RLS).
CREATE OR REPLACE FUNCTION get_active_studio_profile()
RETURNS TABLE(
  studio_id uuid, identity jsonb, tone jsonb, priorities jsonb, red_lines jsonb,
  visit_checklist jsonb, materials_pref jsonb, trades_pref jsonb, jurisdiction jsonb
) LANGUAGE sql STABLE AS $body$
  SELECT studio_id, identity, tone, priorities, red_lines, visit_checklist,
         materials_pref, trades_pref, jurisdiction
  FROM studio_profile
  WHERE active = true
  ORDER BY setup_completed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;
$body$;


-- ============================================================
-- SEED: studio_profile con perfil predeterminado
-- ============================================================
-- Una sola fila inicial con setup_source='baseline' que activa el sistema con
-- valores razonables hasta que un profesional real complete el onboarding.
-- El primer onboarding completado creara una nueva fila active=true que
-- desplazara este baseline.
INSERT INTO studio_profile (
  studio_id, identity, tone, priorities, red_lines, visit_checklist,
  materials_pref, trades_pref, jurisdiction, setup_source, setup_completed_at,
  notes
) VALUES (
  gen_random_uuid(),
  '{"nombre_estudio":"Estudio de Arquitectura Tecnica (baseline)","persona_principal":"Arquitecto Tecnico Colegiado","ciudad":"Madrid","ambito":["reformas integrales de vivienda","redistribuciones interiores","rehabilitacion residencial","apoyo tecnico DF"],"tamano":"1-3 personas","anos_exp":10,"colegiado_no":""}'::jsonb,
  '{"clientes":{"formalidad":"cercano","tutea":true,"tecnicidad":"llano","longitud":"conciso","explica_terminos":true},"gremios":{"formalidad":"directo","longitud":"breve","tecnicidad":"alta"},"promotores":{"formalidad":"formal","longitud":"detallado","tecnicidad":"alta"}}'::jsonb,
  '[{"orden":1,"prioridad":"seguridad estructural y de las personas","detalle":"Si hay duda, paro la obra hasta resolver."},{"orden":2,"prioridad":"cumplimiento normativo","detalle":"CTE, LOE, ordenanzas locales. No se firma nada que no cumpla."},{"orden":3,"prioridad":"trazabilidad documental","detalle":"Acta replanteo, acta recepcion provisional, CFO. Sin estos hitos no hay obra."},{"orden":4,"prioridad":"honestidad presupuestaria","detalle":"Prefiero ofrecer rango y cumplir que prometer cifra cerrada y modificar."},{"orden":5,"prioridad":"gestion del tiempo del cliente","detalle":"Decisiones agrupadas, no persecucion diaria."}]'::jsonb,
  '[{"id":"no_cfo_sin_acta","texto":"Nunca firmo CFO sin acta de recepcion provisional + visita final con cliente presente"},{"id":"no_plazos_sin_replanteo","texto":"Nunca prometo plazos sin acta de replanteo firmada + permisos en regla"},{"id":"no_presupuesto_sin_visita","texto":"Nunca doy presupuesto sin haber pisado el inmueble"},{"id":"no_soluciones_no_probadas","texto":"Nunca propongo soluciones tecnicas que no haya visto funcionar o sin respaldo de un especialista"},{"id":"no_encargos_sin_contrato","texto":"Nunca acepto encargos sin contrato de encargo profesional firmado"},{"id":"no_facturas_sin_verificar","texto":"Nunca paso factura de gremio sin verificar partida + medicion real"},{"id":"no_gremios_sin_referencia","texto":"Nunca recomiendo gremios sin haber trabajado antes con ellos o sin referencias"}]'::jsonb,
  '[{"pregunta":"¿Hay vecinos sensibles al ruido o horarios estrictos en la comunidad?","contexto":"comunidad"},{"pregunta":"¿Cual es el horario de obra permitido en este ayuntamiento + comunidad?","contexto":"normativa"},{"pregunta":"¿Tienes plano original, cedula de habitabilidad, boletin electrico anteriores?","contexto":"documentacion"},{"pregunta":"¿Ha habido reformas previas? ¿Quien las hizo? ¿Hay documentacion?","contexto":"historial"},{"pregunta":"¿El presupuesto es real con margen +20% o ya es techo absoluto?","contexto":"presupuesto"},{"pregunta":"¿Hay decisiones tomadas (marcas, materiales) o todo abierto?","contexto":"alcance"},{"pregunta":"¿Plazo objetivo de entrada? ¿Es flexible o fecha bloqueada?","contexto":"plazo"},{"pregunta":"¿Miembros de la familia con necesidades especiales (movilidad, alergias)?","contexto":"accesibilidad"},{"pregunta":"¿Patologias visibles que ya hayas detectado tu (humedad, grietas, instalaciones)?","contexto":"patologia"},{"pregunta":"¿Tienes seguro de hogar y/o de comunidad? ¿Quien es el administrador?","contexto":"seguros"}]'::jsonb,
  '{"gama_default":"media","prefiere_local":true,"comentario":"Catalogo via supplier_catalog tabla con 22 items genericos. Real arquitecto añadira con source_type=catalog."}'::jsonb,
  '{"criterios_seleccion":["He trabajado antes y han cumplido","Referencias verificables de colegas","Presupuesto desglosado, no precio cerrado opaco","Seguro RC profesional vigente y al dia con SS","Responden en menos de 48h"],"trade_to_contact":{},"comentario_blacklist":"vacia hasta que arquitecto real configure"}'::jsonb,
  '{"ccaa":"Madrid","ayuntamientos_habituales":["Madrid","Pozuelo de Alarcon","Las Rozas","Alcobendas"],"normativa_autonomica":["Ley 9/2001 Suelo Comunidad Madrid","Decreto 184/1998 RHU"],"normativa_estatal_siempre":["CTE","LOE (Ley 38/1999)","RD 1627/1997 SS obras","REBT (RD 842/2002)","RITE (RD 1027/2007)","RD 235/2013 Eficiencia energetica"]}'::jsonb,
  'baseline',
  now(),
  'Perfil predeterminado generado por el sistema. Sera reemplazado por el primer onboarding completado de un profesional real (active=false en este al insertar el nuevo). Ver docs/perfil_predeterminado_arquitecto.md.'
)
ON CONFLICT DO NOTHING;


-- ============================================================
-- Verificacion post-migracion
-- ============================================================
-- SELECT count(*) FROM studio_profile;                                    -- esperado: 1
-- SELECT identity->>'nombre_estudio', tone->'clientes'->>'formalidad'
-- FROM studio_profile WHERE setup_source='baseline';                       -- baseline + cercano
-- SELECT count(*) FROM information_schema.tables
-- WHERE table_name IN ('studio_profile','onboarding_sessions');           -- esperado: 2
-- SELECT * FROM get_active_studio_profile();                               -- devuelve la fila baseline
