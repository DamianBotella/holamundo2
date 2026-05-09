-- =================================================================
-- APPLY PHASE A.2 — bundle de las 11 migraciones de tablas base
-- =================================================================
-- Plan Opus / Addendum: tablas necesarias para los agentes de Fase B.
-- Ejecutar este script en Supabase SQL Editor de un solo trago.
-- Idempotente: se puede re-ejecutar sin romper nada.
--
-- Migraciones incluidas:
--   061 materials_catalog
--   062 catalog_sync_log
--   063 grants_active
--   064 iee_reports + iee_reports_draft
--   065 municipal_templates
--   066 architect_directives
--   067 roi_metrics
--   068 decision_log
--   069 client_decisions
--   070 rcd_studies + rcd_studies_draft
--   071 agents_catalog.status + 4 agentes planned
--
-- Verificacion al final: cuenta tablas creadas, indices, policies RLS.
-- =================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =================================================================
-- 061 materials_catalog
-- =================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS materials_catalog (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku_fabricante         text,
  nombre                 text NOT NULL,
  marca                  text NOT NULL,
  categoria              text NOT NULL CHECK (categoria IN (
    'ceramica','sanitarios','griferia','carpinteria_interior',
    'carpinteria_exterior','aislamiento','impermeabilizacion',
    'pintura','pavimento','revestimiento','iluminacion',
    'electrodomesticos','climatizacion','fontaneria','electricidad','otros'
  )),
  precio_pvp_eur         numeric(10,2),
  unidad                 text CHECK (unidad IN ('m2','m3','ml','ud','kg','l')),
  fecha_precio           timestamptz,
  fuente_precio          text CHECK (fuente_precio IN ('BIMobject','ACAE','BEDEC','PDF','Newsletter','Manual')),
  url_fabricante         text,
  url_bimobject          text,
  epd_url                text,
  huella_co2_kg          numeric(10,3),
  descripcion            text,
  embedding_descripcion  vector(1536),
  raw_metadata           jsonb,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_materials_tenant    ON materials_catalog(tenant_id);
CREATE INDEX IF NOT EXISTS idx_materials_categoria ON materials_catalog(categoria);
CREATE INDEX IF NOT EXISTS idx_materials_marca     ON materials_catalog(marca);
CREATE INDEX IF NOT EXISTS idx_materials_embedding ON materials_catalog
  USING ivfflat (embedding_descripcion vector_cosine_ops) WITH (lists = 100);
ALTER TABLE materials_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS materials_tenant ON materials_catalog;
CREATE POLICY materials_tenant ON materials_catalog
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
INSERT INTO applied_migrations (filename, notes) VALUES
  ('061_materials_catalog.sql', 'A.2: catalogo materiales tenant + embedding ivfflat')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- =================================================================
-- 062 catalog_sync_log
-- =================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS catalog_sync_log (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuente                   text NOT NULL,
  fecha_sync               timestamptz DEFAULT now(),
  productos_actualizados   integer DEFAULT 0,
  productos_nuevos         integer DEFAULT 0,
  productos_eliminados     integer DEFAULT 0,
  errores                  jsonb,
  duracion_segundos        integer,
  status                   text DEFAULT 'pending'
    CHECK (status IN ('pending','running','success','error','partial'))
);
CREATE INDEX IF NOT EXISTS idx_sync_log_fecha  ON catalog_sync_log(fecha_sync DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON catalog_sync_log(status, fecha_sync DESC);
INSERT INTO applied_migrations (filename, notes) VALUES
  ('062_catalog_sync_log.sql', 'A.2: auditoria sync catalogos sin RLS')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- =================================================================
-- 063 grants_active
-- =================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS grants_active (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                  text NOT NULL,
  organismo               text NOT NULL,
  ambito                  text CHECK (ambito IN ('estatal','autonomico','local','europeo')),
  comunidad_autonoma      text,
  tipo                    text CHECK (tipo IN (
    'rehabilitacion','eficiencia_energetica','accesibilidad',
    'obra_nueva','digitalizacion','agricultura','otros'
  )),
  importe_maximo          numeric(12,2),
  porcentaje_maximo       numeric(5,2),
  fecha_apertura          date,
  fecha_cierre            date,
  url_convocatoria        text,
  requisitos              text,
  documentacion_requerida jsonb,
  compatible_con_otras    boolean DEFAULT true,
  normativa_confidence    numeric(3,2) CHECK (normativa_confidence BETWEEN 0 AND 1),
  citation_source         text,
  fetched_at              timestamptz DEFAULT now(),
  active                  boolean DEFAULT true,
  UNIQUE (nombre, organismo)
);
CREATE INDEX IF NOT EXISTS idx_grants_tipo
  ON grants_active(tipo) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_grants_cierre
  ON grants_active(fecha_cierre) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_grants_ambito
  ON grants_active(ambito, comunidad_autonoma) WHERE active = true;
INSERT INTO applied_migrations (filename, notes) VALUES
  ('063_grants_active.sql', 'A.2: subvenciones publicas compartidas, sin RLS')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- =================================================================
-- 064 iee_reports + iee_reports_draft
-- =================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS iee_reports_draft (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                 uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id                  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  estado_conservacion        text,
  condiciones_accesibilidad  text,
  eficiencia_energetica      text,
  calificacion_global        text CHECK (calificacion_global IN ('A','B','C','D','E','F','G')),
  recomendaciones            jsonb,
  draft_content              jsonb,
  status                     text DEFAULT 'draft'
    CHECK (status IN ('draft','approved','rejected','superseded')),
  approved_by                uuid REFERENCES auth.users(id),
  approved_at                timestamptz,
  created_at                 timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS iee_reports (LIKE iee_reports_draft INCLUDING ALL);
ALTER TABLE iee_reports DROP CONSTRAINT IF EXISTS iee_reports_status_check;
ALTER TABLE iee_reports ADD CONSTRAINT iee_reports_status_check CHECK (status = 'approved');
CREATE INDEX IF NOT EXISTS idx_iee_draft_project ON iee_reports_draft(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iee_project       ON iee_reports(project_id, created_at DESC);
ALTER TABLE iee_reports_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE iee_reports       ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS iee_draft_tenant ON iee_reports_draft;
CREATE POLICY iee_draft_tenant ON iee_reports_draft
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
DROP POLICY IF EXISTS iee_tenant ON iee_reports;
CREATE POLICY iee_tenant ON iee_reports
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
INSERT INTO applied_migrations (filename, notes) VALUES
  ('064_iee_reports.sql', 'A.2: IEE draft+final con patron Draft/Commit')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- =================================================================
-- 065 municipal_templates
-- =================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS municipal_templates (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio                text NOT NULL,
  provincia                text NOT NULL,
  tipo_tramite             text NOT NULL CHECK (tipo_tramite IN (
    'licencia_obra_menor','licencia_obra_mayor','comunicacion_previa',
    'declaracion_responsable','iee','cambio_uso','primera_ocupacion'
  )),
  documentos_requeridos    jsonb NOT NULL,
  formato_expediente       text CHECK (formato_expediente IN ('PDF','XML','ZIP','XBRL')),
  sede_electronica_url     text,
  tamano_maximo_mb         integer DEFAULT 50,
  formatos_admitidos       jsonb,
  requiere_firma_digital   boolean DEFAULT true,
  notas                    text,
  citation_source          text,
  fetched_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now(),
  UNIQUE (municipio, tipo_tramite)
);
CREATE INDEX IF NOT EXISTS idx_municipal_municipio ON municipal_templates(municipio);
CREATE INDEX IF NOT EXISTS idx_municipal_provincia ON municipal_templates(provincia, municipio);
INSERT INTO applied_migrations (filename, notes) VALUES
  ('065_municipal_templates.sql', 'A.2: plantillas tramite por municipio, sin RLS')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- =================================================================
-- 066 architect_directives
-- =================================================================
BEGIN;

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
  ('066_architect_directives.sql', 'A.2: directivas estudio + embedding semantico')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- =================================================================
-- 067 roi_metrics
-- =================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS roi_metrics (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  coste_real               numeric(12,2),
  coste_presupuestado      numeric(12,2),
  desviacion_porcentaje    numeric(7,2) GENERATED ALWAYS AS
    (CASE WHEN coste_presupuestado IS NOT NULL AND coste_presupuestado > 0
          THEN ((coste_real - coste_presupuestado) / coste_presupuestado) * 100
          ELSE NULL END) STORED,
  tiempo_real_dias         integer,
  tiempo_previsto_dias     integer,
  satisfaccion_cliente     integer CHECK (satisfaccion_cliente BETWEEN 1 AND 5),
  margen_estudio_eur       numeric(12,2),
  horas_arquitecto         numeric(8,2),
  ahorro_subvenciones_eur  numeric(12,2),
  notas                    text,
  updated_at               timestamptz DEFAULT now(),
  UNIQUE (project_id)
);
CREATE INDEX IF NOT EXISTS idx_roi_tenant ON roi_metrics(tenant_id);
ALTER TABLE roi_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roi_tenant ON roi_metrics;
CREATE POLICY roi_tenant ON roi_metrics
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
INSERT INTO applied_migrations (filename, notes) VALUES
  ('067_roi_metrics.sql', 'A.2: KPIs por proyecto con desviacion calculada')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- =================================================================
-- 068 decision_log
-- =================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS decision_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_origen     text NOT NULL CHECK (decision_origen IN ('arquitecto','cliente','sistema','agente')),
  agente_recomendador text,
  opciones_evaluadas  jsonb NOT NULL,
  opcion_elegida      jsonb NOT NULL,
  criterios_decision  jsonb,
  justificacion       text,
  impacto_economico   numeric(12,2),
  impacto_normativo   text,
  impacto_energetico  text,
  decided_at          timestamptz DEFAULT now(),
  decided_by          uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_decision_project
  ON decision_log(project_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_tenant
  ON decision_log(tenant_id, decided_at DESC);
ALTER TABLE decision_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS decision_tenant ON decision_log;
CREATE POLICY decision_tenant ON decision_log
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
INSERT INTO applied_migrations (filename, notes) VALUES
  ('068_decision_log.sql', 'A.2: log inmutable de decisiones (Fase D)')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- =================================================================
-- 069 client_decisions
-- =================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS client_decisions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_tipo          text CHECK (decision_tipo IN (
    'distribucion','material','presupuesto','plazo','acabados','equipamiento','otro'
  )),
  decision_descripcion   text NOT NULL,
  contexto_propuesta     jsonb,
  impacto_economico      numeric(12,2),
  impacto_plazo_dias     integer,
  fecha_decision         timestamptz DEFAULT now(),
  contradicciones        jsonb,
  confirmada_cliente     boolean DEFAULT false,
  metodo_confirmacion    text CHECK (metodo_confirmacion IN ('email','firma_digital','reunion','chat','otro')),
  evidencia_url          text
);
CREATE INDEX IF NOT EXISTS idx_client_dec_project
  ON client_decisions(project_id, fecha_decision DESC);
CREATE INDEX IF NOT EXISTS idx_client_dec_tenant
  ON client_decisions(tenant_id, fecha_decision DESC);
ALTER TABLE client_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_dec_tenant ON client_decisions;
CREATE POLICY client_dec_tenant ON client_decisions
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
INSERT INTO applied_migrations (filename, notes) VALUES
  ('069_client_decisions.sql', 'A.2: decisiones cliente anti-scope-creep (Fase D)')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- =================================================================
-- 070 rcd_studies + rcd_studies_draft
-- =================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS rcd_studies_draft (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id                uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo_obra                text NOT NULL CHECK (tipo_obra IN ('demolicion','reforma','obra_nueva','rehabilitacion')),
  superficie_m2            numeric(10,2),
  estimacion_residuos      jsonb NOT NULL,
  total_toneladas          numeric(10,3),
  plan_gestion             jsonb,
  gestores_autorizados     jsonb,
  coste_gestion_eur        numeric(10,2),
  alertas_peligrosos       jsonb,
  draft_content            jsonb,
  status                   text DEFAULT 'draft'
    CHECK (status IN ('draft','approved','rejected','superseded')),
  approved_by              uuid REFERENCES auth.users(id),
  approved_at              timestamptz,
  created_at               timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rcd_studies (LIKE rcd_studies_draft INCLUDING ALL);
ALTER TABLE rcd_studies DROP CONSTRAINT IF EXISTS rcd_studies_status_check;
ALTER TABLE rcd_studies ADD CONSTRAINT rcd_studies_status_check CHECK (status = 'approved');
CREATE INDEX IF NOT EXISTS idx_rcd_draft_project ON rcd_studies_draft(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rcd_project       ON rcd_studies(project_id, created_at DESC);
ALTER TABLE rcd_studies_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE rcd_studies       ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rcd_draft_tenant ON rcd_studies_draft;
CREATE POLICY rcd_draft_tenant ON rcd_studies_draft
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
DROP POLICY IF EXISTS rcd_tenant ON rcd_studies;
CREATE POLICY rcd_tenant ON rcd_studies
  FOR ALL
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());
INSERT INTO applied_migrations (filename, notes) VALUES
  ('070_rcd_studies.sql', 'A.2: RCD draft+final con patron Draft/Commit (Fase B.2)')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- =================================================================
-- 071 agents_catalog.status
-- =================================================================
BEGIN;

ALTER TABLE agents_catalog
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'built'
    CHECK (status IN ('built', 'planned', 'deprecated', 'wip'));

CREATE INDEX IF NOT EXISTS idx_agents_catalog_status
  ON agents_catalog(status);

UPDATE agents_catalog SET status = 'planned'
  WHERE agent_name IN (
    'agent_grants_finder',
    'agent_rcd',
    'agent_iee',
    'agent_telematic_filing'
  );

INSERT INTO applied_migrations (filename, notes) VALUES
  ('071_agents_catalog_status.sql', 'A.2 def hecho: status en agents_catalog + 4 agentes Fase B planned')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- =================================================================
-- VERIFICACION FINAL
-- =================================================================

-- 11 nuevas tablas (12 contando rcd_studies+draft, iee_reports+draft separadas)
SELECT COUNT(*) AS tablas_a2_creadas
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'materials_catalog','catalog_sync_log','grants_active',
    'iee_reports','iee_reports_draft',
    'municipal_templates','architect_directives','roi_metrics',
    'decision_log','client_decisions',
    'rcd_studies','rcd_studies_draft'
  );
-- Esperado: 12

-- Tablas con RLS habilitada de A.2
SELECT COUNT(*) AS tablas_con_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
  AND tablename IN (
    'materials_catalog','iee_reports','iee_reports_draft',
    'architect_directives','roi_metrics','decision_log',
    'client_decisions','rcd_studies','rcd_studies_draft'
  );
-- Esperado: 9 (las publicas son catalog_sync_log, grants_active, municipal_templates)

-- Politicas RLS creadas
SELECT COUNT(*) AS policies_a2
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'materials_catalog','iee_reports','iee_reports_draft',
    'architect_directives','roi_metrics','decision_log',
    'client_decisions','rcd_studies','rcd_studies_draft'
  );
-- Esperado: 9 (1 por tabla)

-- agents_catalog status
SELECT status, COUNT(*) AS total FROM agents_catalog GROUP BY status ORDER BY status;
-- Esperado: built=32, planned=4

-- Migraciones registradas
SELECT filename FROM applied_migrations
WHERE filename LIKE '06%' OR filename LIKE '07%'
ORDER BY filename;
-- Esperado al menos: 060, 061, 062, 063, 064, 065, 066, 067, 068, 069, 070, 071
