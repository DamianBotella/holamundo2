-- Migration 010: agent_permit_tracker (gestión de licencias y trámites municipales)
-- Fecha: 2026-04-25
--
-- Objetivo: tracking de expedientes administrativos (licencias municipales,
-- comunicaciones previas, cédulas urbanísticas, primera ocupación) con
-- recordatorios automáticos para que ningún requerimiento quede sin ver.
--
-- Estrategia MVP: panel + recordatorios (70 % del valor). El scraping de
-- sedes municipales se añade en una fase posterior cuando Damián documente
-- las sedes que usa habitualmente.

-- ============================================================
-- 1) Tabla principal de expedientes
-- ============================================================
CREATE TABLE IF NOT EXISTS permit_applications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  regulatory_task_id uuid REFERENCES regulatory_tasks(id) ON DELETE SET NULL,
  entity          text NOT NULL,
  application_type text NOT NULL CHECK (application_type IN (
    'licencia_obra_mayor','licencia_obra_menor','comunicacion_previa',
    'declaracion_responsable','licencia_actividad','primera_ocupacion',
    'cambio_uso','cedula_urbanistica','autorizacion_autonomica','otro'
  )),
  expediente_id   text,
  status          text NOT NULL DEFAULT 'preparing' CHECK (status IN (
    'preparing','submitted','requires_subsanation','in_review',
    'approved','rejected','withdrawn','expired'
  )),
  submitted_at    timestamptz,
  expected_response_days integer DEFAULT 30,
  status_url      text,
  last_checked_at timestamptz,
  resolved_at     timestamptz,
  notes           text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permit_app_project       ON permit_applications (project_id);
CREATE INDEX IF NOT EXISTS idx_permit_app_status        ON permit_applications (status)
  WHERE status NOT IN ('approved','rejected','withdrawn','expired');
CREATE INDEX IF NOT EXISTS idx_permit_app_lastchecked   ON permit_applications (last_checked_at);

-- ============================================================
-- 2) Histórico de cambios de estado (auditoría)
-- ============================================================
CREATE TABLE IF NOT EXISTS permit_status_history (
  id          bigserial PRIMARY KEY,
  permit_id   uuid NOT NULL REFERENCES permit_applications(id) ON DELETE CASCADE,
  old_status  text,
  new_status  text NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  text DEFAULT 'system',
  notes       text
);

-- ============================================================
-- 3) Trigger: registra cambio de estado + auto-resolved_at
-- ============================================================
CREATE OR REPLACE FUNCTION track_permit_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $body$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO permit_status_history (permit_id, old_status, new_status, changed_at)
    VALUES (NEW.id, OLD.status, NEW.status, now());
  END IF;
  NEW.updated_at := now();
  IF NEW.status IN ('approved','rejected','withdrawn','expired') AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS permit_app_status_trg ON permit_applications;
CREATE TRIGGER permit_app_status_trg
  BEFORE UPDATE ON permit_applications
  FOR EACH ROW EXECUTE FUNCTION track_permit_status_change();

-- ============================================================
-- 4) Hook regulatory_tasks → permit_applications
-- ============================================================
-- Cuando agent_regulatory confirma una task con task_type que requiere
-- expediente municipal, se crea automáticamente la fila en permit_applications.
-- Mapeo:
--   licencia_obra            → licencia_obra_mayor (default conservador)
--   comunicacion_previa      → comunicacion_previa
--   cedula_urbanistica       → cedula_urbanistica
--   certificado_habitabilidad→ primera_ocupacion
-- Otros task_type no generan expediente.

CREATE OR REPLACE FUNCTION auto_register_permit()
RETURNS trigger
LANGUAGE plpgsql
AS $body$
DECLARE
  v_permit_type text;
BEGIN
  IF NEW.exec_status IS DISTINCT FROM 'confirmed' THEN RETURN NEW; END IF;

  v_permit_type := CASE NEW.task_type
    WHEN 'licencia_obra'              THEN 'licencia_obra_mayor'
    WHEN 'comunicacion_previa'        THEN 'comunicacion_previa'
    WHEN 'cedula_urbanistica'         THEN 'cedula_urbanistica'
    WHEN 'certificado_habitabilidad'  THEN 'primera_ocupacion'
    ELSE NULL
  END;

  IF v_permit_type IS NULL THEN RETURN NEW; END IF;

  -- Idempotente: si ya existe un permit ligado a esta task, no duplicar
  IF EXISTS (SELECT 1 FROM permit_applications WHERE regulatory_task_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO permit_applications (
    project_id, regulatory_task_id, entity, application_type,
    status, expected_response_days, notes
  ) VALUES (
    NEW.project_id,
    NEW.id,
    COALESCE(NEW.entity, 'Por determinar'),
    v_permit_type,
    'preparing',
    30,
    'Auto-registrado desde regulatory_task ' || NEW.id || E'\nDescripcion: ' || COALESCE(LEFT(NEW.description, 200), '')
  );

  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS regulatory_task_to_permit_trg ON regulatory_tasks;
CREATE TRIGGER regulatory_task_to_permit_trg
  AFTER INSERT OR UPDATE OF exec_status ON regulatory_tasks
  FOR EACH ROW EXECUTE FUNCTION auto_register_permit();

-- ============================================================
-- 5) Backfill de regulatory_tasks confirmados existentes
-- ============================================================
INSERT INTO permit_applications (project_id, regulatory_task_id, entity, application_type, status, expected_response_days, notes)
SELECT
  rt.project_id,
  rt.id,
  COALESCE(rt.entity, 'Por determinar'),
  CASE rt.task_type
    WHEN 'licencia_obra'              THEN 'licencia_obra_mayor'
    WHEN 'comunicacion_previa'        THEN 'comunicacion_previa'
    WHEN 'cedula_urbanistica'         THEN 'cedula_urbanistica'
    WHEN 'certificado_habitabilidad'  THEN 'primera_ocupacion'
  END,
  'preparing',
  30,
  'Backfill 2026-04-25 desde regulatory_task ' || rt.id
FROM regulatory_tasks rt
WHERE rt.exec_status = 'confirmed'
  AND rt.task_type IN ('licencia_obra','comunicacion_previa','cedula_urbanistica','certificado_habitabilidad')
  AND NOT EXISTS (SELECT 1 FROM permit_applications pa WHERE pa.regulatory_task_id = rt.id);

-- ============================================================
-- Verificación post-migración
-- ============================================================
-- SELECT count(*) FROM pg_trigger WHERE tgname IN ('permit_app_status_trg','regulatory_task_to_permit_trg'); -- 2
-- SELECT count(*) FROM permit_applications;
