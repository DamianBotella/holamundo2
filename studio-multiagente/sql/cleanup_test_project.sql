-- Cleanup script: proyecto de test 5c230fc9-be45-4566-ac21-76436857b94b
-- Fecha del script: 2026-04-26 (bloque 12, A6 del plan Fase A)
--
-- Este archivo NO es una migración. Es un script puntual para borrar el
-- proyecto de test que se uso durante el debug de agent_briefing en abril 2026
-- (ver studio-multiagente/docs/fase_a_audit.md, sección A6).
--
-- Eliminar TODAS las filas dependientes antes que la fila padre (projects).
-- Cualquier tabla con ON DELETE CASCADE no necesita el DELETE explícito,
-- pero los DELETE estan abajo de todas formas para hacer el script idempotente
-- aunque cambie la política de FK.
--
-- Ejecución recomendada en Supabase:
--   1. SELECT * FROM projects WHERE id = '5c230fc9-be45-4566-ac21-76436857b94b';
--      → Si devuelve 0 filas, no hay nada que limpiar (ya esta hecho).
--   2. BEGIN;  -- abrir transacción para revisar antes de COMMIT
--      <pegar bloque DELETE de abajo>
--      <revisar contadores>
--      COMMIT;
--   3. Confirmar: SELECT * FROM projects WHERE id = '5c230fc9-...';  -- 0 filas
--
-- Si alguna FK no existe en tu version del schema (ej. por skip de migration),
-- el DELETE simplemente fallará con relation does not exist; ignorar y seguir.

DO $$
DECLARE
  v_project_id uuid := '5c230fc9-be45-4566-ac21-76436857b94b';
  v_count int;
BEGIN
  -- Contar antes
  SELECT count(*) INTO v_count FROM projects WHERE id = v_project_id;
  IF v_count = 0 THEN
    RAISE NOTICE 'Project % no existe — no hay nada que limpiar.', v_project_id;
    RETURN;
  END IF;

  RAISE NOTICE 'Iniciando limpieza del proyecto de test %', v_project_id;

  -- Tablas dependientes (orden seguro para FK aunque no haya CASCADE):
  DELETE FROM activity_log         WHERE project_id = v_project_id;
  DELETE FROM approvals            WHERE project_id = v_project_id;
  DELETE FROM agent_executions     WHERE project_id = v_project_id;
  DELETE FROM project_intelligence WHERE project_id = v_project_id;
  DELETE FROM project_notes        WHERE project_id = v_project_id;
  DELETE FROM project_documents    WHERE project_id = v_project_id;
  DELETE FROM material_items       WHERE project_id = v_project_id;
  DELETE FROM cost_estimates       WHERE project_id = v_project_id;
  DELETE FROM trade_requests       WHERE project_id = v_project_id;
  DELETE FROM regulatory_tasks     WHERE project_id = v_project_id;
  DELETE FROM design_options       WHERE project_id = v_project_id;
  DELETE FROM briefings            WHERE project_id = v_project_id;
  DELETE FROM project_plans        WHERE project_id = v_project_id;
  DELETE FROM site_reports         WHERE project_id = v_project_id;
  DELETE FROM pathology_findings   WHERE project_id = v_project_id;
  DELETE FROM accessibility_audits WHERE project_id = v_project_id;
  DELETE FROM safety_plans         WHERE project_id = v_project_id;
  DELETE FROM permits              WHERE project_id = v_project_id;
  DELETE FROM certifications       WHERE project_id = v_project_id;
  DELETE FROM invoices             WHERE project_id = v_project_id;
  DELETE FROM aftercare_issues     WHERE project_id = v_project_id;
  DELETE FROM contracts            WHERE project_id = v_project_id;
  DELETE FROM client_tokens        WHERE project_id = v_project_id;
  DELETE FROM client_conversations WHERE project_id = v_project_id;
  DELETE FROM consultation_queue   WHERE project_id = v_project_id;
  DELETE FROM gdpr_requests        WHERE project_id = v_project_id;
  DELETE FROM qc_checklists        WHERE project_id = v_project_id;
  DELETE FROM energy_assessments   WHERE project_id = v_project_id;
  DELETE FROM home_automation_specs WHERE project_id = v_project_id;
  DELETE FROM project_collaborators WHERE project_id = v_project_id;
  DELETE FROM anomalies            WHERE project_id = v_project_id;
  DELETE FROM trade_quotes         WHERE project_id = v_project_id;
  DELETE FROM permit_status_history WHERE project_id = v_project_id;

  -- llm_calls usa ON DELETE SET NULL (preserva metricas historicas):
  -- no borramos, pero project_id quedará NULL al borrar projects.

  -- Memory case: si quedo creado con este project_id, NO lo borramos
  -- (las lecciones extraidas valen aunque el proyecto desaparezca).

  -- Finalmente la fila padre:
  DELETE FROM projects WHERE id = v_project_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Eliminado proyecto. Filas borradas en projects: %', v_count;
END $$;

-- Verificación post-cleanup:
SELECT 'projects'         AS tabla, count(*) FROM projects         WHERE id         = '5c230fc9-be45-4566-ac21-76436857b94b'
UNION ALL SELECT 'activity_log',     count(*) FROM activity_log     WHERE project_id = '5c230fc9-be45-4566-ac21-76436857b94b'
UNION ALL SELECT 'briefings',        count(*) FROM briefings        WHERE project_id = '5c230fc9-be45-4566-ac21-76436857b94b'
UNION ALL SELECT 'agent_executions', count(*) FROM agent_executions WHERE project_id = '5c230fc9-be45-4566-ac21-76436857b94b'
UNION ALL SELECT 'design_options',   count(*) FROM design_options   WHERE project_id = '5c230fc9-be45-4566-ac21-76436857b94b';
-- Resultado esperado: todos los counts = 0.
