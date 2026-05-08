-- Migration 055: Studio view para X7 (interfaz isometrica Foxhole)
-- Fecha: 2026-05-04
--
-- Crea:
--   1. Tabla studio_rooms (catalogo global de 10 habitaciones)
--   2. Tabla agents_catalog (catalogo global de 30 agentes: 1 orquestador + 13 core + 16 auxiliares)
--   3. Vista v_agent_studio_state (estado en vivo por agente, derivado de agent_executions + approvals)
--   4. RLS read-all para los catalogos, write solo super_admin
--
-- Decisiones congeladas (X7-A en las 5 preguntas):
--   - Catalogo GLOBAL (no per-tenant) para MVP
--   - 4 estados: idle | working | waiting_approval | failed
--   - Estado visual (sin movimiento literal): cada agente fijo en su room
--   - Coexisten email + UI para aprobaciones
--
-- Notas tecnicas:
--   - agent_executions.status enum real: running | completed | failed | reverted
--   - approvals.approval_type enum real: briefing_review | design_review | external_contact
--     | trade_request_send | proposal_review | proposal_send | project_close
--   - RLS implicita filtra por tenant via project_id -> projects.tenant_id
--   - Sprite IDs son provisionales (agent_X_v1) — se reemplazan con doc visual real

BEGIN;

-- ============================================================
-- 1. studio_rooms: 10 habitaciones del estudio
-- ============================================================
CREATE TABLE IF NOT EXISTS studio_rooms (
  room_id            text PRIMARY KEY,
  display_name       text NOT NULL,
  description        text,
  bounding_box       jsonb NOT NULL,
  background_sprite  text,
  display_order      int  NOT NULL DEFAULT 100,
  created_at         timestamptz DEFAULT now()
);

INSERT INTO studio_rooms (room_id, display_name, description, bounding_box, background_sprite, display_order) VALUES
  ('reception',         'Sala de entrada',        'Recepcion de clientes y briefings iniciales',         '{"x":   0, "y":   0, "w": 320, "h": 240}'::jsonb, 'room_reception_v1',     10),
  ('drawing_room',      'Mesa de dibujo',         'Diseno y modelado de opciones',                       '{"x": 320, "y":   0, "w": 320, "h": 240}'::jsonb, 'room_drawing_v1',       20),
  ('normative_library', 'Biblioteca normativa',   'CTE, LOE, normativa autonomica y municipal',          '{"x": 640, "y":   0, "w": 320, "h": 240}'::jsonb, 'room_library_v1',       30),
  ('accounting_office', 'Despacho contable',      'Costes, facturas, presupuestos',                      '{"x":   0, "y": 240, "w": 320, "h": 240}'::jsonb, 'room_accounting_v1',    40),
  ('meeting_room',      'Sala de reuniones',      'Orquestacion central, propuestas, planning',          '{"x": 320, "y": 240, "w": 320, "h": 240}'::jsonb, 'room_meeting_v1',       50),
  ('site_terrace',      'Terraza con prismaticos','Seguimiento de obra en remoto',                       '{"x": 640, "y": 240, "w": 320, "h": 240}'::jsonb, 'room_terrace_v1',       60),
  ('archive',           'Archivo',                'Documentacion, memoria de proyectos, certificados',    '{"x":   0, "y": 480, "w": 320, "h": 240}'::jsonb, 'room_archive_v1',       70),
  ('trades_workshop',   'Taller gremios',         'Coordinacion con gremios y materiales',                '{"x": 320, "y": 480, "w": 320, "h": 240}'::jsonb, 'room_workshop_v1',      80),
  ('kitchen',           'Cocina/descanso',        'Agentes en idle',                                      '{"x": 640, "y": 480, "w": 160, "h": 240}'::jsonb, 'room_kitchen_v1',       90),
  ('urgency_corridor',  'Corredor de urgencias',  'Alertas, fallos, postventa, seguridad',                '{"x": 800, "y": 480, "w": 160, "h": 240}'::jsonb, 'room_urgency_v1',      100)
ON CONFLICT (room_id) DO NOTHING;

COMMENT ON TABLE studio_rooms IS 'Catalogo global de habitaciones del estudio isometrico (X7).';

-- ============================================================
-- 2. agents_catalog: 30 agentes
-- ============================================================
CREATE TABLE IF NOT EXISTS agents_catalog (
  agent_name        text PRIMARY KEY,
  display_name      text NOT NULL,
  category          text NOT NULL CHECK (category IN ('core', 'auxiliary', 'util', 'orchestrator')),
  room_id           text NOT NULL REFERENCES studio_rooms(room_id),
  default_position  jsonb NOT NULL,
  sprite_id         text NOT NULL,
  description       text,
  display_order     int  NOT NULL DEFAULT 100,
  created_at        timestamptz DEFAULT now()
);

INSERT INTO agents_catalog (agent_name, display_name, category, room_id, default_position, sprite_id, description, display_order) VALUES
  -- Orquestador (centro)
  ('main_orchestrator',           'Director del estudio',       'orchestrator', 'meeting_room',      '{"x": 480, "y": 360}'::jsonb, 'main_orchestrator_v1',          'Coordina el flujo de fases y delega a los agentes',                  10),

  -- 13 core
  ('agent_briefing',              'Recepcionista',              'core',         'reception',         '{"x": 160, "y": 120}'::jsonb, 'agent_briefing_v1',             'Recibe al cliente y estructura el briefing',                         100),
  ('agent_design',                'Delineante',                 'core',         'drawing_room',      '{"x": 480, "y": 120}'::jsonb, 'agent_design_v1',               'Genera opciones de redistribucion y compatibilidades',               110),
  ('agent_regulatory',            'Tecnico normativa',          'core',         'normative_library', '{"x": 800, "y": 120}'::jsonb, 'agent_regulatory_v1',           'Lista tramites con citacion y confidence',                           120),
  ('agent_materials',             'Encargado materiales',       'core',         'trades_workshop',   '{"x": 480, "y": 600}'::jsonb, 'agent_materials_v1',            'Selecciona materiales por categoria y proveedor',                    130),
  ('agent_documents',             'Archivero',                  'core',         'archive',           '{"x": 160, "y": 600}'::jsonb, 'agent_documents_v1',            'Genera memoria de proyecto y propuestas en Drive',                   140),
  ('agent_costs',                 'Contable',                   'core',         'accounting_office', '{"x": 160, "y": 360}'::jsonb, 'agent_costs_v1',                'Desglose por partidas y comparativa vs budget',                      150),
  ('agent_trades',                'Jefe de gremios',            'core',         'trades_workshop',   '{"x": 480, "y": 660}'::jsonb, 'agent_trades_v1',               'Prepara encargos por especialidad',                                  160),
  ('agent_proposal',              'Comercial',                  'core',         'meeting_room',      '{"x": 540, "y": 360}'::jsonb, 'agent_proposal_v1',             'Propuesta consolidada con preflight de prerequisitos',               170),
  ('agent_planner',               'Planificador de obra',       'core',         'meeting_room',      '{"x": 420, "y": 400}'::jsonb, 'agent_planner_v1',              'Plan con dependencias y camino critico',                             180),
  ('agent_memory',                'Archivista de memoria',      'core',         'archive',           '{"x": 220, "y": 660}'::jsonb, 'agent_memory_v1',               'Destila proyectos cerrados en memory_cases',                         190),
  ('agent_safety_plan',           'Tecnico PRL',                'core',         'urgency_corridor',  '{"x": 880, "y": 600}'::jsonb, 'agent_safety_plan_v1',          'EBSS/PSS conforme RD 1627/1997',                                     200),
  ('agent_accessibility',         'Auditor accesibilidad',      'core',         'meeting_room',      '{"x": 480, "y": 440}'::jsonb, 'agent_accessibility_v1',        'DB-SUA 9 + Orden VIV/561/2010',                                      210),
  ('agent_normativa_refresh',     'Bibliotecario',              'core',         'normative_library', '{"x": 760, "y": 180}'::jsonb, 'agent_normativa_refresh_v1',    'Detecta cambios en CTE/PGOU/ordenanzas',                             220),

  -- 16 auxiliares
  ('agent_site_monitor',          'Inspector de obra',          'auxiliary',    'site_terrace',      '{"x": 800, "y": 360}'::jsonb, 'agent_site_monitor_v1',         'Vision sobre fotos/videos de obra',                                  300),
  ('agent_trade_comms',           'Mensajero gremios',          'auxiliary',    'trades_workshop',   '{"x": 380, "y": 600}'::jsonb, 'agent_trade_comms_v1',          'Cotizaciones a gremios con webhook_token',                           310),
  ('agent_permit_tracker',        'Tramitador licencias',       'auxiliary',    'urgency_corridor',  '{"x": 880, "y": 540}'::jsonb, 'agent_permit_tracker_v1',       'Tracking licencias municipales',                                     320),
  ('agent_client_concierge',      'Concierge cliente',          'auxiliary',    'reception',         '{"x": 240, "y": 180}'::jsonb, 'agent_client_concierge_v1',     'Chatbot del cliente con escalado',                                   330),
  ('agent_financial_tracker',     'Tesorero',                   'auxiliary',    'accounting_office', '{"x": 220, "y": 420}'::jsonb, 'agent_financial_tracker_v1',    'OCR de facturas y certificaciones',                                  340),
  ('agent_aftercare',             'Atencion postventa',         'auxiliary',    'urgency_corridor',  '{"x": 880, "y": 660}'::jsonb, 'agent_aftercare_v1',            'Incidencias post-entrega LOE',                                       350),
  ('agent_qc_checklists',         'Inspector calidad',          'auxiliary',    'site_terrace',      '{"x": 760, "y": 420}'::jsonb, 'agent_qc_checklists_v1',        'Checklists de calidad por fase',                                     360),
  ('agent_energy_assessor',       'Tecnico energetico',         'auxiliary',    'normative_library', '{"x": 880, "y": 180}'::jsonb, 'agent_energy_assessor_v1',      'Demanda kWh y calificacion CTE DB-HE',                               370),
  ('agent_contracts',             'Notario',                    'auxiliary',    'accounting_office', '{"x": 100, "y": 420}'::jsonb, 'agent_contracts_v1',            'Genera 9 tipos de contrato',                                         380),
  ('agent_anomaly_detector',      'Auditor anomalias',          'auxiliary',    'accounting_office', '{"x": 280, "y": 360}'::jsonb, 'agent_anomaly_detector_v1',     '8 heuristicas de anomalias economicas',                              390),
  ('agent_home_automation',       'Especialista domotica',      'auxiliary',    'drawing_room',      '{"x": 540, "y": 180}'::jsonb, 'agent_home_automation_v1',      'KNX/Matter/Zigbee con preinstalacion',                               400),
  ('agent_pathology',             'Diagnostico estructural',    'auxiliary',    'site_terrace',      '{"x": 720, "y": 300}'::jsonb, 'agent_pathology_v1',            'Vision sobre fotos pre-reforma, 24 patologias',                      410),
  ('util_interop_bc3',            'Importador BC3',             'util',         'archive',           '{"x": 280, "y": 540}'::jsonb, 'util_interop_bc3_v1',           'Export/import FIEBDC-3 para CYPE/Presto',                            420),
  ('agent_collab_coordinator',    'Coordinador colaboradores',  'auxiliary',    'meeting_room',      '{"x": 600, "y": 400}'::jsonb, 'agent_collab_coordinator_v1',   'Coordinacion de calculistas, decoradores',                           430),
  ('agent_compliance_audit',      'Auditor compliance',         'auxiliary',    'normative_library', '{"x": 720, "y": 180}'::jsonb, 'agent_compliance_audit_v1',     'Scorecard A-D con 21 checks por fase',                               440),
  ('agent_certificate_generator', 'Emisor certificados',        'auxiliary',    'archive',           '{"x": 100, "y": 540}'::jsonb, 'agent_certificate_generator_v1','7 tipos de certificado (CFO, habitabilidad, etc.)',                  450)
ON CONFLICT (agent_name) DO NOTHING;

COMMENT ON TABLE agents_catalog IS 'Catalogo global de agentes del estudio (X7). 1 orquestador + 13 core + 16 auxiliares.';

-- ============================================================
-- 3. v_agent_studio_state — estado en vivo por agente
--    El filtrado por tenant es IMPLICITO via RLS sobre agent_executions y approvals.
-- ============================================================
CREATE OR REPLACE VIEW v_agent_studio_state AS
WITH active AS (
  SELECT
    ae.agent_name,
    COUNT(*) FILTER (WHERE ae.status = 'running')                                                AS active_count,
    COUNT(*) FILTER (WHERE ae.status = 'failed' AND ae.started_at > now() - interval '1 hour')   AS recent_failures,
    MAX(ae.started_at) FILTER (WHERE ae.status = 'running')                                       AS last_started_at,
    ARRAY_AGG(DISTINCT ae.project_id) FILTER (WHERE ae.status = 'running')                       AS active_project_ids
  FROM agent_executions ae
  WHERE ae.started_at > now() - interval '24 hours'
  GROUP BY ae.agent_name
),
pending AS (
  SELECT
    CASE a.approval_type
      WHEN 'briefing_review'     THEN 'agent_briefing'
      WHEN 'design_review'       THEN 'agent_design'
      WHEN 'proposal_review'     THEN 'agent_proposal'
      WHEN 'proposal_send'       THEN 'agent_proposal'
      WHEN 'trade_request_send'  THEN 'agent_trades'
      WHEN 'external_contact'    THEN 'main_orchestrator'
      WHEN 'project_close'       THEN 'main_orchestrator'
      ELSE                            'main_orchestrator'
    END AS agent_name,
    COUNT(*) AS pending_count
  FROM approvals a
  WHERE a.status = 'pending'
  GROUP BY 1
)
SELECT
  c.agent_name,
  c.display_name,
  c.category,
  c.room_id,
  c.default_position,
  c.sprite_id,
  c.description,
  c.display_order,
  CASE
    WHEN COALESCE(p.pending_count, 0)   > 0 THEN 'waiting_approval'
    WHEN COALESCE(a.active_count, 0)    > 0 THEN 'working'
    WHEN COALESCE(a.recent_failures, 0) > 0 THEN 'failed'
    ELSE 'idle'
  END                                       AS state,
  COALESCE(a.active_count, 0)               AS active_count,
  COALESCE(p.pending_count, 0)              AS pending_approvals_count,
  COALESCE(a.recent_failures, 0)            AS recent_failures,
  a.last_started_at,
  a.active_project_ids
FROM agents_catalog c
LEFT JOIN active  a ON a.agent_name = c.agent_name
LEFT JOIN pending p ON p.agent_name = c.agent_name
ORDER BY c.display_order;

COMMENT ON VIEW v_agent_studio_state IS
  'Estado en vivo por agente. Filtrado tenant via RLS sobre agent_executions y approvals. Consumida por GET /api/v1/studio/agents.';

-- ============================================================
-- 4. RLS para los catalogos: lectura libre (catalogos globales),
--    escritura solo super_admin.
-- ============================================================
ALTER TABLE studio_rooms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents_catalog   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS studio_rooms_read_all              ON studio_rooms;
DROP POLICY IF EXISTS studio_rooms_write_super_admin     ON studio_rooms;
DROP POLICY IF EXISTS agents_catalog_read_all            ON agents_catalog;
DROP POLICY IF EXISTS agents_catalog_write_super_admin   ON agents_catalog;

CREATE POLICY studio_rooms_read_all
  ON studio_rooms FOR SELECT USING (true);
CREATE POLICY studio_rooms_write_super_admin
  ON studio_rooms FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY agents_catalog_read_all
  ON agents_catalog FOR SELECT USING (true);
CREATE POLICY agents_catalog_write_super_admin
  ON agents_catalog FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ============================================================
-- 5. Registro de la migracion
-- ============================================================
INSERT INTO applied_migrations (filename, applied_by, notes) VALUES (
  '055_studio_view.sql',
  'X7-studio-canvas',
  'Crea studio_rooms (10) + agents_catalog (30) + v_agent_studio_state. RLS read-all, write solo super_admin. Sprite IDs provisionales.'
);

COMMIT;

-- Verificacion (esperado: 10 rooms, 30 agents)
SELECT (SELECT COUNT(*) FROM studio_rooms) AS rooms, (SELECT COUNT(*) FROM agents_catalog) AS agents;
