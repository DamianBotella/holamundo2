-- 057: Actualiza display_name de agents_catalog para tematica arquitectura tecnica
-- Spec: X7_CAMBIO_TEMATICA_VISUAL.pdf seccion 2
-- Solo toca display_name (lo que ve el usuario en la UI).
-- agent_name (identificador tecnico) NO se modifica.
-- Convencion: sin acentos (consistente con resto del seed).

BEGIN;

-- Tier 2 — operativos
UPDATE agents_catalog SET display_name = 'Dibujante Tecnico'      WHERE agent_name = 'agent_sketch_to_scale';
UPDATE agents_catalog SET display_name = 'Actualizador Normativa' WHERE agent_name = 'agent_normativa_refresh';
UPDATE agents_catalog SET display_name = 'Comercial'              WHERE agent_name = 'agent_proposal';
UPDATE agents_catalog SET display_name = 'Coordinador Externo'    WHERE agent_name = 'agent_collab_coordinator';
UPDATE agents_catalog SET display_name = 'Inspector de Obra'      WHERE agent_name = 'agent_site_monitor';
UPDATE agents_catalog SET display_name = 'Inspector Calidad'      WHERE agent_name = 'agent_qc_checklists';
UPDATE agents_catalog SET display_name = 'Comunicador Gremios'    WHERE agent_name = 'agent_trade_comms';
UPDATE agents_catalog SET display_name = 'Jefe de Materiales'     WHERE agent_name = 'agent_materials';
UPDATE agents_catalog SET display_name = 'Especialista Domotica'  WHERE agent_name = 'agent_home_automation';
UPDATE agents_catalog SET display_name = 'Tecnico Energetico'     WHERE agent_name = 'agent_energy_assessor';
UPDATE agents_catalog SET display_name = 'Patologo'               WHERE agent_name = 'agent_pathology';
UPDATE agents_catalog SET display_name = 'Tecnico Subvenciones'   WHERE agent_name = 'agent_grants_finder';
UPDATE agents_catalog SET display_name = 'Tecnico Residuos'       WHERE agent_name = 'agent_rcd';
UPDATE agents_catalog SET display_name = 'Inspector IEE'          WHERE agent_name = 'agent_iee';

INSERT INTO applied_migrations (filename, notes) VALUES
  ('057_studio_display_names.sql', 'X7: display_name a tematica arquitectura tecnica (no militar)')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- Verificacion
SELECT agent_name, display_name FROM agents_catalog
WHERE agent_name IN (
  'agent_sketch_to_scale','agent_normativa_refresh','agent_proposal','agent_collab_coordinator',
  'agent_site_monitor','agent_qc_checklists','agent_trade_comms','agent_materials',
  'agent_home_automation','agent_energy_assessor','agent_pathology','agent_grants_finder',
  'agent_rcd','agent_iee'
)
ORDER BY agent_name;
