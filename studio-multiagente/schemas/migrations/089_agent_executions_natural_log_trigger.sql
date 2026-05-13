-- 089: ADDENDUM 2 Bloque 3 (approach SQL trigger en lugar de editar 30
-- workflows). Cuando un agente crea una agent_execution o cambia su
-- status, este trigger inserta automaticamente una entry naturalizada
-- en activity_log con message_type='action'. La UI futura (ActivitySidebar)
-- la consumira directamente.
--
-- Premisa: cada workflow agent_* ya escribe en agent_executions (patron
-- estandar documentado en CLAUDE.md seccion 4). Por tanto este trigger
-- cubre el 100% de las ejecuciones SIN tocar ningun workflow.
--
-- Texto en espaniol (presente progresivo si running, preterito perfecto si
-- completed/failed). Sin terminos tecnicos ("workflow", "INSERT", "JSON")
-- per la regla 4.2 del ADDENDUM 2.

BEGIN;

-- ============================================================
-- 1. Funcion de mapeo agent_name -> frase natural
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
-- 2. Funcion de trigger: inserta en activity_log
--    Logica: solo loguear si el agente tiene project_id (porque tenant_id
--    se hereda del JOIN a projects). Si project_id IS NULL, saltamos
--    (los agentes globales como agent_normativa_refresh sin proyecto).
-- ============================================================
CREATE OR REPLACE FUNCTION trg_agent_executions_log_to_activity()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_tenant_id uuid;
  v_action    text;
BEGIN
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM projects WHERE id = NEW.project_id;
  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_action := agent_action_to_natural(NEW.agent_name, NEW.status);

  -- Insert sin RAISE EXCEPTION si falla algo: el trigger NUNCA debe romper
  -- la transaccion principal del agente. Por eso vivimos en BEFORE/AFTER
  -- y atrapamos errores con EXCEPTION WHEN OTHERS.
  BEGIN
    INSERT INTO activity_log (
      tenant_id, project_id, agent_name, action, message_type,
      from_agent, status, execution_id
    ) VALUES (
      v_tenant_id, NEW.project_id, NEW.agent_name, v_action, 'action',
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
    -- log silencioso. No matar la transaccion del agente.
    RAISE NOTICE 'trg_agent_executions_log_to_activity failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Triggers AFTER INSERT y AFTER UPDATE
--    INSERT: agente arranca (status='running' por default)
--    UPDATE: cambio de status (running -> completed/failed/reverted)
-- ============================================================
DROP TRIGGER IF EXISTS trg_agent_exec_insert_log ON agent_executions;
CREATE TRIGGER trg_agent_exec_insert_log
  AFTER INSERT ON agent_executions
  FOR EACH ROW
  EXECUTE FUNCTION trg_agent_executions_log_to_activity();

DROP TRIGGER IF EXISTS trg_agent_exec_update_log ON agent_executions;
CREATE TRIGGER trg_agent_exec_update_log
  AFTER UPDATE OF status ON agent_executions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trg_agent_executions_log_to_activity();

-- ============================================================
-- 4. Backfill opcional: generar entries para ejecuciones de las ultimas
--    24h que no tengan ya entry en activity_log para ese execution_id.
--    Comentado por defecto. Descomentar si quieres seed retroactivo.
-- ============================================================
-- INSERT INTO activity_log (tenant_id, project_id, agent_name, action, message_type, from_agent, status, execution_id, created_at)
-- SELECT p.tenant_id, ae.project_id, ae.agent_name,
--        agent_action_to_natural(ae.agent_name, ae.status),
--        'action', ae.agent_name,
--        CASE ae.status WHEN 'completed' THEN 'success' WHEN 'failed' THEN 'error' ELSE 'success' END,
--        ae.id::text, COALESCE(ae.finished_at, ae.started_at)
--   FROM agent_executions ae
--   JOIN projects p ON p.id = ae.project_id
--  WHERE ae.started_at >= now() - interval '24 hours'
--    AND NOT EXISTS (
--      SELECT 1 FROM activity_log al WHERE al.execution_id = ae.id::text AND al.message_type = 'action'
--    );

-- ============================================================
-- 5. Registro de migracion
-- ============================================================
INSERT INTO applied_migrations (filename, notes) VALUES (
  '089_agent_executions_natural_log_trigger.sql',
  'ADDENDUM 2 Bloque 3 (SQL trigger approach): agent_action_to_natural function + triggers AFTER INSERT/UPDATE en agent_executions -> activity_log con texto natural ES. Cubre 35+ agentes con fallback generico. Sin tocar workflows.'
) ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ============================================================
-- Verificacion
-- ============================================================
-- SELECT agent_action_to_natural('agent_costs', 'running');
-- expected: 'Estoy calculando el presupuesto del proyecto...'
--
-- SELECT agent_action_to_natural('agent_costs', 'completed');
-- expected: 'He calculado el presupuesto base de la reforma'
--
-- SELECT agent_action_to_natural('unknown_agent', 'running');
-- expected: 'Estoy trabajando en el proyecto...' (fallback)
--
-- Smoke E2E: insertar una agent_execution y comprobar que aparece en activity_log.
-- INSERT INTO agent_executions (project_id, agent_name, status) VALUES ('<project_id>', 'agent_costs', 'running');
-- SELECT * FROM activity_log WHERE execution_id = '<...>' ORDER BY created_at DESC;
-- expected: 1 fila con action = 'Estoy calculando el presupuesto del proyecto...' y message_type = 'action'.

-- ============================================================
-- Rollback
-- ============================================================
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_agent_exec_update_log ON agent_executions;
-- DROP TRIGGER IF EXISTS trg_agent_exec_insert_log ON agent_executions;
-- DROP FUNCTION IF EXISTS trg_agent_executions_log_to_activity();
-- DROP FUNCTION IF EXISTS agent_action_to_natural(text, text);
-- DELETE FROM applied_migrations WHERE filename = '089_agent_executions_natural_log_trigger.sql';
-- COMMIT;
