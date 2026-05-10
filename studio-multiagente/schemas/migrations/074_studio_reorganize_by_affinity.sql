-- ============================================================
-- Migration 074: Reorganizar agentes por afinidad tematica + descongestion
-- Fecha: 2026-05-10
-- Bloque: B72-rediseno (oficina viva v2)
-- ============================================================
--
-- Por que: la asignacion de la migration 056b dejaba urgency_corridor con 7
-- agentes residentes y main_office con 1 solo (Director). Ademas mezclaba
-- agentes de afinidad distinta en meeting_room (comercial + planificacion +
-- coordinacion) y disperaba la postventa en urgencias en vez de junto al
-- Recepcionista que atiende al cliente.
--
-- Esta migration:
--   1. Reagrupa agentes por afinidad tematica (cliente, dibujo, normativa,
--      contable, direccion, comercial, inspeccion, taller, archivo).
--   2. Descongestion urgency_corridor: queda con 0 agentes residentes (solo
--      ruta de paso para state=failed visualmente en el frontend).
--   3. Recalcula default_position para evitar solapes en cada sala segun el
--      numero nuevo de residentes (grid sur del rombo, 60-260 horizontal,
--      90-160 vertical donde el frente abierto deja ver al agente).
--
-- Idempotente: solo UPDATEs, se puede re-ejecutar sin error.
-- ============================================================

BEGIN;

-- ============================================================
-- RECEPCION (3 agentes)
-- Atencion al cliente: primer contacto, chat, postventa
-- ============================================================
UPDATE agents_catalog SET room_id = 'reception',          default_position = '{"x":  80, "y": 110}'::jsonb WHERE agent_name = 'agent_briefing';
UPDATE agents_catalog SET room_id = 'reception',          default_position = '{"x": 240, "y": 110}'::jsonb WHERE agent_name = 'agent_client_concierge';
UPDATE agents_catalog SET room_id = 'reception',          default_position = '{"x": 160, "y": 160}'::jsonb WHERE agent_name = 'agent_aftercare';

-- ============================================================
-- MESA DE DIBUJO (3 agentes)
-- Diseno tecnico + planificacion de obra
-- ============================================================
UPDATE agents_catalog SET room_id = 'drawing_room',       default_position = '{"x":  80, "y": 110}'::jsonb WHERE agent_name = 'agent_design';
UPDATE agents_catalog SET room_id = 'drawing_room',       default_position = '{"x": 240, "y": 110}'::jsonb WHERE agent_name = 'agent_sketch_to_scale';
UPDATE agents_catalog SET room_id = 'drawing_room',       default_position = '{"x": 160, "y": 160}'::jsonb WHERE agent_name = 'agent_planner';

-- ============================================================
-- BIBLIOTECA NORMATIVA (5 agentes)
-- CTE, accesibilidad, compliance, patologia
-- ============================================================
UPDATE agents_catalog SET room_id = 'normative_library',  default_position = '{"x":  60, "y": 110}'::jsonb WHERE agent_name = 'agent_regulatory';
UPDATE agents_catalog SET room_id = 'normative_library',  default_position = '{"x": 160, "y":  90}'::jsonb WHERE agent_name = 'agent_normativa_refresh';
UPDATE agents_catalog SET room_id = 'normative_library',  default_position = '{"x": 260, "y": 110}'::jsonb WHERE agent_name = 'agent_accessibility';
UPDATE agents_catalog SET room_id = 'normative_library',  default_position = '{"x": 100, "y": 160}'::jsonb WHERE agent_name = 'agent_compliance_audit';
UPDATE agents_catalog SET room_id = 'normative_library',  default_position = '{"x": 220, "y": 160}'::jsonb WHERE agent_name = 'agent_pathology';

-- ============================================================
-- DESPACHO CONTABLE (4 agentes)
-- Costes, OCR facturas, anomalias, subvenciones publicas
-- ============================================================
UPDATE agents_catalog SET room_id = 'accounting_office',  default_position = '{"x":  80, "y": 110}'::jsonb WHERE agent_name = 'agent_costs';
UPDATE agents_catalog SET room_id = 'accounting_office',  default_position = '{"x": 240, "y": 110}'::jsonb WHERE agent_name = 'agent_financial_tracker';
UPDATE agents_catalog SET room_id = 'accounting_office',  default_position = '{"x":  80, "y": 160}'::jsonb WHERE agent_name = 'agent_anomaly_detector';
UPDATE agents_catalog SET room_id = 'accounting_office',  default_position = '{"x": 240, "y": 160}'::jsonb WHERE agent_name = 'agent_grants_finder';

-- ============================================================
-- DIRECCION - ORQUESTADOR (2 agentes)
-- Director + su mano derecha (coordinador externo)
-- ============================================================
UPDATE agents_catalog SET room_id = 'main_office',        default_position = '{"x": 160, "y": 100}'::jsonb WHERE agent_name = 'main_orchestrator';
UPDATE agents_catalog SET room_id = 'main_office',        default_position = '{"x": 160, "y": 160}'::jsonb WHERE agent_name = 'agent_collab_coordinator';

-- ============================================================
-- SALA DE REUNIONES (2 agentes)
-- SOLO comercial + juridico (los demas se mueven)
-- ============================================================
UPDATE agents_catalog SET room_id = 'meeting_room',       default_position = '{"x": 100, "y": 130}'::jsonb WHERE agent_name = 'agent_proposal';
UPDATE agents_catalog SET room_id = 'meeting_room',       default_position = '{"x": 220, "y": 130}'::jsonb WHERE agent_name = 'agent_contracts';

-- ============================================================
-- TERRAZA - INSPECCION (4 agentes)
-- Inspeccion de obra + edificios existentes
-- ============================================================
UPDATE agents_catalog SET room_id = 'site_terrace',       default_position = '{"x":  80, "y": 110}'::jsonb WHERE agent_name = 'agent_site_monitor';
UPDATE agents_catalog SET room_id = 'site_terrace',       default_position = '{"x": 240, "y": 110}'::jsonb WHERE agent_name = 'agent_qc_checklists';
UPDATE agents_catalog SET room_id = 'site_terrace',       default_position = '{"x":  80, "y": 160}'::jsonb WHERE agent_name = 'agent_permit_tracker';
UPDATE agents_catalog SET room_id = 'site_terrace',       default_position = '{"x": 240, "y": 160}'::jsonb WHERE agent_name = 'agent_iee';

-- ============================================================
-- TALLER GREMIOS (6 agentes)
-- Construccion: jefe obra, gremios, materiales, PRL, domotica, residuos
-- ============================================================
UPDATE agents_catalog SET room_id = 'trades_workshop',    default_position = '{"x":  60, "y": 100}'::jsonb WHERE agent_name = 'agent_trades';
UPDATE agents_catalog SET room_id = 'trades_workshop',    default_position = '{"x": 160, "y":  90}'::jsonb WHERE agent_name = 'agent_trade_comms';
UPDATE agents_catalog SET room_id = 'trades_workshop',    default_position = '{"x": 260, "y": 100}'::jsonb WHERE agent_name = 'agent_materials';
UPDATE agents_catalog SET room_id = 'trades_workshop',    default_position = '{"x":  60, "y": 160}'::jsonb WHERE agent_name = 'agent_safety_plan';
UPDATE agents_catalog SET room_id = 'trades_workshop',    default_position = '{"x": 160, "y": 170}'::jsonb WHERE agent_name = 'agent_home_automation';
UPDATE agents_catalog SET room_id = 'trades_workshop',    default_position = '{"x": 260, "y": 160}'::jsonb WHERE agent_name = 'agent_rcd';

-- ============================================================
-- ARCHIVO (6 agentes)
-- Documentacion, memoria, certificados, BC3, tramite digital
-- ============================================================
UPDATE agents_catalog SET room_id = 'archive',            default_position = '{"x":  60, "y": 100}'::jsonb WHERE agent_name = 'agent_memory';
UPDATE agents_catalog SET room_id = 'archive',            default_position = '{"x": 160, "y":  90}'::jsonb WHERE agent_name = 'agent_documents';
UPDATE agents_catalog SET room_id = 'archive',            default_position = '{"x": 260, "y": 100}'::jsonb WHERE agent_name = 'agent_certificate_generator';
UPDATE agents_catalog SET room_id = 'archive',            default_position = '{"x":  60, "y": 160}'::jsonb WHERE agent_name = 'agent_energy_assessor';
UPDATE agents_catalog SET room_id = 'archive',            default_position = '{"x": 160, "y": 170}'::jsonb WHERE agent_name = 'util_interop_bc3';
UPDATE agents_catalog SET room_id = 'archive',            default_position = '{"x": 260, "y": 160}'::jsonb WHERE agent_name = 'agent_telematic_filing';

-- ============================================================
-- CORREDOR DE URGENCIAS (0 residentes)
-- Solo zona de paso para state=failed (visual del frontend).
-- Ningun UPDATE: se vacia porque los 7 agentes que estaban antes
-- (aftercare, compliance_audit, pathology, grants_finder, rcd, iee,
-- telematic_filing) se han redistribuido arriba a salas de afinidad.
-- ============================================================

COMMIT;

-- ============================================================
-- VERIFICACION
-- Esperado: distribucion 3-3-5-4-2-2-4-6-6-0 (total 35), urgency=0
-- ============================================================
SELECT
  room_id,
  COUNT(*) AS n_agents,
  STRING_AGG(display_name, ', ' ORDER BY display_order) AS agents
FROM agents_catalog
GROUP BY room_id
ORDER BY
  CASE room_id
    WHEN 'reception'         THEN 1
    WHEN 'drawing_room'      THEN 2
    WHEN 'normative_library' THEN 3
    WHEN 'accounting_office' THEN 4
    WHEN 'main_office'       THEN 5
    WHEN 'meeting_room'      THEN 6
    WHEN 'site_terrace'      THEN 7
    WHEN 'trades_workshop'   THEN 8
    WHEN 'archive'           THEN 9
    WHEN 'urgency_corridor'  THEN 10
    ELSE 99
  END;
