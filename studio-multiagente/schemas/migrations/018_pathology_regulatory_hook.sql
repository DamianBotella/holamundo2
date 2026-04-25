-- Migration 018b: hook pathology_findings -> regulatory_tasks
-- Fecha: 2026-04-25
--
-- Cuando agent_pathology detecta una patologia con severity medium/high/critical,
-- el trigger BEFORE INSERT crea automaticamente un regulatory_task asociado al
-- gremio/entidad que debe intervenir (laboratorio, autoridad laboral, estructurista,
-- etc.). Idempotente por (project_id, title) para no duplicar si se reinserta
-- la misma patologia.
--
-- Mapeo:
--   aluminosis            -> Laboratorio acreditado (critico)
--   amianto_sospechoso    -> Autoridad laboral RD 396/2006 (critico)
--   plomo_sospechoso      -> Sanidad autonomica (importante)
--   radon_sospechoso      -> Empresa CSN, CTE DB-HS6 (recomendable)
--   fisura_estructural,
--   asentamiento,
--   oxidacion_armadura,
--   carbonatacion         -> Estructurista colegiado (critico si severity=critical, sino importante)
--   termitas, xilofagos   -> Empresa DDD autorizada (importante)
--
-- Severity 'low' o tipos no listados: el trigger no genera tarea.

CREATE OR REPLACE FUNCTION pathology_to_regulatory()
RETURNS trigger LANGUAGE plpgsql AS $body$
DECLARE
  v_task_type text;
  v_title     text;
  v_entity    text;
  v_priority  text;
BEGIN
  IF NEW.severity NOT IN ('medium','high','critical') THEN
    RETURN NEW;
  END IF;

  CASE NEW.pathology_type
    WHEN 'aluminosis' THEN
      v_task_type := 'informe_tecnico';
      v_title     := 'Analisis de aluminosis en laboratorio acreditado';
      v_entity    := 'Laboratorio de ensayos acreditado';
      v_priority  := 'critico';
    WHEN 'amianto_sospechoso' THEN
      v_task_type := 'otro';
      v_title     := 'Notificacion amianto + plan de retirada (RD 396/2006)';
      v_entity    := 'Autoridad laboral autonomica';
      v_priority  := 'critico';
    WHEN 'plomo_sospechoso' THEN
      v_task_type := 'otro';
      v_title     := 'Analisis de plomo en agua + plan de sustitucion';
      v_entity    := 'Sanidad autonomica';
      v_priority  := 'importante';
    WHEN 'radon_sospechoso' THEN
      v_task_type := 'informe_tecnico';
      v_title     := 'Medicion de radon (CTE DB-HS6)';
      v_entity    := 'Empresa autorizada CSN';
      v_priority  := 'recomendable';
    WHEN 'fisura_estructural', 'asentamiento', 'oxidacion_armadura', 'carbonatacion' THEN
      v_task_type := 'informe_tecnico';
      v_title     := 'Informe tecnico estructural por patologia detectada';
      v_entity    := 'Estructurista colegiado';
      v_priority  := CASE NEW.severity WHEN 'critical' THEN 'critico' ELSE 'importante' END;
    WHEN 'termitas','xilofagos' THEN
      v_task_type := 'informe_tecnico';
      v_title     := 'Tratamiento de plagas en madera + certificado';
      v_entity    := 'Empresa tratamientos DDD autorizada';
      v_priority  := 'importante';
    ELSE
      RETURN NEW;
  END CASE;

  -- Idempotencia: no duplicar si ya existe una tarea con el mismo titulo
  -- (excluyendo not_required, para que se pueda re-emitir si fue descartada)
  IF EXISTS (
    SELECT 1 FROM regulatory_tasks
     WHERE project_id = NEW.project_id
       AND title = v_title
       AND status NOT IN ('not_required')
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO regulatory_tasks (
    project_id, task_type, title, description, entity, priority, status, notes
  ) VALUES (
    NEW.project_id,
    v_task_type,
    v_title,
    'Generado automaticamente por agent_pathology al detectar ' || NEW.pathology_type ||
    ' (severity ' || NEW.severity || ').' ||
    CASE WHEN NEW.recommended_action IS NOT NULL THEN E'\n\nAccion recomendada: ' || NEW.recommended_action ELSE '' END ||
    CASE WHEN NEW.location_in_property IS NOT NULL THEN E'\nUbicacion: ' || NEW.location_in_property ELSE '' END,
    v_entity,
    v_priority,
    'detected',
    'pathology_finding_id: ' || NEW.id::text
  );

  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS pathology_to_regulatory_trg ON pathology_findings;
CREATE TRIGGER pathology_to_regulatory_trg
  BEFORE INSERT OR UPDATE OF severity, pathology_type ON pathology_findings
  FOR EACH ROW EXECUTE FUNCTION pathology_to_regulatory();

-- ============================================================
-- Verificacion E2E (2026-04-25)
-- ============================================================
-- INSERT INTO pathology_findings (project_id, photo_urls, pathology_type, severity, description)
-- VALUES ('<project_uuid>', ARRAY['url'], 'aluminosis', 'high', 'test');
--   -> Crea regulatory_tasks con title='Analisis de aluminosis en laboratorio acreditado',
--      priority='critico', entity='Laboratorio de ensayos acreditado',
--      task_type='informe_tecnico', status='detected'
