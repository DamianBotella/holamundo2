-- Migration 056: Studio layout v7 (FOXHOLE_VISUAL_X7)
-- Fecha: 2026-05-05
--
-- Aplica el layout definitivo del documento visual de Foxhole:
--   - studio_rooms: 10 habitaciones con bounding box v7 (filas h=200) + floor_color
--   - main_office es habitacion separada para el orquestador (antes en meeting_room)
--   - urgency_corridor pasa a barra completa abajo (960x160)
--   - kitchen ELIMINADA (no aparece en layout v7)
--   - agents_catalog: posiciones RELATIVAS a la room (no globales) + reasignaciones
--   - INSERT de 5 agentes pre-launch nuevos (roadmap v2.0): sketch_to_scale,
--     grants_finder, rcd, iee, telematic_filing — con state idle hasta construirse
--
-- IMPORTANTE: las posiciones default_position son ahora RELATIVAS a su room.
-- El frontend debe sumar room.bounding_box.x + agent.default_position.x al renderizar.

BEGIN;

-- ============================================================
-- 1. Anadir columna floor_color a studio_rooms
-- ============================================================
ALTER TABLE studio_rooms ADD COLUMN IF NOT EXISTS floor_color text;

-- ============================================================
-- 2. Reescribir studio_rooms con layout v7
-- ============================================================

-- Eliminar foreign key para poder reordenar
ALTER TABLE agents_catalog DROP CONSTRAINT IF EXISTS agents_catalog_room_id_fkey;

-- Vaciar y volver a poblar
DELETE FROM studio_rooms;

INSERT INTO studio_rooms (room_id, display_name, description, bounding_box, floor_color, background_sprite, display_order) VALUES
  ('reception',         'Recepcion',                'Entrada principal del estudio. El briefing empieza aqui.',
    '{"x":   0, "y":   0, "w": 320, "h": 200}'::jsonb, '#3F3227', 'room_reception_v1',  10),
  ('drawing_room',      'Mesa de Dibujo',           'Area de diseno y delineacion.',
    '{"x": 320, "y":   0, "w": 320, "h": 200}'::jsonb, '#3D3628', 'room_drawing_v1',    20),
  ('normative_library', 'Biblioteca Normativa',     'Consulta y actualizacion de CTE, normativas y regulaciones.',
    '{"x": 640, "y":   0, "w": 320, "h": 200}'::jsonb, '#352E25', 'room_library_v1',    30),
  ('accounting_office', 'Despacho Contable',        'Control economico: costes, presupuestos y facturas.',
    '{"x":   0, "y": 200, "w": 320, "h": 200}'::jsonb, '#3D3628', 'room_accounting_v1', 40),
  ('main_office',       'Direccion - Orquestador',  'El cerebro del estudio. Coordina a todos los agentes.',
    '{"x": 320, "y": 200, "w": 320, "h": 200}'::jsonb, '#3A3530', 'room_main_office_v1', 50),
  ('meeting_room',      'Sala de Reuniones',        'Propuestas, contratos y aprobaciones con clientes.',
    '{"x": 640, "y": 200, "w": 320, "h": 200}'::jsonb, '#3A3530', 'room_meeting_v1',    60),
  ('site_terrace',      'Terraza - Inspeccion',     'Seguimiento de obra en tiempo real.',
    '{"x":   0, "y": 400, "w": 320, "h": 200}'::jsonb, '#3A4030', 'room_terrace_v1',    70),
  ('trades_workshop',   'Taller - Gremios',         'Coordinacion con gremios, materiales y seguridad.',
    '{"x": 320, "y": 400, "w": 320, "h": 200}'::jsonb, '#3D3628', 'room_workshop_v1',   80),
  ('archive',           'Archivo',                  'Memoria del estudio, documentos y certificados.',
    '{"x": 640, "y": 400, "w": 320, "h": 200}'::jsonb, '#352E25', 'room_archive_v1',    90),
  ('urgency_corridor',  'Corredor de Urgencias',    'Alertas criticas, aftercare, anomalias y auditorias.',
    '{"x":   0, "y": 600, "w": 960, "h": 160}'::jsonb, '#3A2520', 'room_urgency_v1',   100);

-- Restaurar foreign key
ALTER TABLE agents_catalog ADD CONSTRAINT agents_catalog_room_id_fkey
  FOREIGN KEY (room_id) REFERENCES studio_rooms(room_id);

-- ============================================================
-- 3. Reescribir agents_catalog con layout v7
--    default_position es RELATIVA a la room.
-- ============================================================

DELETE FROM agents_catalog;

INSERT INTO agents_catalog (agent_name, display_name, category, room_id, default_position, sprite_id, description, display_order) VALUES
  -- DIRECCION
  ('main_orchestrator',           'Director',                 'orchestrator', 'main_office',        '{"x": 160, "y": 100}'::jsonb, 'director_v1',                   'Coordina todos los agentes y delega segun fase del proyecto', 10),

  -- RECEPCION
  ('agent_briefing',              'Recepcionista',            'core',         'reception',          '{"x":  80, "y": 100}'::jsonb, 'receptionist_v1',               'Recibe al cliente y estructura el briefing',                  100),
  ('agent_client_concierge',      'Asesor de Cliente',        'auxiliary',    'reception',          '{"x": 200, "y": 100}'::jsonb, 'agent_client_concierge_v1',     'Chatbot del cliente con escalado al arquitecto',              330),

  -- MESA DE DIBUJO
  ('agent_design',                'Delineante',               'core',         'drawing_room',       '{"x":  80, "y": 100}'::jsonb, 'drafter_v1',                    'Genera opciones de redistribucion y compatibilidades',        110),
  ('agent_sketch_to_scale',       'Croquista',                'auxiliary',    'drawing_room',       '{"x": 200, "y": 100}'::jsonb, 'agent_sketch_to_scale_v1',      'Convierte croquis y fotos a planos escalados (pre-launch)',   460),
  ('agent_home_automation',       'Domotico',                 'auxiliary',    'trades_workshop',    '{"x": 240, "y": 140}'::jsonb, 'agent_home_automation_v1',      'KNX/Matter/Zigbee con preinstalacion',                        400),

  -- BIBLIOTECA NORMATIVA
  ('agent_regulatory',            'Tecnico Normativa',        'core',         'normative_library',  '{"x":  80, "y": 100}'::jsonb, 'normative_v1',                  'Lista tramites con citacion y confidence',                    120),
  ('agent_normativa_refresh',     'Actualizador CTE',         'core',         'normative_library',  '{"x": 200, "y": 100}'::jsonb, 'agent_normativa_refresh_v1',    'Detecta cambios en CTE/PGOU/ordenanzas',                      220),
  ('agent_accessibility',         'Auditor Accesibilidad',    'core',         'normative_library',  '{"x":  80, "y": 160}'::jsonb, 'agent_accessibility_v1',        'DB-SUA 9 + Orden VIV/561/2010',                               210),

  -- DESPACHO CONTABLE
  ('agent_costs',                 'Contable',                 'core',         'accounting_office',  '{"x":  80, "y": 100}'::jsonb, 'accountant_v1',                 'Desglose por partidas y comparativa vs budget',               150),
  ('agent_financial_tracker',     'Tracker Financiero',       'auxiliary',    'accounting_office',  '{"x": 200, "y": 100}'::jsonb, 'agent_financial_tracker_v1',    'OCR de facturas y certificaciones',                           340),
  ('agent_anomaly_detector',      'Inspector Fraude',         'auxiliary',    'accounting_office',  '{"x":  80, "y": 160}'::jsonb, 'agent_anomaly_detector_v1',     '8 heuristicas de anomalias economicas',                       390),

  -- SALA DE REUNIONES
  ('agent_proposal',              'Jefe de Ventas',           'core',         'meeting_room',       '{"x":  80, "y": 100}'::jsonb, 'agent_proposal_v1',             'Propuesta consolidada con preflight de prerequisitos',        170),
  ('agent_contracts',             'Juridico',                 'auxiliary',    'meeting_room',       '{"x": 200, "y": 100}'::jsonb, 'agent_contracts_v1',            'Genera 9 tipos de contrato',                                  380),
  ('agent_collab_coordinator',    'Coord. Externo',           'auxiliary',    'meeting_room',       '{"x":  80, "y": 160}'::jsonb, 'agent_collab_coordinator_v1',   'Coordinacion de calculistas, decoradores',                    430),
  ('agent_planner',               'Planificador de obra',     'core',         'meeting_room',       '{"x": 200, "y": 160}'::jsonb, 'agent_planner_v1',              'Plan con dependencias y camino critico',                      180),

  -- TERRAZA - INSPECCION
  ('agent_site_monitor',          'Inspector Obra',           'auxiliary',    'site_terrace',       '{"x":  80, "y": 100}'::jsonb, 'site_inspector_v1',             'Vision sobre fotos/videos de obra',                           300),
  ('agent_permit_tracker',        'Tramitador',               'auxiliary',    'site_terrace',       '{"x": 200, "y": 100}'::jsonb, 'tramitador_v1',                 'Tracking licencias municipales',                              320),
  ('agent_qc_checklists',         'Controlador QC',           'auxiliary',    'site_terrace',       '{"x":  80, "y": 160}'::jsonb, 'agent_qc_checklists_v1',        'Checklists de calidad por fase',                              360),

  -- TALLER - GREMIOS
  ('agent_trades',                'Jefe de Obra',             'core',         'trades_workshop',    '{"x":  80, "y":  60}'::jsonb, 'foreman_v1',                    'Prepara encargos por especialidad',                           160),
  ('agent_trade_comms',           'Comunicador',              'auxiliary',    'trades_workshop',    '{"x": 200, "y":  60}'::jsonb, 'agent_trade_comms_v1',          'Cotizaciones a gremios con webhook_token',                    310),
  ('agent_materials',             'Jefe Materiales',          'core',         'trades_workshop',    '{"x":  80, "y": 120}'::jsonb, 'agent_materials_v1',            'Selecciona materiales por categoria y proveedor',             130),
  ('agent_safety_plan',           'Tecnico PRL',              'core',         'trades_workshop',    '{"x": 200, "y": 120}'::jsonb, 'safety_v1',                     'EBSS/PSS conforme RD 1627/1997',                              200),

  -- ARCHIVO
  ('agent_memory',                'Archivista',               'core',         'archive',            '{"x":  80, "y": 100}'::jsonb, 'archivist_v1',                  'Destila proyectos cerrados en memory_cases',                  190),
  ('agent_documents',             'Documentalista',           'core',         'archive',            '{"x": 200, "y": 100}'::jsonb, 'agent_documents_v1',            'Genera memoria de proyecto y propuestas en Drive',            140),
  ('agent_certificate_generator', 'Certificador',             'auxiliary',    'archive',            '{"x":  80, "y": 160}'::jsonb, 'agent_certificate_generator_v1','7 tipos de certificado (CFO, habitabilidad, etc.)',           450),
  ('agent_energy_assessor',       'Efic. Energetica',         'auxiliary',    'archive',            '{"x": 200, "y": 160}'::jsonb, 'agent_energy_assessor_v1',      'Demanda kWh y calificacion CTE DB-HE',                        370),
  ('util_interop_bc3',            'Importador BC3',           'util',         'archive',            '{"x": 280, "y": 100}'::jsonb, 'util_interop_bc3_v1',           'Export/import FIEBDC-3 para CYPE/Presto',                     420),

  -- CORREDOR DE URGENCIAS (ancho 960, 7 agentes espaciados ~135px)
  ('agent_aftercare',             'Postventa',                'auxiliary',    'urgency_corridor',   '{"x":  60, "y":  80}'::jsonb, 'agent_aftercare_v1',            'Incidencias post-entrega LOE',                                350),
  ('agent_compliance_audit',      'Auditor',                  'auxiliary',    'urgency_corridor',   '{"x": 200, "y":  80}'::jsonb, 'agent_compliance_audit_v1',     'Scorecard A-D con 21 checks por fase',                        440),
  ('agent_pathology',             'Patologo',                 'auxiliary',    'urgency_corridor',   '{"x": 340, "y":  80}'::jsonb, 'agent_pathology_v1',            'Vision sobre fotos pre-reforma, 24 patologias',               410),
  ('agent_grants_finder',         'Subvenciones',             'auxiliary',    'urgency_corridor',   '{"x": 480, "y":  80}'::jsonb, 'agent_grants_finder_v1',        'Buscador de subvenciones Next Gen (pre-launch)',              470),
  ('agent_rcd',                   'Residuos',                 'auxiliary',    'urgency_corridor',   '{"x": 620, "y":  80}'::jsonb, 'agent_rcd_v1',                  'Estudio de Gestion de Residuos RD 105/2008 (pre-launch)',     480),
  ('agent_iee',                   'IEE',                      'auxiliary',    'urgency_corridor',   '{"x": 760, "y":  80}'::jsonb, 'agent_iee_v1',                  'Informe Evaluacion Edificios >50 anos (pre-launch)',          490),
  ('agent_telematic_filing',      'Tramitador Digital',       'auxiliary',    'urgency_corridor',   '{"x": 900, "y":  80}'::jsonb, 'agent_telematic_filing_v1',     'Empaqueta expedientes para sede electronica (pre-launch)',    500);

-- ============================================================
-- 4. Registro de la migracion
-- ============================================================
INSERT INTO applied_migrations (filename, applied_by, notes) VALUES (
  '056_studio_layout_v7.sql',
  'X7-foxhole-visual',
  'Layout definitivo v7: 10 rooms (kitchen eliminada, main_office anadida, urgency_corridor barra completa). agents_catalog reescrito con room_id correctos del doc visual + posiciones RELATIVAS + 5 agentes pre-launch. floor_color por room.'
);

COMMIT;

-- Verificacion (esperado: 10 rooms, 35 agents)
SELECT
  (SELECT COUNT(*) FROM studio_rooms)     AS rooms,
  (SELECT COUNT(*) FROM agents_catalog)   AS agents;
