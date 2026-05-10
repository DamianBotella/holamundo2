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
 * zIndex: orden de pintado dentro de la layer de mobiliario.
 *   - 0-5  -> elementos en suelo (alfombras)
 *   - 6-10 -> mobiliario bajo (sillas, mesas)
 *   - 11-15-> mobiliario alto (estanterias, cabinets)
 *   - 16-20-> elementos en pared (cuadros, relojes, alarmas)
 *
 * B72d: cada sala tiene 10-15 elementos distribuidos para sentirse habitada
 * (densidad referencia imagen DEVSOFT). Evitamos solapar con default_position
 * de los agentes (~x=80-220, y=80-150 segun sala).
 */

export interface FurnitureItem {
  id: string;       // furniture_id correspondiente al PNG
  x: number;        // offset horizontal dentro de la room
  y: number;        // offset vertical dentro de la room
  zIndex: number;   // z-order dentro de la layer furniture
}

export const ROOM_FURNITURE: Record<string, FurnitureItem[]> = {
  // ===========================================================
  // RECEPCION (320x200) - entrada del estudio
  // Agentes aqui: Recepcionista (80,100), Asesor de Cliente (220,100)
  // ===========================================================
  reception: [
    // Suelo: alfombra de bienvenida
    { id: 'furniture_carpet_rect_persian',     x: 160, y: 165, zIndex:  2 },
    // Mostrador y atencion
    { id: 'furniture_reception_desk',          x: 160, y:  90, zIndex: 10 },
    { id: 'furniture_reception_chair',         x:  60, y: 130, zIndex:  6 },
    { id: 'furniture_books_stacked_horizontal',x: 170, y:  85, zIndex: 12 }, // sobre mostrador
    // Sala de espera (zona derecha)
    { id: 'furniture_lounge_sofa',             x: 270, y: 130, zIndex:  8 },
    { id: 'furniture_small_plant',             x: 290, y:  90, zIndex:  8 },
    // Plantas decorativas
    { id: 'furniture_reception_plant',         x:  40, y:  60, zIndex:  8 },
    { id: 'furniture_corner_plant_tall',       x: 290, y:  40, zIndex: 15 },
    // Pared
    { id: 'furniture_wall_artframe_blueprint', x: 100, y:  20, zIndex: 18 },
    { id: 'furniture_painting_landscape',      x: 220, y:  20, zIndex: 18 },
    { id: 'furniture_office_clock',            x: 160, y:  15, zIndex: 18 },
  ],

  // ===========================================================
  // MESA DE DIBUJO (drawing_room, 320x200) - donde se dibujan planos
  // Agentes aqui: Delineante (80,100), Dibujante Tecnico (220,100)
  // ===========================================================
  drawing_room: [
    // Suelo
    { id: 'furniture_carpet_round_warm',       x: 160, y: 110, zIndex:  2 },
    // Mesa principal con todo lo de un drafter
    { id: 'furniture_drafting_table',          x: 150, y:  90, zIndex: 10 },
    { id: 'furniture_drafting_lamp',           x: 175, y:  60, zIndex: 14 },
    { id: 'furniture_pencil_holder',           x: 130, y:  85, zIndex: 12 },
    { id: 'furniture_books_stacked_horizontal',x: 180, y:  95, zIndex: 12 },
    // Materiales y elementos auxiliares
    { id: 'furniture_blueprint_roll',          x:  50, y: 160, zIndex:  5 },
    { id: 'furniture_blueprint_roll',          x: 270, y: 160, zIndex:  5 },
    { id: 'furniture_filing_papers_pile',      x:  60, y:  80, zIndex:  6 },
    // Mesa secundaria (referencia)
    { id: 'furniture_reading_desk',            x: 270, y:  90, zIndex:  8 },
    { id: 'furniture_table_lamp_small',        x: 280, y:  70, zIndex: 12 },
    // Plantas y decoracion
    { id: 'furniture_small_plant',             x:  40, y:  50, zIndex:  8 },
    { id: 'furniture_painting_landscape',      x: 160, y:  20, zIndex: 18 },
    { id: 'furniture_plant_hanging_wall',      x: 280, y:  25, zIndex: 18 },
  ],

  // ===========================================================
  // BIBLIOTECA NORMATIVA (320x200) - CTE, normativas, regulaciones
  // Agentes aqui: Tecnico Normativa (80,100), Actualizador Normativa (220,100)
  // ===========================================================
  normative_library: [
    // Suelo
    { id: 'furniture_carpet_rect_persian',     x: 160, y: 140, zIndex:  2 },
    // Estanterias (back wall)
    { id: 'furniture_bookshelf_tall',          x:  50, y:  50, zIndex: 15 },
    { id: 'furniture_bookshelf_small',         x: 270, y:  60, zIndex: 12 },
    { id: 'furniture_bookshelf_tall',          x: 270, y: 110, zIndex: 15 },
    // Mesa de lectura
    { id: 'furniture_reading_desk',            x: 160, y: 140, zIndex:  8 },
    { id: 'furniture_table_lamp_small',        x: 175, y: 125, zIndex: 12 },
    { id: 'furniture_books_stacked_horizontal',x: 145, y: 135, zIndex: 12 },
    // Libros sueltos (ambiente caotico de biblioteca activa)
    { id: 'furniture_books_stacked_horizontal',x: 100, y: 170, zIndex:  6 },
    { id: 'furniture_books_stacked_horizontal',x: 220, y: 170, zIndex:  6 },
    // Iluminacion y decoracion
    { id: 'furniture_floor_lamp',              x: 220, y: 130, zIndex: 12 },
    { id: 'furniture_corner_plant_tall',       x: 290, y:  25, zIndex: 15 },
    { id: 'furniture_painting_landscape',      x: 160, y:  20, zIndex: 18 },
  ],

  // ===========================================================
  // DESPACHO CONTABLE (accounting_office, 320x200)
  // Agentes aqui: Contable, Tracker Financiero, Auditor
  // ===========================================================
  accounting_office: [
    // Suelo
    { id: 'furniture_carpet_round_warm',       x: 160, y: 110, zIndex:  2 },
    // Mesa principal con setup completo de oficinista
    { id: 'furniture_office_desk',             x: 160, y: 100, zIndex: 10 },
    { id: 'furniture_monitor_on_desk',         x: 160, y:  85, zIndex: 14 },
    { id: 'furniture_keyboard_mouse_set',      x: 160, y: 105, zIndex: 12 },
    { id: 'furniture_coffee_cup',              x: 195, y:  95, zIndex: 12 },
    { id: 'furniture_pencil_holder',           x: 130, y:  90, zIndex: 12 },
    { id: 'furniture_desk_chair',              x: 160, y: 145, zIndex:  6 },
    // Archivos
    { id: 'furniture_filing_cabinet',          x:  50, y:  80, zIndex: 12 },
    { id: 'furniture_filing_papers_pile',      x:  50, y: 150, zIndex:  6 },
    { id: 'furniture_filing_papers_pile',      x: 250, y: 150, zIndex:  6 },
    // Detalles ambientales
    { id: 'furniture_recycling_bin',           x: 280, y: 160, zIndex:  6 },
    { id: 'furniture_small_plant',             x: 290, y:  60, zIndex:  8 },
    { id: 'furniture_office_clock',            x: 160, y:  15, zIndex: 18 },
    { id: 'furniture_painting_landscape',      x:  60, y:  20, zIndex: 18 },
  ],

  // ===========================================================
  // DIRECCION - ORQUESTADOR (main_office, 320x200) - el director
  // Agente aqui: Director (160,100)
  // ===========================================================
  main_office: [
    // Suelo: alfombra grande y elegante
    { id: 'furniture_carpet_rect_persian',     x: 160, y: 130, zIndex:  2 },
    // Mesa del director con todo
    { id: 'furniture_director_desk',           x: 160, y:  80, zIndex: 10 },
    { id: 'furniture_table_lamp_small',        x: 130, y:  65, zIndex: 14 },
    { id: 'furniture_pencil_holder',           x: 190, y:  70, zIndex: 12 },
    { id: 'furniture_books_stacked_horizontal',x: 195, y:  80, zIndex: 12 },
    // Sillas de visitas
    { id: 'furniture_meeting_chairs_2',        x: 160, y: 165, zIndex:  6 },
    // Estanteria de prestigio
    { id: 'furniture_bookcase_director',       x:  50, y:  50, zIndex: 15 },
    // Decoracion elegante
    { id: 'furniture_floor_lamp',              x: 285, y: 130, zIndex: 12 },
    { id: 'furniture_corner_plant_tall',       x: 290, y:  40, zIndex: 15 },
    { id: 'furniture_wall_artframe_blueprint', x: 220, y:  20, zIndex: 18 },
    { id: 'furniture_painting_landscape',      x: 100, y:  20, zIndex: 18 },
    { id: 'furniture_office_clock',            x: 160, y:  15, zIndex: 18 },
  ],

  // ===========================================================
  // SALA DE REUNIONES (320x200) - propuestas, contratos, aprobaciones
  // Agentes aqui: Comercial (80,100), Juridico (220,100), Coordinador (160, 160)
  // ===========================================================
  meeting_room: [
    // Suelo: alfombra circular bajo la mesa
    { id: 'furniture_carpet_round_warm',       x: 160, y: 110, zIndex:  2 },
    // Mesa central
    { id: 'furniture_conference_table',        x: 160, y: 100, zIndex: 10 },
    // Sillas alrededor
    { id: 'furniture_conference_chair',        x: 100, y:  75, zIndex:  6 },
    { id: 'furniture_conference_chair',        x: 220, y:  75, zIndex:  6 },
    { id: 'furniture_conference_chair',        x: 100, y: 145, zIndex:  6 },
    { id: 'furniture_conference_chair',        x: 220, y: 145, zIndex:  6 },
    { id: 'furniture_conference_chair',        x: 160, y:  60, zIndex:  6 },
    { id: 'furniture_conference_chair',        x: 160, y: 165, zIndex:  6 },
    // Cosas sobre la mesa (ambiente reunion)
    { id: 'furniture_coffee_cup',              x: 130, y:  95, zIndex: 12 },
    { id: 'furniture_coffee_cup',              x: 190, y: 105, zIndex: 12 },
    { id: 'furniture_pencil_holder',           x: 165, y:  95, zIndex: 12 },
    // Pared y decoracion
    { id: 'furniture_whiteboard',              x:  60, y:  30, zIndex: 15 },
    { id: 'furniture_floor_lamp',              x: 285, y: 130, zIndex: 12 },
    { id: 'furniture_painting_landscape',      x: 240, y:  25, zIndex: 18 },
    { id: 'furniture_wall_artframe_blueprint', x: 160, y:  15, zIndex: 18 },
  ],

  // ===========================================================
  // TERRAZA + CAFETERIA (site_terrace, 320x200) - descanso e inspeccion
  // Agentes aqui: Inspector de Obra (80,100), Inspector Calidad (220,100)
  // B72b: zona idle ampliada con cafeteria
  // ===========================================================
  site_terrace: [
    // Suelo: alfombra exterior bajo la zona lounge
    { id: 'furniture_carpet_round_warm',       x: 240, y: 110, zIndex:  2 },
    // Inspeccion (zona izquierda) - tipo terraza ver obra
    { id: 'furniture_terrace_table',           x:  90, y: 110, zIndex:  8 },
    { id: 'furniture_terrace_chair',           x:  50, y: 140, zIndex:  6 },
    { id: 'furniture_terrace_chair',           x: 130, y: 140, zIndex:  6 },
    { id: 'furniture_potted_cactus',           x:  40, y:  40, zIndex: 10 },
    // Cafeteria (zona derecha)
    { id: 'furniture_coffee_bar',              x: 250, y:  85, zIndex: 10 },
    { id: 'furniture_coffee_machine',          x: 280, y:  60, zIndex: 14 },
    { id: 'furniture_bar_stool',               x: 215, y: 130, zIndex:  6 },
    { id: 'furniture_bar_stool',               x: 250, y: 140, zIndex:  6 },
    { id: 'furniture_bar_stool',               x: 285, y: 130, zIndex:  6 },
    // Lounge sofa - los agentes idle "descansan" aqui
    { id: 'furniture_lounge_sofa',             x: 160, y: 165, zIndex:  8 },
    { id: 'furniture_books_stacked_horizontal',x: 100, y: 165, zIndex:  9 }, // sobre sofa
    { id: 'furniture_coffee_cup',              x: 195, y: 160, zIndex:  9 },
    // Plantas decorativas
    { id: 'furniture_small_plant',             x: 200, y:  50, zIndex:  8 },
    { id: 'furniture_corner_plant_tall',       x: 290, y:  20, zIndex: 15 },
  ],

  // ===========================================================
  // TALLER GREMIOS (trades_workshop, 320x200) - coordinacion gremios
  // Agentes aqui: Jefe de Obra, Jefe de Materiales, Comunicador, etc.
  // ===========================================================
  trades_workshop: [
    // Suelo
    { id: 'furniture_carpet_round_warm',       x: 130, y: 110, zIndex:  2 },
    // Banco de trabajo central
    { id: 'furniture_workbench',               x: 130, y:  90, zIndex: 10 },
    { id: 'furniture_table_lamp_small',        x: 110, y:  75, zIndex: 14 },
    { id: 'furniture_books_stacked_horizontal',x: 150, y:  85, zIndex: 12 },
    // Pared con herramientas
    { id: 'furniture_tool_rack',               x: 250, y:  50, zIndex: 12 },
    // Mesa de planos
    { id: 'furniture_plans_table',             x: 220, y: 140, zIndex:  8 },
    { id: 'furniture_filing_papers_pile',      x: 230, y: 165, zIndex:  6 },
    // Detalles
    { id: 'furniture_small_plant',             x:  40, y:  50, zIndex:  8 },
    { id: 'furniture_recycling_bin',           x: 290, y: 165, zIndex:  6 },
    { id: 'furniture_painting_landscape',      x: 100, y:  20, zIndex: 18 },
    { id: 'furniture_blueprint_roll',          x:  50, y: 165, zIndex:  5 },
  ],

  // ===========================================================
  // ARCHIVO (320x200) - memoria del estudio
  // Agentes aqui: Archivista, Documentalista, Tecnico Energetico, etc.
  // ===========================================================
  archive: [
    // Suelo
    { id: 'furniture_carpet_rect_persian',     x: 160, y: 130, zIndex:  2 },
    // Estanterias dominantes
    { id: 'furniture_archive_shelf',           x:  60, y:  60, zIndex: 15 },
    { id: 'furniture_archive_shelf',           x: 260, y:  60, zIndex: 15 },
    { id: 'furniture_archive_cabinet',         x:  60, y: 140, zIndex: 12 },
    { id: 'furniture_ladder_shelf',            x:  60, y:  30, zIndex: 18 },
    // Mesa de trabajo con impresora
    { id: 'furniture_printer_multifunction',   x: 160, y: 100, zIndex: 12 },
    { id: 'furniture_filing_papers_pile',      x: 195, y: 100, zIndex:  8 },
    // Libros y papeles dispersos
    { id: 'furniture_books_stacked_horizontal',x: 130, y: 150, zIndex:  6 },
    { id: 'furniture_books_stacked_horizontal',x: 200, y: 150, zIndex:  6 },
    { id: 'furniture_filing_papers_pile',      x: 250, y: 165, zIndex:  6 },
    // Detalles
    { id: 'furniture_floor_lamp',              x: 290, y: 130, zIndex: 12 },
    { id: 'furniture_small_plant',             x: 280, y: 165, zIndex:  8 },
    { id: 'furniture_recycling_bin',           x:  40, y: 160, zIndex:  6 },
  ],

  // ===========================================================
  // CORREDOR DE URGENCIAS (urgency_corridor, 960x160 - mas ancho)
  // Agentes failed van aqui (B72e). Tipo pasillo largo con vendings.
  // ===========================================================
  urgency_corridor: [
    // Alarma central + monitores
    { id: 'furniture_alarm_light',             x: 480, y:  20, zIndex: 20 },
    { id: 'furniture_monitor_stand',           x: 240, y:  60, zIndex: 15 },
    { id: 'furniture_monitor_stand',           x: 720, y:  60, zIndex: 15 },
    // Vending machines (corredor de cafeteria/snacks de emergencia)
    { id: 'furniture_vending_machine',         x: 380, y:  70, zIndex: 12 },
    { id: 'furniture_vending_machine',         x: 580, y:  70, zIndex: 12 },
    // Dispensadores agua en extremos
    { id: 'furniture_water_dispenser',         x: 100, y:  90, zIndex: 12 },
    { id: 'furniture_water_dispenser',         x: 860, y:  90, zIndex: 12 },
    // Decoracion para no parecer tan austero
    { id: 'furniture_corner_plant_tall',       x:  50, y:  30, zIndex: 15 },
    { id: 'furniture_corner_plant_tall',       x: 910, y:  30, zIndex: 15 },
    { id: 'furniture_painting_landscape',      x: 200, y:  20, zIndex: 18 },
    { id: 'furniture_painting_landscape',      x: 760, y:  20, zIndex: 18 },
    { id: 'furniture_recycling_bin',           x: 480, y: 130, zIndex:  6 },
  ],
};
