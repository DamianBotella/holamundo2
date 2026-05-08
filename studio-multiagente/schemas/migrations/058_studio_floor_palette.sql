-- 058: Paleta calida de suelos para tematica arquitectura tecnica
-- Spec: X7_CAMBIO_TEMATICA_VISUAL.pdf seccion 3 (paleta de suelos)
-- Sustituye los grises/marrones militares por tonos calidos de oficina.

BEGIN;

-- Diseno (papel/luz natural): recepcion + mesa de dibujo
UPDATE studio_rooms SET floor_color = '#E8E4D8' WHERE room_id IN ('reception', 'drawing_room');

-- Biblioteca tecnica (madera clara): normativa + archivo
UPDATE studio_rooms SET floor_color = '#D4C9B0' WHERE room_id IN ('normative_library', 'archive');

-- Oficina formal (gris azulado): contabilidad + direccion
UPDATE studio_rooms SET floor_color = '#C8D4DC' WHERE room_id IN ('accounting_office', 'main_office');

-- Sala de reuniones (beige neutro)
UPDATE studio_rooms SET floor_color = '#D8D0C4' WHERE room_id = 'meeting_room';

-- Terraza (verde tenue, exterior)
UPDATE studio_rooms SET floor_color = '#B8C4A8' WHERE room_id = 'site_terrace';

-- Taller (gris industrial)
UPDATE studio_rooms SET floor_color = '#C4C0B8' WHERE room_id = 'trades_workshop';

-- Corredor urgencias (terracota tenue)
UPDATE studio_rooms SET floor_color = '#C4B4A8' WHERE room_id = 'urgency_corridor';

INSERT INTO applied_migrations (filename, notes) VALUES
  ('058_studio_floor_palette.sql', 'X7: paleta calida de suelos (oficina arquitectura)')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- Verificacion
SELECT room_id, display_name, floor_color FROM studio_rooms ORDER BY display_order;
