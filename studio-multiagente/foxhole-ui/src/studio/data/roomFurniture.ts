/**
 * Layout de mobiliario por habitacion (B72 — La Oficina Viva).
 *
 * Las coordenadas (x, y) son RELATIVAS al bounding_box de la room (igual
 * convencion que agents_catalog.default_position en migracion 056). El
 * componente StudioFurniture suma room.bounding_box.x + item.x al renderizar.
 *
 * Cada room mide 320x200 (excepto urgency_corridor que mide 960x160). Las
 * posiciones x van de 0..w, y de 0..h. Origen en la esquina superior-izquierda
 * del rombo (en world coords ortogonales antes de proyectar a iso).
 *
 * zIndex: orden de pintado dentro de la layer de mobiliario. Muebles altos
 * (estanterias, alarma, plantas tall) z mas alto para quedar tapados por nada
 * en su sala.
 *
 * Los room_id usados aqui son los reales de la migracion 056b_studio_layout_v7_fix.
 *
 * B72b: site_terrace incluye cafeteria (cafe machine + bar + taburetes) para
 * que sea zona de descanso de agentes idle (Paso 2). Ademas todas las salas
 * tienen plantas, lampara o cuadro decorativo para sentirse habitadas.
 */

export interface FurnitureItem {
  id: string;       // furniture_id correspondiente al PNG
  x: number;        // offset horizontal dentro de la room
  y: number;        // offset vertical dentro de la room
  zIndex: number;   // z-order dentro de la layer furniture
}

export const ROOM_FURNITURE: Record<string, FurnitureItem[]> = {
  // RECEPCION (320x200)
  reception: [
    { id: 'furniture_reception_desk',         x: 160, y: 100, zIndex: 10 },
    { id: 'furniture_reception_chair',        x:  80, y: 140, zIndex:  5 },
    { id: 'furniture_reception_plant',        x: 250, y:  50, zIndex:  8 },
    { id: 'furniture_corner_plant_tall',      x:  40, y:  40, zIndex: 15 },
    { id: 'furniture_wall_artframe_blueprint',x: 230, y:  30, zIndex: 18 },
    { id: 'furniture_office_clock',           x: 160, y:  20, zIndex: 18 },
  ],

  // MESA DE DIBUJO (320x200)
  drawing_room: [
    { id: 'furniture_drafting_table',  x: 140, y: 100, zIndex: 10 },
    { id: 'furniture_drafting_lamp',   x: 180, y:  70, zIndex: 12 },
    { id: 'furniture_blueprint_roll',  x: 240, y: 150, zIndex:  5 },
    { id: 'furniture_small_plant',     x:  60, y:  60, zIndex:  8 },
    { id: 'furniture_filing_papers_pile', x: 60, y: 160, zIndex: 6 },
  ],

  // BIBLIOTECA NORMATIVA (320x200)
  normative_library: [
    { id: 'furniture_bookshelf_tall',    x:  60, y:  60, zIndex: 15 },
    { id: 'furniture_bookshelf_small',   x: 250, y:  90, zIndex: 12 },
    { id: 'furniture_reading_desk',      x: 160, y: 140, zIndex:  8 },
    { id: 'furniture_floor_lamp',        x: 220, y: 140, zIndex: 12 },
    { id: 'furniture_corner_plant_tall', x: 280, y:  40, zIndex: 15 },
  ],

  // DESPACHO CONTABLE (320x200)
  accounting_office: [
    { id: 'furniture_office_desk',     x: 160, y: 110, zIndex: 10 },
    { id: 'furniture_filing_cabinet',  x:  60, y:  80, zIndex: 12 },
    { id: 'furniture_desk_chair',      x: 160, y: 150, zIndex:  6 },
    { id: 'furniture_small_plant',     x: 270, y:  60, zIndex:  8 },
    { id: 'furniture_office_clock',    x: 160, y:  20, zIndex: 18 },
    { id: 'furniture_recycling_bin',   x: 270, y: 160, zIndex:  6 },
    { id: 'furniture_filing_papers_pile', x: 240, y: 130, zIndex: 5 },
  ],

  // DIRECCION - ORQUESTADOR (320x200)
  main_office: [
    { id: 'furniture_director_desk',          x: 160, y:  90, zIndex: 10 },
    { id: 'furniture_meeting_chairs_2',       x: 160, y: 160, zIndex:  6 },
    { id: 'furniture_bookcase_director',      x:  60, y:  60, zIndex: 15 },
    { id: 'furniture_floor_lamp',             x: 270, y: 130, zIndex: 12 },
    { id: 'furniture_wall_artframe_blueprint',x: 230, y:  30, zIndex: 18 },
    { id: 'furniture_corner_plant_tall',      x:  40, y: 160, zIndex: 15 },
    { id: 'furniture_office_clock',           x: 160, y:  20, zIndex: 18 },
  ],

  // SALA DE REUNIONES (320x200)
  meeting_room: [
    { id: 'furniture_conference_table',       x: 160, y: 110, zIndex: 10 },
    { id: 'furniture_whiteboard',             x:  60, y:  50, zIndex: 15 },
    { id: 'furniture_conference_chair',       x: 110, y:  90, zIndex:  6 },
    { id: 'furniture_conference_chair',       x: 210, y:  90, zIndex:  6 },
    { id: 'furniture_conference_chair',       x: 110, y: 130, zIndex:  6 },
    { id: 'furniture_conference_chair',       x: 210, y: 130, zIndex:  6 },
    { id: 'furniture_floor_lamp',             x: 280, y:  60, zIndex: 12 },
    { id: 'furniture_wall_artframe_blueprint',x: 250, y:  30, zIndex: 18 },
  ],

  // TERRAZA - INSPECCION + CAFETERIA (320x200)
  // B72b: zona de descanso para agentes idle. El cafe a la derecha; mesas
  // de cafeteria al sur; sillas tipo terraza alrededor de mesa pequena.
  site_terrace: [
    // Inspeccion (zona izquierda)
    { id: 'furniture_terrace_table',  x:  90, y: 110, zIndex:  8 },
    { id: 'furniture_terrace_chair',  x:  50, y: 140, zIndex:  6 },
    { id: 'furniture_terrace_chair',  x: 130, y: 140, zIndex:  6 },
    { id: 'furniture_potted_cactus',  x:  40, y:  40, zIndex: 10 },
    // Cafeteria (zona derecha)
    { id: 'furniture_coffee_bar',     x: 240, y:  90, zIndex: 10 },
    { id: 'furniture_coffee_machine', x: 270, y:  60, zIndex: 14 },
    { id: 'furniture_bar_stool',      x: 210, y: 130, zIndex:  6 },
    { id: 'furniture_bar_stool',      x: 240, y: 140, zIndex:  6 },
    { id: 'furniture_bar_stool',      x: 270, y: 130, zIndex:  6 },
    { id: 'furniture_small_plant',    x: 200, y:  50, zIndex:  8 },
  ],

  // TALLER GREMIOS (320x200)
  trades_workshop: [
    { id: 'furniture_workbench',      x: 130, y: 100, zIndex: 10 },
    { id: 'furniture_tool_rack',      x: 240, y:  60, zIndex: 12 },
    { id: 'furniture_plans_table',    x: 160, y: 160, zIndex:  8 },
    { id: 'furniture_small_plant',    x:  60, y:  50, zIndex:  8 },
    { id: 'furniture_recycling_bin',  x: 280, y: 160, zIndex:  6 },
  ],

  // ARCHIVO (320x200)
  archive: [
    { id: 'furniture_archive_shelf',      x:  70, y:  70, zIndex: 15 },
    { id: 'furniture_archive_cabinet',    x: 220, y:  90, zIndex: 12 },
    { id: 'furniture_ladder_shelf',       x:  70, y:  40, zIndex: 18 },
    { id: 'furniture_small_plant',        x: 270, y: 150, zIndex:  8 },
    { id: 'furniture_filing_papers_pile', x: 160, y: 170, zIndex:  6 },
    { id: 'furniture_recycling_bin',      x:  40, y: 160, zIndex:  6 },
  ],

  // CORREDOR DE URGENCIAS (960x160 — mas ancho que alto)
  urgency_corridor: [
    { id: 'furniture_alarm_light',     x: 480, y:  30, zIndex: 20 },
    { id: 'furniture_monitor_stand',   x: 240, y:  70, zIndex: 15 },
    { id: 'furniture_monitor_stand',   x: 720, y:  70, zIndex: 15 },
    { id: 'furniture_water_dispenser', x: 100, y: 100, zIndex: 12 },
    { id: 'furniture_water_dispenser', x: 860, y: 100, zIndex: 12 },
  ],
};
