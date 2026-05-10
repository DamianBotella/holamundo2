/**
 * Posiciones destino de los agentes segun estado (B72 Paso 2 — La Oficina Viva).
 *
 * Coordenadas en WORLD ortogonal (mismo sistema que room.bounding_box). El
 * canvas las proyecta a iso con worldToIso al renderizar.
 *
 * Los agentes "viven" en su default_position (su mesa, columna v_agent_studio_state).
 * Cuando cambian de estado, el ticker interpola desde la posicion actual hacia
 * la posicion devuelta por getAgentTargetPosition().
 */

export interface WorldPosition {
  x: number;
  y: number;
}

// =============================================================================
// IDLE — Cafeteria/terraza (site_terrace ampliada en B72b)
// =============================================================================
// site_terrace bounding_box: { x: 0, y: 400, w: 320, h: 200 }
// Mezcla zona inspeccion (izq) + cafeteria (der). Asignamos por indice de
// agente para que no se apilen en el mismo punto.

export const IDLE_POSITIONS: WorldPosition[] = [
  // Zona cafeteria (taburetes barra)
  { x: 210, y: 530 }, // bar_stool izq
  { x: 240, y: 540 }, // bar_stool centro
  { x: 270, y: 530 }, // bar_stool der

  // Zona inspeccion (sillas terraza)
  { x:  50, y: 540 }, // terrace_chair izq
  { x: 130, y: 540 }, // terrace_chair der

  // Posiciones libres caminando por la terraza
  { x:  90, y: 480 },
  { x: 200, y: 480 },
  { x: 160, y: 560 },
  { x:  20, y: 480 },
  { x: 300, y: 480 },
  { x: 110, y: 510 },
  { x: 210, y: 510 },
  // si hay mas agentes idle de los previstos, se reparten por modulo
];

// =============================================================================
// MEETING — Sala de reuniones alrededor de la mesa central
// =============================================================================
// meeting_room bounding_box: { x: 640, y: 200, w: 320, h: 200 }
// Mesa de reuniones en (160, 110) relativo => world (800, 310). 4 sillas ya
// definidas en roomFurniture.ts, pero el agente puede solapar otra silla
// dependiendo del numero. Usamos 6 posiciones (4 sillas + cabecera + pie).

export const MEETING_POSITIONS: WorldPosition[] = [
  { x: 800, y: 250 }, // cabecera norte
  { x: 750, y: 290 }, // silla NO
  { x: 850, y: 290 }, // silla NE
  { x: 750, y: 330 }, // silla SO
  { x: 850, y: 330 }, // silla SE
  { x: 800, y: 370 }, // pie sur
];

// =============================================================================
// FAILED — Corredor de urgencias (los agentes con error van aqui)
// =============================================================================
// urgency_corridor bounding_box: { x: 0, y: 600, w: 960, h: 160 }
// Repartimos por el corredor para que sean visibles (no apilados).

export const FAILED_POSITIONS: WorldPosition[] = [
  { x: 100, y: 680 },
  { x: 280, y: 680 },
  { x: 480, y: 680 },
  { x: 680, y: 680 },
  { x: 860, y: 680 },
];

// =============================================================================
// Velocidad de movimiento
// =============================================================================
// Pixeles por segundo en world ortogonal. La proyeccion iso comprime el eje Y
// a la mitad, asi que en pantalla parece ~la mitad de rapido en vertical. 60
// world-px/s da una velocidad de paseo natural (atravesar una room de 320 en
// ~5 segundos).

export const AGENT_WALK_SPEED = 60;

// Distancia minima en world units para considerar que un agente "ya llego"
// y dejar de animar (evita jitter en el ticker).
export const ARRIVAL_THRESHOLD = 1.5;
