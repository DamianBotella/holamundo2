/**
 * Layout de mobiliario por habitacion (B72-rediseno + 074 reorganizacion).
 *
 * Las coordenadas (x, y) son RELATIVAS al bounding_box de la room (igual
 * convencion que agents_catalog.default_position en migracion 074). El
 * componente StudioFurniture suma room.bounding_box.x + item.x al renderizar.
 *
 * Cada room mide 320x200 (excepto urgency_corridor que mide 960x160).
 *
 * REGLA CLAVE B72d2: muebles NO pueden estar en (x,y) cercana a la
 * default_position de ningun agente de la sala (mig 074), o solapan
 * visualmente. Para ello respetamos zonas:
 *
 *   ZONA AGENTES   x:60-260, y:90-170  (donde estan los personajes)
 *   ZONA NORTE     y:0-60              (pared norte: cuadros, reloj, plantas tall)
 *   ZONA OESTE     x:0-50              (esquina izq: plantas, papeles, libros)
 *   ZONA ESTE      x:270-320           (esquina der: plantas, lamparas, papeles)
 *   ZONA CENTRAL   x:140-180, y:60-90  (centro-norte para mueble principal opcional)
 *   ZONA SUR-EXT   y:170-200           (frente abierto: alfombras, papeles bajos)
 *
 * zIndex: 0-5 alfombras suelo / 6-10 mobiliario bajo / 11-15 mobiliario alto /
 *         16-20 elementos pared.
 */

export interface FurnitureItem {
  id: string;
  x: number;
  y: number;
  zIndex: number;
}

export const ROOM_FURNITURE: Record<string, FurnitureItem[]> = {
  // ===========================================================
  // RECEPCION (320x200) - 3 agentes en (80,110) (240,110) (160,160)
  // ===========================================================
  reception: [
    // Pared norte
    { id: 'furniture_office_clock',           x: 160, y:  15, zIndex: 18 },
    { id: 'furniture_wall_artframe_blueprint',x:  90, y:  20, zIndex: 18 },
    { id: 'furniture_painting_landscape',     x: 230, y:  20, zIndex: 18 },
    // Esquinas
    { id: 'furniture_corner_plant_tall',      x:  30, y:  50, zIndex: 15 },
    { id: 'furniture_reception_plant',        x: 290, y:  50, zIndex:  8 },
    // Sur-ext: alfombra de bienvenida (delante de los agentes)
    { id: 'furniture_carpet_rect_persian',    x: 160, y: 190, zIndex:  2 },
  ],

  // ===========================================================
  // MESA DE DIBUJO (320x200) - 3 agentes en (80,110) (240,110) (160,160)
  // ===========================================================
  drawing_room: [
    // Pared norte
    { id: 'furniture_painting_landscape',     x: 160, y:  20, zIndex: 18 },
    { id: 'furniture_plant_hanging_wall',     x: 270, y:  30, zIndex: 18 },
    // Centro-norte: mesa de dibujo principal (sin agente encima)
    { id: 'furniture_drafting_table',         x: 160, y:  60, zIndex: 10 },
    { id: 'furniture_drafting_lamp',          x: 195, y:  35, zIndex: 14 },
    { id: 'furniture_blueprint_roll',         x: 130, y:  55, zIndex: 12 },
    // Esquinas
    { id: 'furniture_small_plant',            x:  30, y:  50, zIndex:  8 },
    { id: 'furniture_blueprint_roll',         x: 290, y:  50, zIndex:  8 },
    // Sur-ext alfombra
    { id: 'furniture_carpet_round_warm',      x: 160, y: 190, zIndex:  2 },
    { id: 'furniture_filing_papers_pile',     x:  30, y: 180, zIndex:  6 },
  ],

  // ===========================================================
  // BIBLIOTECA NORMATIVA (320x200) - 5 agentes
  // (60,110) (160,90) (260,110) (100,160) (220,160)
  // ===========================================================
  normative_library: [
    // Pared norte: estanterias y cuadro
    { id: 'furniture_bookshelf_tall',         x:  30, y:  40, zIndex: 15 },
    { id: 'furniture_bookshelf_tall',         x: 290, y:  40, zIndex: 15 },
    { id: 'furniture_painting_landscape',     x: 160, y:  20, zIndex: 18 },
    { id: 'furniture_corner_plant_tall',      x: 220, y:  40, zIndex: 15 },
    // Centro-norte
    { id: 'furniture_bookshelf_small',        x:  90, y:  50, zIndex: 12 },
    // Sur-ext (alfombra debajo del area de trabajo de los 5)
    { id: 'furniture_carpet_rect_persian',    x: 160, y: 190, zIndex:  2 },
    { id: 'furniture_books_stacked_horizontal',x: 160, y: 185, zIndex:  6 },
  ],

  // ===========================================================
  // DESPACHO CONTABLE (320x200) - 4 agentes
  // (80,110) (240,110) (80,160) (240,160)
  // ===========================================================
  accounting_office: [
    // Pared norte
    { id: 'furniture_office_clock',           x: 160, y:  15, zIndex: 18 },
    { id: 'furniture_painting_landscape',     x:  60, y:  25, zIndex: 18 },
    { id: 'furniture_wall_artframe_blueprint',x: 260, y:  25, zIndex: 18 },
    // Esquinas
    { id: 'furniture_filing_cabinet',         x:  30, y:  60, zIndex: 12 },
    { id: 'furniture_small_plant',            x: 290, y:  60, zIndex:  8 },
    // Centro-norte: mesa de oficina con monitor + accesorios
    { id: 'furniture_office_desk',            x: 160, y:  60, zIndex: 10 },
    { id: 'furniture_monitor_on_desk',        x: 160, y:  45, zIndex: 14 },
    { id: 'furniture_pencil_holder',          x: 195, y:  50, zIndex: 12 },
    { id: 'furniture_coffee_cup',             x: 130, y:  55, zIndex: 12 },
    // Sur-ext
    { id: 'furniture_carpet_round_warm',      x: 160, y: 190, zIndex:  2 },
    { id: 'furniture_recycling_bin',          x:  30, y: 180, zIndex:  6 },
  ],

  // ===========================================================
  // DIRECCION - ORQUESTADOR (320x200) - 2 agentes en (160,100) (160,160)
  // ===========================================================
  main_office: [
    // Pared norte (sala de director, decoracion elegante)
    { id: 'furniture_office_clock',           x: 160, y:  15, zIndex: 18 },
    { id: 'furniture_painting_landscape',     x:  90, y:  20, zIndex: 18 },
    { id: 'furniture_wall_artframe_blueprint',x: 230, y:  20, zIndex: 18 },
    // Esquinas
    { id: 'furniture_bookcase_director',      x:  30, y:  50, zIndex: 15 },
    { id: 'furniture_corner_plant_tall',      x: 290, y:  50, zIndex: 15 },
    // Mesa del director queda al ESTE (a un lado del Director que esta en x=160)
    { id: 'furniture_director_desk',          x:  80, y:  60, zIndex: 10 },
    { id: 'furniture_table_lamp_small',       x:  60, y:  45, zIndex: 14 },
    { id: 'furniture_books_stacked_horizontal',x:100, y:  55, zIndex: 12 },
    // Sur-ext (alfombra grande)
    { id: 'furniture_carpet_rect_persian',    x: 160, y: 190, zIndex:  2 },
    { id: 'furniture_floor_lamp',             x: 290, y: 180, zIndex: 12 },
  ],

  // ===========================================================
  // SALA DE REUNIONES (320x200) - 2 agentes en (100,130) (220,130)
  // Mesa central con sillas alrededor (no chocan porque agentes estan
  // en x=100,220 y la mesa esta en x=160; las sillas a +/-50 del centro)
  // ===========================================================
  meeting_room: [
    // Pared norte
    { id: 'furniture_whiteboard',             x: 160, y:  20, zIndex: 18 },
    { id: 'furniture_painting_landscape',     x:  60, y:  25, zIndex: 18 },
    { id: 'furniture_wall_artframe_blueprint',x: 260, y:  25, zIndex: 18 },
    // Mesa de reuniones central (entre los 2 agentes)
    { id: 'furniture_conference_table',       x: 160, y:  90, zIndex: 10 },
    { id: 'furniture_coffee_cup',             x: 145, y:  85, zIndex: 12 },
    { id: 'furniture_coffee_cup',             x: 175, y:  90, zIndex: 12 },
    { id: 'furniture_pencil_holder',          x: 160, y:  80, zIndex: 12 },
    // Sillas detras (norte) y delante (sur) de la mesa, sin chocar con agentes
    { id: 'furniture_conference_chair',       x: 130, y:  65, zIndex:  6 },
    { id: 'furniture_conference_chair',       x: 190, y:  65, zIndex:  6 },
    { id: 'furniture_conference_chair',       x: 130, y: 175, zIndex:  6 },
    { id: 'furniture_conference_chair',       x: 190, y: 175, zIndex:  6 },
    // Esquinas
    { id: 'furniture_corner_plant_tall',      x:  30, y:  60, zIndex: 15 },
    { id: 'furniture_floor_lamp',             x: 290, y:  60, zIndex: 12 },
    // Sur-ext
    { id: 'furniture_carpet_round_warm',      x: 160, y: 190, zIndex:  2 },
  ],

  // ===========================================================
  // TERRAZA + INSPECCION (320x200) - 4 agentes
  // (80,110) (240,110) (80,160) (240,160)
  // ===========================================================
  site_terrace: [
    // Pared norte: vegetacion exterior
    { id: 'furniture_potted_cactus',          x:  30, y:  30, zIndex: 10 },
    { id: 'furniture_corner_plant_tall',      x: 290, y:  30, zIndex: 15 },
    { id: 'furniture_painting_landscape',     x: 160, y:  20, zIndex: 18 },
    // Centro-norte: cafeteria pequena (sin agente encima)
    { id: 'furniture_coffee_machine',         x: 160, y:  35, zIndex: 14 },
    { id: 'furniture_coffee_bar',             x: 160, y:  60, zIndex: 10 },
    { id: 'furniture_bar_stool',              x: 130, y:  75, zIndex:  6 },
    { id: 'furniture_bar_stool',              x: 190, y:  75, zIndex:  6 },
    // Sur-ext: lounge sofa para visualizar zona descanso
    { id: 'furniture_carpet_round_warm',      x: 160, y: 190, zIndex:  2 },
    { id: 'furniture_lounge_sofa',            x: 160, y: 195, zIndex:  8 },
    { id: 'furniture_terrace_table',          x:  30, y: 180, zIndex:  8 },
    { id: 'furniture_small_plant',            x: 290, y: 180, zIndex:  8 },
  ],

  // ===========================================================
  // TALLER GREMIOS (320x200) - 6 agentes
  // (60,100) (160,90) (260,100) (60,160) (160,170) (260,160)
  // ===========================================================
  trades_workshop: [
    // Pared norte
    { id: 'furniture_tool_rack',              x: 160, y:  20, zIndex: 18 },
    { id: 'furniture_painting_landscape',     x:  60, y:  20, zIndex: 18 },
    // Esquinas (los agentes estan en y:90+ asi que pegado a y:30-50 esta libre)
    { id: 'furniture_blueprint_roll',         x:  30, y:  50, zIndex:  8 },
    { id: 'furniture_blueprint_roll',         x: 290, y:  50, zIndex:  8 },
    { id: 'furniture_small_plant',            x:  30, y:  30, zIndex:  8 },
    // Workbench y plans table en zonas de borde sur (frente abierto)
    { id: 'furniture_workbench',              x: 100, y: 195, zIndex: 10 },
    { id: 'furniture_plans_table',            x: 220, y: 195, zIndex:  8 },
    { id: 'furniture_carpet_round_warm',      x: 160, y: 190, zIndex:  2 },
    { id: 'furniture_recycling_bin',          x: 290, y: 195, zIndex:  6 },
  ],

  // ===========================================================
  // ARCHIVO (320x200) - 6 agentes
  // (60,100) (160,90) (260,100) (60,160) (160,170) (260,160)
  // ===========================================================
  archive: [
    // Pared norte: estanterias y escalera
    { id: 'furniture_archive_shelf',          x:  60, y:  40, zIndex: 15 },
    { id: 'furniture_archive_shelf',          x: 260, y:  40, zIndex: 15 },
    { id: 'furniture_ladder_shelf',           x:  60, y:  20, zIndex: 18 },
    { id: 'furniture_archive_cabinet',        x: 160, y:  40, zIndex: 12 },
    // Esquinas
    { id: 'furniture_small_plant',            x:  30, y:  30, zIndex:  8 },
    { id: 'furniture_floor_lamp',             x: 290, y:  30, zIndex: 12 },
    // Sur-ext (frente abierto)
    { id: 'furniture_carpet_rect_persian',    x: 160, y: 190, zIndex:  2 },
    { id: 'furniture_printer_multifunction',  x: 100, y: 195, zIndex: 10 },
    { id: 'furniture_books_stacked_horizontal',x:220, y: 195, zIndex:  6 },
    { id: 'furniture_recycling_bin',          x: 290, y: 195, zIndex:  6 },
  ],

  // ===========================================================
  // CORREDOR DE URGENCIAS (960x160 - mas ancho) - 0 residentes
  // Decoracion plena: alarma + monitores + plantas + dispensers + vending
  // ===========================================================
  urgency_corridor: [
    { id: 'furniture_alarm_light',            x: 480, y:  20, zIndex: 20 },
    { id: 'furniture_monitor_stand',          x: 240, y:  60, zIndex: 15 },
    { id: 'furniture_monitor_stand',          x: 720, y:  60, zIndex: 15 },
    { id: 'furniture_vending_machine',        x: 380, y:  70, zIndex: 12 },
    { id: 'furniture_vending_machine',        x: 580, y:  70, zIndex: 12 },
    { id: 'furniture_water_dispenser',        x: 100, y:  90, zIndex: 12 },
    { id: 'furniture_water_dispenser',        x: 860, y:  90, zIndex: 12 },
    { id: 'furniture_corner_plant_tall',      x:  50, y:  30, zIndex: 15 },
    { id: 'furniture_corner_plant_tall',      x: 910, y:  30, zIndex: 15 },
    { id: 'furniture_painting_landscape',     x: 200, y:  20, zIndex: 18 },
    { id: 'furniture_painting_landscape',     x: 760, y:  20, zIndex: 18 },
    { id: 'furniture_recycling_bin',          x: 480, y: 130, zIndex:  6 },
  ],
};
