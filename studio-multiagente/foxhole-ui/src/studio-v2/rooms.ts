// rooms.ts
import type { RoomDef } from './types';

// Helpers para legibilidad
const W = 'W' as const, B = 'B' as const, D = 'D' as const, E = 'E' as const;

// ============================================================
// 1. BIBLIOTECA NORMATIVA — 10×8
// ============================================================
export const LIBRARY: RoomDef = {
  id: 'library',
  name: 'Biblioteca Normativa',
  worldOffset: { x: 0, y: 0 },
  width: 10,
  height: 8,
  collision: [
    [B,B,B,B,B,B,B,B,B,B], // y=0  norte cerrado
    [B,W,W,W,W,W,W,B,W,B], // y=1  escalera biblioteca en (7,1)
    [B,W,W,W,W,W,W,W,B,B], // y=2  agent_normativa_refresh en (7,2); estantería en (8,2)
    [B,W,B,W,W,W,W,B,W,B], // y=3  mesas estudio en (2,3) y (7,3)
    [B,W,W,W,W,W,W,W,W,D], // y=4  agent_regulatory en (4,4); puerta E
    [B,W,W,W,W,W,W,B,W,B], // y=5  agent_accessibility en (2,5); agent_iee en (6,5); mesa lateral en (7,5)
    [B,W,B,W,W,W,W,B,W,B], // y=6  estanterías en (2,6) y (7,6)
    [B,B,B,B,B,D,B,B,B,B], // y=7  puerta S en (5,7)
  ],
  doors: [
    { tile: {x:9, y:4}, to:'corridor', toTile:{x:0, y:4}, label:'E' },
    { tile: {x:5, y:7}, to:'drawing_room', toTile:{x:5, y:0}, label:'S' },
  ],
  agentSpots: {
    agent_regulatory:        {x:4, y:4},
    agent_normativa_refresh: {x:7, y:2},
    agent_accessibility:     {x:2, y:5},
    agent_iee:               {x:6, y:5},
  },
};

// ============================================================
// 2. MESA DIBUJO — 10×8
// ============================================================
export const DRAWING_ROOM: RoomDef = {
  id: 'drawing_room',
  name: 'Mesa de Dibujo',
  worldOffset: { x: 0, y: 9 },
  width: 10,
  height: 8,
  collision: [
    [B,B,B,B,B,D,B,B,B,B], // y=0  puerta N → Biblioteca
    [B,W,W,W,W,W,W,W,W,B], // y=1
    [B,W,W,W,W,W,W,B,W,B], // y=2  maqueta en (7,2)
    [B,W,W,B,W,B,W,B,W,B], // y=3  tops de mesa encima de cada agente (3,3) (5,3) (7,3)
    [B,W,W,W,W,W,W,W,W,D], // y=4  sketch_to_scale(3,4); design(5,4); puerta E
    [B,W,W,W,W,W,W,W,W,B], // y=5  proposal(7,5)
    [B,W,W,W,W,W,W,B,W,B], // y=6  carpetas en (7,6)
    [B,B,B,B,B,D,B,B,B,B], // y=7  puerta S → Recepción
  ],
  doors: [
    { tile:{x:5, y:0}, to:'library', toTile:{x:5, y:7}, label:'N' },
    { tile:{x:9, y:4}, to:'corridor', toTile:{x:0, y:13}, label:'E' },
    { tile:{x:5, y:7}, to:'reception', toTile:{x:5, y:0}, label:'S' },
  ],
  agentSpots: {
    agent_design:           {x:5, y:4},
    agent_sketch_to_scale:  {x:3, y:4},
    agent_proposal:         {x:7, y:5},
  },
};

// ============================================================
// 3. RECEPCIÓN — 10×8
// ============================================================
export const RECEPTION: RoomDef = {
  id: 'reception',
  name: 'Recepción',
  worldOffset: { x: 0, y: 18 },
  width: 10,
  height: 8,
  collision: [
    [B,B,B,B,B,D,B,B,B,B], // y=0  puerta N → Mesa Dibujo
    [B,W,W,W,W,W,W,W,W,B], // y=1
    [B,W,W,W,W,W,B,W,W,B], // y=2  panel empresa en (6,2)
    [B,W,B,W,W,B,B,B,W,B], // y=3  concierge counter (2,3); mostrador briefing (5-7,3)
    [B,W,W,W,W,W,W,W,W,D], // y=4  concierge(2,4); briefing(5,4); puerta E
    [B,W,W,W,W,W,W,W,W,B], // y=5
    [B,W,B,W,W,W,W,B,W,B], // y=6  sillas espera (2,6) (7,6)
    [B,B,B,B,E,E,B,B,B,B], // y=7  ENTRADA EXTERIOR (4,7) (5,7)
  ],
  doors: [
    { tile:{x:5, y:0}, to:'drawing_room', toTile:{x:5, y:7}, label:'N' },
    { tile:{x:9, y:4}, to:'corridor', toTile:{x:0, y:22}, label:'E' },
  ],
  agentSpots: {
    agent_briefing:         {x:5, y:4},
    agent_client_concierge: {x:2, y:4},
  },
};

// ============================================================
// 4. CORREDOR CENTRAL — 4×25  (sala real, recorrida por failed agents)
// ============================================================
export const CORRIDOR: RoomDef = {
  id: 'corridor',
  name: 'Corredor Central',
  worldOffset: { x: 10, y: 0 },
  width: 4,
  height: 25,
  collision: [
    [B,B,B,B], // y=0
    [B,W,W,B], // y=1
    [B,W,W,B], // y=2
    [B,W,W,B], // y=3
    [D,W,W,D], // y=4   W→Biblioteca, E→Archivo
    [B,W,W,B], // y=5
    [B,W,W,D], // y=6   E→Dirección N
    [B,W,W,B], // y=7
    [B,W,W,B], // y=8
    [B,W,W,B], // y=9
    [B,W,W,B], // y=10
    [B,W,W,B], // y=11
    [B,W,W,B], // y=12
    [D,W,W,B], // y=13  W→Mesa Dibujo
    [B,W,W,D], // y=14  E→Dirección W
    [B,W,W,D], // y=15  E→Taller S
    [B,W,W,B], // y=16
    [B,W,W,B], // y=17
    [B,W,W,B], // y=18
    [B,W,W,B], // y=19
    [B,W,W,B], // y=20
    [B,W,W,D], // y=21  E→Dirección SW
    [D,W,W,D], // y=22  W→Recepción, E→Despacho
    [B,W,W,D], // y=23  E→Sala Reuniones
    [B,B,B,B], // y=24
  ],
  doors: [
    { tile:{x:0, y:4},  to:'library',      toTile:{x:9, y:4}, label:'W' },
    { tile:{x:3, y:4},  to:'archive',      toTile:{x:0, y:4}, label:'E' },
    { tile:{x:3, y:6},  to:'direction',    toTile:{x:6, y:0}, label:'E' },
    { tile:{x:0, y:13}, to:'drawing_room', toTile:{x:9, y:4}, label:'W' },
    { tile:{x:3, y:14}, to:'direction',    toTile:{x:0, y:5}, label:'E' },
    { tile:{x:3, y:15}, to:'workshop',     toTile:{x:5, y:7}, label:'E' },
    { tile:{x:3, y:21}, to:'direction',    toTile:{x:0, y:9}, label:'E' },
    { tile:{x:0, y:22}, to:'reception',    toTile:{x:9, y:4}, label:'W' },
    { tile:{x:3, y:22}, to:'accounting',   toTile:{x:0, y:4}, label:'E' },
    { tile:{x:3, y:23}, to:'meeting_room', toTile:{x:0, y:4}, label:'E' },
  ],
  agentSpots: {
    // Failed agents: puestos de descanso, pero estos agentes son "móviles":
    // el sistema de wander los mueve por tiles walkable del corredor.
    agent_anomaly_detector: {x:1, y:8},
    agent_pathology:        {x:2, y:11},
    agent_safety_plan:      {x:1, y:16},
    agent_energy_assessor:  {x:2, y:19},
  },
};

// ============================================================
// 5. ARCHIVO — 10×8
// ============================================================
export const ARCHIVE: RoomDef = {
  id: 'archive',
  name: 'Archivo',
  worldOffset: { x: 14, y: 0 },
  width: 10,
  height: 8,
  collision: [
    [B,B,B,B,B,B,B,B,B,B], // y=0
    [B,W,W,W,W,W,W,W,W,B], // y=1
    [B,W,W,W,W,W,W,W,W,B], // y=2  permit_tracker(3,2)
    [B,W,W,W,W,W,W,W,W,B], // y=3  certificate_generator(7,3)
    [D,W,W,W,W,W,W,W,W,B], // y=4  puerta W → Corredor; documents(5,4)
    [B,W,W,W,W,W,W,W,W,B], // y=5  compliance_audit(2,5); telematic_filing(8,5)
    [B,W,W,W,W,W,W,W,W,W], // y=6  qc_checklists(6,6); catalog_sync(9,6) → east abierto excepción
    [B,B,B,B,B,D,B,B,B,B], // y=7  puerta S → Taller
  ],
  doors: [
    { tile:{x:0, y:4}, to:'corridor', toTile:{x:3, y:4}, label:'W' },
    { tile:{x:5, y:7}, to:'workshop', toTile:{x:5, y:0}, label:'S' },
  ],
  agentSpots: {
    agent_documents:            {x:5, y:4},
    agent_certificate_generator:{x:7, y:3},
    agent_permit_tracker:       {x:3, y:2},
    agent_qc_checklists:        {x:6, y:6},
    agent_compliance_audit:     {x:2, y:5},
    agent_telematic_filing:     {x:8, y:5},
    agent_catalog_sync:         {x:9, y:6},
  },
};

// ============================================================
// 6. DIRECCIÓN — 12×10  (la más grande, centro)
// ============================================================
export const DIRECTION: RoomDef = {
  id: 'direction',
  name: 'Dirección',
  worldOffset: { x: 14, y: 9 },
  width: 12,
  height: 10,
  collision: [
    [B,B,B,B,B,B,D,B,B,B,B,B], // y=0  puerta N → Corredor
    [B,W,W,W,W,W,W,W,W,W,W,B], // y=1
    [B,W,W,W,W,W,W,W,B,W,W,B], // y=2  pantalla panorámica (8,2)
    [B,W,W,W,W,W,W,W,W,W,W,B], // y=3  collab_coordinator(9,3)
    [B,W,W,W,W,W,B,B,W,W,W,B], // y=4  mesa dirección (6,4) (7,4)
    [D,W,W,W,W,W,W,W,W,W,W,D], // y=5  main_orchestrator(6,5); puerta W y E
    [B,W,W,W,W,W,W,W,W,W,W,B], // y=6
    [B,W,W,B,W,W,W,W,W,W,W,B], // y=7  archivero (3,7); memory(2,7); decision_engine(8,7)
    [B,W,W,W,W,W,W,W,W,W,W,B], // y=8
    [D,B,B,B,B,B,D,B,B,B,B,B], // y=9  puerta SW (0,9), puerta S (6,9)
  ],
  doors: [
    { tile:{x:6, y:0},  to:'corridor',     toTile:{x:3, y:6},  label:'N'  },
    { tile:{x:0, y:5},  to:'corridor',     toTile:{x:3, y:14}, label:'W'  },
    { tile:{x:11, y:5}, to:'workshop',     toTile:{x:0, y:4},  label:'E'  },
    { tile:{x:6, y:9},  to:'meeting_room', toTile:{x:5, y:0},  label:'S'  },
    { tile:{x:0, y:9},  to:'corridor',     toTile:{x:3, y:21}, label:'SW' },
  ],
  agentSpots: {
    main_orchestrator:        {x:6, y:5},
    agent_memory:             {x:2, y:7},
    agent_collab_coordinator: {x:9, y:3},
    agent_decision_engine:    {x:8, y:7},
  },
};

// ============================================================
// 7. SALA REUNIONES — 10×8
// ============================================================
export const MEETING_ROOM: RoomDef = {
  id: 'meeting_room',
  name: 'Sala de Reuniones',
  worldOffset: { x: 14, y: 19 },
  width: 10,
  height: 8,
  collision: [
    [B,B,B,B,B,D,B,B,B,B], // y=0  puerta N → Dirección
    [B,W,W,W,W,W,W,W,W,B], // y=1
    [B,W,W,W,W,W,W,W,W,B], // y=2
    [B,W,W,W,B,B,B,B,W,B], // y=3  mesa ovalada (4-7, 3)
    [D,W,W,W,B,B,B,B,W,B], // y=4  puerta W → Corredor; client_translator(3,4); mesa continúa
    [B,W,W,W,B,B,B,B,W,B], // y=5  mesa continúa
    [B,W,W,W,W,W,W,W,W,B], // y=6
    [B,B,B,B,B,D,B,B,B,B], // y=7  puerta S → Terraza Cafetería
  ],
  doors: [
    { tile:{x:5, y:0}, to:'direction',    toTile:{x:6, y:9}, label:'N' },
    { tile:{x:0, y:4}, to:'corridor',     toTile:{x:3, y:23}, label:'W' },
    { tile:{x:5, y:7}, to:'cafe_terrace', toTile:{x:5, y:0}, label:'S' },
  ],
  agentSpots: {
    agent_client_translator: {x:3, y:4},
    // Resto de agentes en estado meeting: see findMeetingSpot()
  },
};

// ============================================================
// 8. TALLER GREMIOS — 10×8
// ============================================================
export const WORKSHOP: RoomDef = {
  id: 'workshop',
  name: 'Taller Gremios',
  worldOffset: { x: 26, y: 9 },
  width: 10,
  height: 8,
  collision: [
    [B,B,B,B,B,D,B,B,D,B], // y=0  N: (5,0)→Archivo, (8,0)→Terraza Inspección
    [B,W,W,W,W,W,W,W,W,B], // y=1
    [B,W,W,B,W,B,W,B,W,B], // y=2  muestras colgadas (3,2) y (7,2); mesa planos (5,2)
    [B,W,W,W,W,W,W,W,W,B], // y=3  trades(5,3)
    [D,W,W,W,W,W,W,W,W,B], // y=4  puerta W → Dirección; materials(7,4)
    [B,W,W,W,W,W,W,W,W,B], // y=5  trade_comms(3,5)
    [B,W,W,W,W,W,W,W,W,B], // y=6  rcd(2,6); home_automation(8,6)
    [B,B,B,B,B,D,B,B,B,B], // y=7  puerta S → Corredor
  ],
  doors: [
    { tile:{x:5, y:0}, to:'archive',            toTile:{x:5, y:7}, label:'N' },
    { tile:{x:8, y:0}, to:'inspection_terrace', toTile:{x:4, y:4}, label:'NE' },
    { tile:{x:0, y:4}, to:'direction',          toTile:{x:11, y:5}, label:'W' },
    { tile:{x:5, y:7}, to:'corridor',           toTile:{x:3, y:15}, label:'S' },
  ],
  agentSpots: {
    agent_trades:          {x:5, y:3},
    agent_trade_comms:     {x:3, y:5},
    agent_materials:       {x:7, y:4},
    agent_home_automation: {x:8, y:6},
    agent_rcd:             {x:2, y:6},
  },
};

// ============================================================
// 9. DESPACHO CONTABLE — 10×8
// ============================================================
export const ACCOUNTING: RoomDef = {
  id: 'accounting',
  name: 'Despacho Contable',
  worldOffset: { x: 26, y: 19 },
  width: 10,
  height: 8,
  collision: [
    [B,B,B,B,B,D,B,B,B,B], // y=0  puerta N → Dirección — nota: este D es lógico, mapea a Dirección SW vía teleport
    [B,W,W,W,W,W,W,W,W,B], // y=1
    [B,W,B,W,W,W,W,B,W,B], // y=2  archivador (2,2); mesa-printer (7,2)
    [B,W,W,W,W,W,W,W,W,B], // y=3  contracts(2,3); financial_tracker(7,3)
    [D,W,W,W,W,W,W,W,W,B], // y=4  puerta W → Corredor; costs(4,4)
    [B,W,W,W,W,W,W,W,W,B], // y=5
    [B,W,W,W,W,W,B,W,W,B], // y=6  grants_finder(5,6); pizarra subvenciones (6,6)
    [B,B,B,B,B,B,B,B,B,B], // y=7  sur cerrado
  ],
  doors: [
    { tile:{x:0, y:4}, to:'corridor',  toTile:{x:3, y:22}, label:'W' },
    { tile:{x:5, y:0}, to:'direction', toTile:{x:0, y:9},  label:'N' },
  ],
  agentSpots: {
    agent_costs:             {x:4, y:4},
    agent_financial_tracker: {x:7, y:3},
    agent_contracts:         {x:2, y:3},
    agent_grants_finder:     {x:5, y:6},
  },
};

// ============================================================
// 10. TERRAZA CAFETERÍA — 14×6
// ============================================================
export const CAFE_TERRACE: RoomDef = {
  id: 'cafe_terrace',
  name: 'Terraza Cafetería',
  worldOffset: { x: 14, y: 27 },
  width: 14,
  height: 6,
  collision: [
    [B,B,B,B,B,D,B,B,B,B,B,B,B,B], // y=0  puerta N → Sala Reuniones
    [B,W,W,W,W,W,W,W,W,W,W,W,W,B], // y=1
    [B,W,W,B,W,W,B,W,W,B,W,W,W,B], // y=2  mesas en (3,2) (6,2) (9,2)
    [B,W,W,W,W,W,W,W,W,W,W,W,W,B], // y=3  aftercare(3,3)
    [B,W,W,B,W,W,B,W,W,B,W,W,W,B], // y=4  más mesas
    [B,B,B,B,B,B,B,B,B,B,B,B,B,B], // y=5
  ],
  doors: [
    { tile:{x:5, y:0}, to:'meeting_room', toTile:{x:5, y:7}, label:'N' },
  ],
  agentSpots: {
    agent_aftercare: {x:3, y:3},
    // Tiles libres alrededor de las mesas son válidos como puesto idle de cualquier agente.
  },
};

// ============================================================
// 11. TERRAZA INSPECCIÓN — 8×5
// ============================================================
export const INSPECTION_TERRACE: RoomDef = {
  id: 'inspection_terrace',
  name: 'Terraza Inspección',
  worldOffset: { x: 26, y: 0 },
  width: 8,
  height: 5,
  collision: [
    [B,B,B,B,B,B,B,B], // y=0
    [B,W,W,W,W,W,W,B], // y=1
    [B,W,W,W,W,W,W,B], // y=2  site_monitor(4,2)
    [B,W,W,W,W,W,W,B], // y=3
    [B,B,B,B,D,B,B,B], // y=4  puerta S → Taller (entra desde Taller (8,0))
  ],
  doors: [
    { tile:{x:4, y:4}, to:'workshop', toTile:{x:8, y:0}, label:'S' },
  ],
  agentSpots: {
    agent_site_monitor: {x:4, y:2},
  },
};

// ============================================================
// EXPORT — STUDIO COMPLETO
// ============================================================
export const STUDIO_ROOMS: Record<string, RoomDef> = {
  library: LIBRARY,
  drawing_room: DRAWING_ROOM,
  reception: RECEPTION,
  corridor: CORRIDOR,
  archive: ARCHIVE,
  direction: DIRECTION,
  meeting_room: MEETING_ROOM,
  workshop: WORKSHOP,
  accounting: ACCOUNTING,
  cafe_terrace: CAFE_TERRACE,
  inspection_terrace: INSPECTION_TERRACE,
};
