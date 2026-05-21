-- 093: PLAN V1.0 Bloque 11+ fix - activity_log execution para los 3 agentes
-- nuevos V1.0 (agent_acta_obra, agent_incident_handler, agent_client_update).
--
-- Problema detectado en smoke_b11_e2e_execution.mjs paso 9.6:
--   const actsRaw = await pgGet(`activity_log?...&message_type=eq.execution&...`);
--   ok(`activity_log execution: ${actsArr.length} rows`);
-- Siempre devuelve 0 rows porque:
--   1) El trigger de mig 089 inserta con message_type='action' (no 'execution').
--   2) El CHECK de mig 084 ni siquiera permite 'execution' como valor.
--   3) La funcion agent_action_to_natural no cubre los 3 agentes V1.0 (caen
--      en el fallback generico 'He terminado mi tarea').
--
-- Fix en 3 pasos:
--   A. Ampliar el CHECK constraint de message_type para incluir 'execution'.
--   B. Extender agent_action_to_natural con los 3 casos nuevos (frases
--      especificas, mismo formato CASE p_status que el resto del switch).
--   C. Reemplazar trg_agent_executions_log_to_activity para que clasifique:
--        - agentes ejecucion V1.0 -> message_type='execution'
--        - resto (todos los demas) -> message_type='action' (compat 084+089)
--      Asi el smoke detecta exactamente las ejecuciones V1.0 y la vista
--      v_activity_feed_natural (filtra por 'action') sigue funcionando.
--
-- Idempotente: CREATE OR REPLACE en funciones, DROP/CREATE en CHECK.
-- NO toca workflows ni los triggers de INSERT/UPDATE sobre agent_executions.
--
-- NOTA: La numeracion 092 ya estaba ocupada por
-- 092_municipal_pgou_seed_extended.sql (creada en paralelo por otro chat).
-- Por eso este fix usa 093.

BEGIN;

-- ============================================================
-- A. Ampliar CHECK constraint de message_type
-- ============================================================
ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_message_type_check;
ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_message_type_check
  CHECK (message_type IN ('action', 'coordination', 'directive', 'system', 'execution'));

-- ============================================================
-- B. Extender agent_action_to_natural con los 3 agentes V1.0
--    Se mantiene la firma (text, text) -> text y todos los casos previos.
--    Mismo patron CASE p_status (running / completed / failed / fallback).
-- ============================================================
CREATE OR REPLACE FUNCTION agent_action_to_natural(p_agent_name text, p_status text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_agent_name
    -- ====================== DIRECCION / ORQUESTACION ======================
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

    -- ====================== EJECUCION V1.0 (PLAN V1 Bloques 8-11) ======================
    WHEN 'agent_acta_obra' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy redactando el acta de visita de obra...'
      WHEN 'completed' THEN 'He redactado el acta de visita de obra'
      WHEN 'failed'    THEN 'No he podido redactar el acta de visita'
      ELSE 'Estoy procesando la visita de obra' END
    WHEN 'agent_incident_handler' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy analizando un imprevisto detectado en obra...'
      WHEN 'completed' THEN 'He detectado y propuesto opciones para un imprevisto'
      WHEN 'failed'    THEN 'No he podido procesar el imprevisto'
      ELSE 'Estoy gestionando un imprevisto' END
    WHEN 'agent_client_update' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy redactando el resumen semanal del cliente...'
      WHEN 'completed' THEN 'He redactado el resumen semanal del cliente'
      WHEN 'failed'    THEN 'No he podido redactar el resumen semanal'
      ELSE 'Estoy preparando el parte al cliente' END

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

    -- ====================== ONBOARDING TENANT ======================
    WHEN 'agent_onboarding_extract' THEN CASE p_status
      WHEN 'running'   THEN 'Estoy extrayendo los datos del estudio...'
      WHEN 'completed' THEN 'He extraido la informacion del estudio'
      WHEN 'failed'    THEN 'No he podido extraer la informacion'
      ELSE 'Estoy procesando los datos del estudio' END

    -- ====================== FALLBACK GENERICO ======================
    ELSE CASE p_status
      WHEN 'running'   THEN 'Estoy trabajando en el proyecto...'
      WHEN 'completed' THEN 'He terminado mi tarea'
      WHEN 'failed'    THEN 'He tenido un problema con la tarea'
      ELSE 'Estoy en proceso' END
  END;
$$;

-- ============================================================
-- C. Reemplazar trg_agent_executions_log_to_activity para clasificar
--    message_type por agente:
--      - V1.0 ejecucion (acta_obra, incident_handler, client_update)
--        -> message_type = 'execution'
--      - resto -> message_type = 'action' (compat con vista del sidebar)
-- ============================================================
CREATE OR REPLACE FUNCTION trg_agent_executions_log_to_activity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_tenant_id    uuid;
  v_action       text;
  v_message_type text;
BEGIN
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM projects WHERE id = NEW.project_id;
  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_action := agent_action_to_natural(NEW.agent_name, NEW.status);

  -- Clasificacion message_type segun el agente
  IF NEW.agent_name IN ('agent_acta_obra', 'agent_incident_handler', 'agent_client_update') THEN
    v_message_type := 'execution';
  ELSE
    v_message_type := 'action';
  END IF;

  BEGIN
    INSERT INTO activity_log (
      tenant_id, project_id, agent_name, action, message_type,
      from_agent, status, execution_id
    ) VALUES (
      v_tenant_id, NEW.project_id, NEW.agent_name, v_action, v_message_type,
      NEW.agent_name,
      CASE NEW.status
        WHEN 'completed' THEN 'success'
        WHEN 'failed'    THEN 'error'
        WHEN 'reverted'  THEN 'warning'
        ELSE 'success'
      END,
      NEW.id::text
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'trg_agent_executions_log_to_activity failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Los triggers AFTER INSERT/UPDATE creados en mig 089 siguen apuntando a
-- esta funcion (CREATE OR REPLACE). No hay que tocar los triggers.

-- ============================================================
-- Registro de migracion
-- ============================================================
INSERT INTO applied_migrations (filename, notes) VALUES (
  '093_activity_log_execution_v1_agents.sql',
  'PLAN V1 Bloque 11+: extiende agent_action_to_natural con los 3 agentes V1.0 (acta_obra/incident_handler/client_update); amplia CHECK message_type con "execution"; el trigger reemplaza message_type=execution solo para esos 3 agentes (resto sigue como "action"). Para que smoke_b11 detecte rows en activity_log via message_type=eq.execution. La numeracion 092 estaba ocupada por un seed PGOU en paralelo.'
) ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ============================================================
-- Verificacion
-- ============================================================
-- 1. CHECK constraint admite 'execution':
--    SELECT pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conname = 'activity_log_message_type_check';
--    expected: ...(message_type = ANY (ARRAY['action','coordination','directive','system','execution']))
--
-- 2. Funcion mapea los 3 agentes V1.0:
--    SELECT agent_action_to_natural('agent_acta_obra', 'completed');
--    expected: 'He redactado el acta de visita de obra'
--    SELECT agent_action_to_natural('agent_incident_handler', 'running');
--    expected: 'Estoy analizando un imprevisto detectado en obra...'
--    SELECT agent_action_to_natural('agent_client_update', 'completed');
--    expected: 'He redactado el resumen semanal del cliente'
--
-- 3. Smoke E2E B11: tras volver a ejecutar smoke_b11_e2e_execution.mjs,
--    paso 9.6 debe mostrar "activity_log execution: N rows" con N >= 3
--    y agentes={agent_acta_obra, agent_incident_handler, agent_client_update}.
--    (Verificacion adicional: SELECT count(*) FROM activity_log
--      WHERE message_type='execution'
--        AND agent_name IN ('agent_acta_obra','agent_incident_handler','agent_client_update')
--        AND project_id = <PROJECT>;)

-- ============================================================
-- Rollback
-- ============================================================
-- BEGIN;
-- -- Volver al CHECK original (sin 'execution')
-- ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_message_type_check;
-- ALTER TABLE activity_log
--   ADD CONSTRAINT activity_log_message_type_check
--   CHECK (message_type IN ('action','coordination','directive','system'));
-- -- Reaplicar trigger antiguo (siempre 'action'):
-- CREATE OR REPLACE FUNCTION trg_agent_executions_log_to_activity()
-- RETURNS trigger LANGUAGE plpgsql AS $$
-- DECLARE
--   v_tenant_id uuid;
--   v_action    text;
-- BEGIN
--   IF NEW.project_id IS NULL THEN RETURN NEW; END IF;
--   SELECT tenant_id INTO v_tenant_id FROM projects WHERE id = NEW.project_id;
--   IF v_tenant_id IS NULL THEN RETURN NEW; END IF;
--   v_action := agent_action_to_natural(NEW.agent_name, NEW.status);
--   BEGIN
--     INSERT INTO activity_log (tenant_id, project_id, agent_name, action, message_type, from_agent, status, execution_id)
--     VALUES (v_tenant_id, NEW.project_id, NEW.agent_name, v_action, 'action', NEW.agent_name,
--             CASE NEW.status WHEN 'completed' THEN 'success' WHEN 'failed' THEN 'error' WHEN 'reverted' THEN 'warning' ELSE 'success' END,
--             NEW.id::text);
--   EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'trg failed: %', SQLERRM; END;
--   RETURN NEW;
-- END;
-- $$;
-- DELETE FROM applied_migrations WHERE filename='093_activity_log_execution_v1_agents.sql';
-- COMMIT;
