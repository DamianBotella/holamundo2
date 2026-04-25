-- Migration 020: hook qc_recepcion_provisional COMPLETE -> projects.handover_date
-- Fecha: 2026-04-26
--
-- Cuando una checklist de fase 'recepcion_provisional' pasa a status 'complete'
-- (todos los items pass o skip, ninguno fail/pending), se establece automaticamente
-- projects.handover_date = COALESCE(qc.completed_at, now()). Solo si projects.handover_date
-- aun era NULL (no pisa una fecha ya establecida).
--
-- Esto cierra el silo entre QC y aftercare:
--   - aftercare_submit calcula days_since_handover y under_warranty (LOE 1/3/10 anios)
--     usando projects.handover_date.
--   - Sin este hook, el arquitecto tenia que actualizar handover_date manualmente
--     tras cerrar la recepcion.
--
-- IMPORTANTE: el trigger no usa "AFTER UPDATE OF status" porque el cambio de status
-- lo hace el trigger touch_qc_checks (BEFORE), no el SET clause del UPDATE original.
-- AFTER UPDATE OF status mira el SET clause, no el cambio efectivo en NEW.status.
-- Por eso el trigger es AFTER INSERT OR UPDATE generico, con guardas internas.

CREATE OR REPLACE FUNCTION qc_set_handover_date()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
  IF NEW.phase_key = 'recepcion_provisional'
     AND NEW.status = 'complete'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'complete') THEN
    UPDATE projects
       SET handover_date = COALESCE(handover_date, COALESCE(NEW.completed_at, now())::date)
     WHERE id = NEW.project_id
       AND handover_date IS NULL;
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS qc_set_handover_date_trg ON qc_checks;
CREATE TRIGGER qc_set_handover_date_trg
  AFTER INSERT OR UPDATE ON qc_checks
  FOR EACH ROW EXECUTE FUNCTION qc_set_handover_date();

-- ============================================================
-- Verificacion E2E (2026-04-26)
-- ============================================================
-- Proyecto sin handover_date previo:
-- POST /webhook/qc-generate {project_id, phase_key='recepcion_provisional'}
-- POST /webhook/qc-complete x5 con status='pass' para los 5 items rp1-rp5
--   -> trigger touch pone qc.status='complete' y completed_at=now()
--   -> trigger qc_set_handover_date dispara
--   -> projects.handover_date = '2026-04-25' (fecha del completed_at)
