-- 091: PLAN V1.0 Bloque 7 - alta de los 3 agentes de ejecucion V1.0 en
-- agents_catalog (vista agent_registry los refleja automaticamente) + extender
-- agent_action_to_natural con sus frases en es-ES.
--
-- Nota: agent_registry es una VISTA sobre agents_catalog (mig 084), no una
-- tabla. INSERT real va en agents_catalog. La vista expone color_hex y
-- agent_type derivados de category.
--
-- Adicionalmente recreo agent_registry para mapear category='execution' a
-- color naranja (#C97C5D) en lugar de gris auxiliary (los 3 nuevos seran
-- visualmente distintos en la UI estudio cuando esta se reactive).

BEGIN;

-- ============================================================
-- 0. Ampliar CHECK constraint de agents_catalog.category para incluir 'execution'
--    (descubierto en aplicacion 2026-05-20: el constraint original de mig 056
--    solo permitia orchestrator/core/auxiliary/util)
-- ============================================================
ALTER TABLE agents_catalog DROP CONSTRAINT IF EXISTS agents_catalog_category_check;
ALTER TABLE agents_catalog ADD CONSTRAINT agents_catalog_category_check
  CHECK (category IN ('orchestrator','core','auxiliary','util','execution'));

-- ============================================================
-- 1. INSERT 3 agentes ejecucion en agents_catalog
--    room_id: site_terrace (acta_obra, incident_handler) + reception (client_update)
--    category: 'execution' (nuevo tipo)
--    status: 'planned' por defecto (workflows no construidos aun, se cambia
--            a 'built' cuando se desplieguen sus workflows n8n en Bloques 8-10)
-- ============================================================
INSERT INTO agents_catalog (
  agent_name, display_name, category, room_id, default_position,
  sprite_id, description, display_order, status
) VALUES
  ('agent_acta_obra',         'Cronista de Obra',     'execution', 'site_terrace',
   '{"x": 100, "y": 80}'::jsonb,
   'agent_acta_obra_v1',
   'Procesa audio + fotos de visita de obra a PDF profesional firmable',
   600, 'planned'),
  ('agent_incident_handler',  'Gestor de Imprevistos','execution', 'site_terrace',
   '{"x": 220, "y": 80}'::jsonb,
   'agent_incident_handler_v1',
   'Memoria tecnica + 2 opciones + borrador comunicacion al cliente ante imprevistos en obra',
   610, 'planned'),
  ('agent_client_update',     'Comunicador Cliente',  'execution', 'reception',
   '{"x": 280, "y": 100}'::jsonb,
   'agent_client_update_v1',
   'Genera resumen semanal automatico al cliente con aprobacion del arquitecto',
   620, 'planned')
ON CONFLICT (agent_name) DO UPDATE SET
  display_name     = EXCLUDED.display_name,
  category         = EXCLUDED.category,
  room_id          = EXCLUDED.room_id,
  default_position = EXCLUDED.default_position,
  sprite_id        = EXCLUDED.sprite_id,
  description      = EXCLUDED.description,
  display_order    = EXCLUDED.display_order,
  status           = EXCLUDED.status;

-- ============================================================
-- 2. Recrear agent_registry view con color especifico para 'execution'
--    Color naranja-tierra (#C97C5D) que destaca de orchestrator/core/aux.
-- ============================================================
CREATE OR REPLACE VIEW agent_registry AS
SELECT
  ac.agent_name,
  ac.display_name,
  CASE
    WHEN ac.category = 'orchestrator' THEN 'orchestrator'
    WHEN ac.category = 'core'         THEN 'core'
    WHEN ac.category = 'execution'    THEN 'execution'
    WHEN ac.category = 'util'         THEN 'auxiliary'
    ELSE                                   'auxiliary'
  END AS agent_type,
  CASE
    WHEN ac.category = 'orchestrator' THEN '#F4C430'  -- amarillo
    WHEN ac.category = 'core'         THEN '#4A90D9'  -- azul
    WHEN ac.category = 'execution'    THEN '#C97C5D'  -- naranja tierra
    ELSE                                   '#8A9BA8'  -- gris (auxiliary + util)
  END AS color_hex,
  COALESCE((ac.default_position->>'x')::int, 0) AS default_position_x,
  COALESCE((ac.default_position->>'y')::int, 0) AS default_position_y,
  ac.room_id,
  ac.status,
  ac.display_order
FROM agents_catalog ac;

GRANT SELECT ON agent_registry TO authenticated;

-- ============================================================
-- 3. Extender agent_action_to_natural() con los 3 nuevos
--    Mantiene el mismo shape y comportamiento que mig 089.
-- ============================================================
CREATE OR REPLACE FUNCTION agent_action_to_natural(p_agent_name text, p_status text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_agent_name
    -- ====================== AGENTES PLAN V1.0 EJECUCION ======================
    WHEN 'agent_acta_obra' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy transcribiendo y categorizando la visita de obra...'
      WHEN 'completed' THEN 'He preparado el acta de obra lista para revisar y firmar'
      WHEN 'failed'    THEN 'No he podido procesar el acta de obra'
      ELSE 'Estoy redactando el acta de obra' END
    WHEN 'agent_incident_handler' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy analizando el imprevisto y preparando opciones...'
      WHEN 'completed' THEN 'He preparado la memoria tecnica con opciones para el imprevisto'
      WHEN 'failed'    THEN 'No he podido analizar el imprevisto'
      ELSE 'Estoy gestionando un imprevisto en obra' END
    WHEN 'agent_client_update' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy preparando el resumen semanal para el cliente...'
      WHEN 'completed' THEN 'He preparado el resumen semanal listo para tu revision'
      WHEN 'failed'    THEN 'No he podido preparar el resumen semanal'
      ELSE 'Estoy redactando comunicacion al cliente' END

    -- ====================== DIRECCION / ORQUESTACION (mig 089) ======================
    WHEN 'main_orchestrator' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy coordinando los agentes del estudio...'
      WHEN 'completed' THEN 'He coordinado a los agentes del proyecto'
      WHEN 'failed'    THEN 'No he podido coordinar el proyecto correctamente'
      ELSE 'Estoy gestionando el proyecto' END
    WHEN 'init_new_project' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy creando un nuevo proyecto...'
      WHEN 'completed' THEN 'He creado el proyecto y su carpeta de archivos'
      WHEN 'failed'    THEN 'No he podido crear el proyecto'
      ELSE 'Estoy inicializando el proyecto' END

    -- ====================== RECEPCION ======================
    WHEN 'agent_briefing' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy estructurando el briefing del cliente...'
      WHEN 'completed' THEN 'He preparado el briefing del proyecto'
      WHEN 'failed'    THEN 'No he podido completar el briefing'
      ELSE 'Estoy recogiendo informacion del cliente' END
    WHEN 'agent_client_concierge' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy atendiendo al cliente...'
      WHEN 'completed' THEN 'He respondido al cliente'
      WHEN 'failed'    THEN 'No he podido atender al cliente'
      ELSE 'Estoy en conversacion con el cliente' END
    WHEN 'agent_onboarding' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy guiando el alta del estudio...'
      WHEN 'completed' THEN 'He completado el alta del estudio'
      WHEN 'failed'    THEN 'No he podido completar el alta'
      ELSE 'Estoy en proceso de alta' END
    WHEN 'agent_onboarding_extract' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy extrayendo los datos del estudio...'
      WHEN 'completed' THEN 'He extraido la informacion del estudio'
      WHEN 'failed'    THEN 'No he podido extraer la informacion'
      ELSE 'Estoy procesando los datos del estudio' END

    -- ====================== DISENO ======================
    WHEN 'agent_design' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy generando opciones de redistribucion...'
      WHEN 'completed' THEN 'He preparado varias opciones de diseno'
      WHEN 'failed'    THEN 'No he podido generar opciones de diseno'
      ELSE 'Estoy disenando la propuesta' END
    WHEN 'agent_sketch_to_scale' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy escalando el croquis a planos...'
      WHEN 'completed' THEN 'He convertido el croquis a planos escalados'
      WHEN 'failed'    THEN 'No he podido procesar el croquis'
      ELSE 'Estoy dibujando los planos' END
    WHEN 'agent_decision_engine' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy comparando las opciones del proyecto...'
      WHEN 'completed' THEN 'He preparado la comparativa de opciones'
      WHEN 'failed'    THEN 'No he podido completar la comparativa'
      ELSE 'Estoy evaluando alternativas' END
    WHEN 'agent_client_translator' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy traduciendo la decision del cliente...'
      WHEN 'completed' THEN 'He registrado la decision del cliente'
      WHEN 'failed'    THEN 'No he podido registrar la decision'
      ELSE 'Estoy formalizando la decision' END

    -- ====================== NORMATIVA ======================
    WHEN 'agent_regulatory' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy revisando la normativa aplicable...'
      WHEN 'completed' THEN 'He identificado los tramites necesarios'
      WHEN 'failed'    THEN 'No he podido completar la revision normativa'
      ELSE 'Estoy consultando normativa' END
    WHEN 'agent_normativa_refresh' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy actualizando el CTE y las ordenanzas...'
      WHEN 'completed' THEN 'He actualizado la cache de normativa'
      WHEN 'failed'    THEN 'No he podido actualizar la normativa'
      ELSE 'Estoy revisando cambios normativos' END
    WHEN 'agent_normativa_fetch' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy descargando la normativa del municipio...'
      WHEN 'completed' THEN 'He cargado la normativa urbanistica del municipio'
      WHEN 'failed'    THEN 'No he podido descargar la normativa municipal'
      ELSE 'Estoy procesando la normativa local' END
    WHEN 'agent_municipal_precheck' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy haciendo el pre-check normativo del municipio...'
      WHEN 'completed' THEN 'He completado el pre-check de normativa local'
      WHEN 'failed'    THEN 'No he podido completar el pre-check'
      ELSE 'Estoy verificando normativa local' END
    WHEN 'agent_accessibility' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy verificando el cumplimiento del DB-SUA...'
      WHEN 'completed' THEN 'He auditado la accesibilidad del proyecto'
      WHEN 'failed'    THEN 'No he podido auditar accesibilidad'
      ELSE 'Estoy comprobando accesibilidad' END
    WHEN 'agent_compliance_audit' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy auditando el cumplimiento del proyecto...'
      WHEN 'completed' THEN 'He completado la auditoria de cumplimiento'
      WHEN 'failed'    THEN 'No he podido completar la auditoria'
      ELSE 'Estoy auditando el proyecto' END

    -- ====================== ECONOMIA ======================
    WHEN 'agent_costs' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy calculando el presupuesto del proyecto...'
      WHEN 'completed' THEN 'He calculado el presupuesto base de la reforma'
      WHEN 'failed'    THEN 'No he podido calcular el presupuesto'
      ELSE 'Estoy preparando el desglose economico' END
    WHEN 'agent_financial_tracker' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy registrando facturas y certificaciones...'
      WHEN 'completed' THEN 'He actualizado el seguimiento financiero'
      WHEN 'failed'    THEN 'No he podido actualizar el seguimiento'
      ELSE 'Estoy revisando facturas' END
    WHEN 'agent_anomaly_detector' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy revisando los costes en busca de anomalias...'
      WHEN 'completed' THEN 'He revisado los costes del proyecto'
      WHEN 'failed'    THEN 'No he podido revisar las anomalias'
      ELSE 'Estoy controlando partidas' END
    WHEN 'agent_grants_finder' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy buscando subvenciones aplicables al proyecto...'
      WHEN 'completed' THEN 'He encontrado subvenciones aplicables'
      WHEN 'failed'    THEN 'No he podido buscar subvenciones'
      ELSE 'Estoy revisando ayudas publicas' END

    -- ====================== VENTAS / CONTRATOS ======================
    WHEN 'agent_proposal' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy preparando la propuesta comercial...'
      WHEN 'completed' THEN 'He preparado la propuesta para el cliente'
      WHEN 'failed'    THEN 'No he podido preparar la propuesta'
      ELSE 'Estoy redactando la propuesta' END
    WHEN 'agent_proposal_moodboard' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy creando el moodboard visual...'
      WHEN 'completed' THEN 'He preparado el moodboard de la propuesta'
      WHEN 'failed'    THEN 'No he podido crear el moodboard'
      ELSE 'Estoy disenando el moodboard' END
    WHEN 'agent_proposal_render' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy generando el render fotorrealista...'
      WHEN 'completed' THEN 'He preparado el render del proyecto'
      WHEN 'failed'    THEN 'No he podido generar el render'
      ELSE 'Estoy renderizando' END
    WHEN 'agent_contracts' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy redactando el contrato...'
      WHEN 'completed' THEN 'He preparado el contrato'
      WHEN 'failed'    THEN 'No he podido preparar el contrato'
      ELSE 'Estoy revisando clausulas legales' END
    WHEN 'agent_collab_coordinator' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy coordinando con los colaboradores externos...'
      WHEN 'completed' THEN 'He coordinado al equipo externo'
      WHEN 'failed'    THEN 'No he podido coordinar al equipo externo'
      ELSE 'Estoy hablando con calculistas y decoradores' END

    -- ====================== PLANIFICACION ======================
    WHEN 'agent_planner' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy planificando el calendario de obra...'
      WHEN 'completed' THEN 'He preparado el plan de obra con camino critico'
      WHEN 'failed'    THEN 'No he podido planificar la obra'
      ELSE 'Estoy organizando el calendario' END

    -- ====================== OBRA / TERRAZA ======================
    WHEN 'agent_site_monitor' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy revisando las fotos y videos de obra...'
      WHEN 'completed' THEN 'He revisado el estado actual de la obra'
      WHEN 'failed'    THEN 'No he podido revisar la obra'
      ELSE 'Estoy inspeccionando' END
    WHEN 'agent_permit_tracker' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy haciendo seguimiento de la licencia...'
      WHEN 'completed' THEN 'He actualizado el estado de las licencias'
      WHEN 'failed'    THEN 'No he podido actualizar las licencias'
      ELSE 'Estoy tramitando licencias' END
    WHEN 'agent_qc_checklists' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy revisando los checklists de calidad...'
      WHEN 'completed' THEN 'He completado el control de calidad'
      WHEN 'failed'    THEN 'No he podido completar los checklists'
      ELSE 'Estoy controlando calidad' END
    WHEN 'agent_iee' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy preparando el Informe de Evaluacion del Edificio...'
      WHEN 'completed' THEN 'He preparado el IEE del edificio'
      WHEN 'failed'    THEN 'No he podido completar el IEE'
      ELSE 'Estoy evaluando el edificio' END

    -- ====================== TALLER / GREMIOS ======================
    WHEN 'agent_trades' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy preparando los encargos para los gremios...'
      WHEN 'completed' THEN 'He preparado los encargos por especialidad'
      WHEN 'failed'    THEN 'No he podido preparar los encargos'
      ELSE 'Estoy organizando los gremios' END
    WHEN 'agent_trade_comms' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy pidiendo cotizaciones a los gremios...'
      WHEN 'completed' THEN 'He enviado las peticiones de cotizacion'
      WHEN 'failed'    THEN 'No he podido enviar las cotizaciones'
      ELSE 'Estoy contactando con gremios' END
    WHEN 'agent_materials' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy seleccionando los materiales del proyecto...'
      WHEN 'completed' THEN 'He elegido los materiales para la reforma'
      WHEN 'failed'    THEN 'No he podido seleccionar materiales'
      ELSE 'Estoy buscando materiales' END
    WHEN 'agent_catalog_sync' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy sincronizando el catalogo de materiales...'
      WHEN 'completed' THEN 'He actualizado el catalogo de materiales'
      WHEN 'failed'    THEN 'No he podido sincronizar el catalogo'
      ELSE 'Estoy actualizando el catalogo' END
    WHEN 'agent_safety_plan' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy preparando el Plan de Seguridad y Salud...'
      WHEN 'completed' THEN 'He preparado el EBSS/PSS de la obra'
      WHEN 'failed'    THEN 'No he podido preparar el plan de seguridad'
      ELSE 'Estoy redactando el plan de seguridad' END
    WHEN 'agent_home_automation' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy disenando la domotica del proyecto...'
      WHEN 'completed' THEN 'He preparado la propuesta de domotica'
      WHEN 'failed'    THEN 'No he podido disenar la domotica'
      ELSE 'Estoy configurando domotica' END
    WHEN 'agent_rcd' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy preparando el Estudio de Gestion de Residuos...'
      WHEN 'completed' THEN 'He preparado el estudio de RCD'
      WHEN 'failed'    THEN 'No he podido preparar el estudio RCD'
      ELSE 'Estoy calculando residuos de obra' END

    -- ====================== ARCHIVO / DOCUMENTACION ======================
    WHEN 'agent_memory' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy archivando las decisiones del proyecto...'
      WHEN 'completed' THEN 'He guardado las decisiones del proyecto'
      WHEN 'failed'    THEN 'No he podido archivar las decisiones'
      ELSE 'Estoy organizando la memoria del estudio' END
    WHEN 'agent_documents' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy generando la documentacion del proyecto...'
      WHEN 'completed' THEN 'He preparado la documentacion del proyecto'
      WHEN 'failed'    THEN 'No he podido generar la documentacion'
      ELSE 'Estoy redactando documentos' END
    WHEN 'agent_certificate_generator' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy generando el certificado...'
      WHEN 'completed' THEN 'He emitido el certificado'
      WHEN 'failed'    THEN 'No he podido emitir el certificado'
      ELSE 'Estoy preparando un certificado' END
    WHEN 'agent_energy_assessor' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy calculando la calificacion energetica...'
      WHEN 'completed' THEN 'He preparado la evaluacion energetica'
      WHEN 'failed'    THEN 'No he podido evaluar la eficiencia energetica'
      ELSE 'Estoy analizando consumo energetico' END
    WHEN 'agent_telematic_filing' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy preparando el expediente para la sede electronica...'
      WHEN 'completed' THEN 'He preparado el expediente telematico'
      WHEN 'failed'    THEN 'No he podido empaquetar el expediente'
      ELSE 'Estoy organizando documentos para tramitar' END
    WHEN 'util_interop_bc3' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy importando el archivo BC3...'
      WHEN 'completed' THEN 'He importado el presupuesto BC3'
      WHEN 'failed'    THEN 'No he podido leer el archivo BC3'
      ELSE 'Estoy procesando archivos de presupuesto' END

    -- ====================== URGENCIAS / POSTVENTA ======================
    WHEN 'agent_aftercare' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy revisando una incidencia post-entrega...'
      WHEN 'completed' THEN 'He registrado la incidencia de postventa'
      WHEN 'failed'    THEN 'No he podido procesar la incidencia'
      ELSE 'Estoy en postventa' END
    WHEN 'agent_pathology' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy analizando las patologias del edificio...'
      WHEN 'completed' THEN 'He identificado las patologias del edificio'
      WHEN 'failed'    THEN 'No he podido analizar las patologias'
      ELSE 'Estoy revisando fotos del edificio' END

    -- ====================== FALLBACK GENERICO ======================
    ELSE CASE p_status
      WHEN 'running'   THEN 'Estoy trabajando en el proyecto...'
      WHEN 'completed' THEN 'He terminado mi tarea'
      WHEN 'failed'    THEN 'He tenido un problema con la tarea'
      ELSE 'Estoy en proceso' END
  END;
$$;

-- ============================================================
-- Registro
-- ============================================================
INSERT INTO applied_migrations (filename, notes) VALUES (
  '091_agent_registry_execution.sql',
  'PLAN V1 Bloque 7: alta de 3 agentes execution (acta_obra, incident_handler, client_update) en agents_catalog + vista agent_registry con color naranja (#C97C5D) para category=execution + extender agent_action_to_natural con frases es-ES de los 3 nuevos'
) ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ============================================================
-- Verificacion
-- ============================================================
-- SELECT agent_name, display_name, agent_type, color_hex, room_id, status
--   FROM agent_registry
--  WHERE agent_name IN ('agent_acta_obra','agent_incident_handler','agent_client_update')
--  ORDER BY agent_name;
-- expected: 3 filas, agent_type='execution', color_hex='#C97C5D', status='planned'

-- SELECT agent_action_to_natural('agent_acta_obra', 'running');
-- expected: 'Estoy transcribiendo y categorizando la visita de obra...'

-- ============================================================
-- Rollback
-- ============================================================
-- BEGIN;
-- DELETE FROM agents_catalog WHERE agent_name IN ('agent_acta_obra','agent_incident_handler','agent_client_update');
-- -- Restaurar agent_registry sin 'execution' (caer al CASE de mig 084):
-- CREATE OR REPLACE VIEW agent_registry AS
-- SELECT agent_name, display_name,
--   CASE WHEN category='orchestrator' THEN 'orchestrator'
--        WHEN category='core' THEN 'core'
--        WHEN category='util' THEN 'auxiliary'
--        ELSE 'auxiliary' END AS agent_type,
--   CASE WHEN category='orchestrator' THEN '#F4C430'
--        WHEN category='core' THEN '#4A90D9'
--        ELSE '#8A9BA8' END AS color_hex,
--   COALESCE((default_position->>'x')::int,0) AS default_position_x,
--   COALESCE((default_position->>'y')::int,0) AS default_position_y,
--   room_id, status, display_order
-- FROM agents_catalog;
-- -- Restaurar agent_action_to_natural SIN los 3 nuevos: re-aplicar mig 089.
-- DELETE FROM applied_migrations WHERE filename='091_agent_registry_execution.sql';
-- COMMIT;
