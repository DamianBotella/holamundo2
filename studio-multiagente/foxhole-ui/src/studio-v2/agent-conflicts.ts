// agent-conflicts.ts
import { STATE_PRIORITY, type Agent, type RoomDef, type AgentState } from './types';
import { findNearestWalkable, isWalkable } from './pathfinding';
import type { Vec2 } from './iso-math';

const IDLE_TO_TERRACE_MS = 5 * 60 * 1000;

// ============================================================
// 1. RESERVA DE TILES (anti-colisión durante movimiento)
// ============================================================
/**
 * Registro global de reservas: para cada (roomId, tileKey) qué agente lo reserva.
 * El agente reserva el SIGUIENTE tile en su path antes de iniciar la transición.
 */
class TileReservations {
  private byTile = new Map<string, string>(); // key "room:x,y" → agentId
  private byAgent = new Map<string, string>(); // agentId → key

  private k(roomId: string, t: Vec2) { return `${roomId}:${t.x},${t.y}`; }

  /** Intenta reservar. Devuelve true si éxito. */
  reserve(agentId: string, roomId: string, t: Vec2): boolean {
    const key = this.k(roomId, t);
    const current = this.byTile.get(key);
    if (current && current !== agentId) return false;
    // libera reserva previa del mismo agente
    const prev = this.byAgent.get(agentId);
    if (prev && prev !== key) this.byTile.delete(prev);
    this.byTile.set(key, agentId);
    this.byAgent.set(agentId, key);
    return true;
  }

  release(agentId: string) {
    const prev = this.byAgent.get(agentId);
    if (prev) this.byTile.delete(prev);
    this.byAgent.delete(agentId);
  }

  occupantOf(roomId: string, t: Vec2): string | undefined {
    return this.byTile.get(this.k(roomId, t));
  }

  occupiedTilesInRoom(roomId: string, excludeAgentId?: string): Set<string> {
    const out = new Set<string>();
    for (const [k, owner] of this.byTile) {
      if (!k.startsWith(roomId + ':')) continue;
      if (owner === excludeAgentId) continue;
      out.add(k.split(':')[1]);
    }
    return out;
  }
}

export const RESERVATIONS = new TileReservations();

// ============================================================
// 2. RESOLUCIÓN DE CONFLICTO EN MISMO TILE  (prioridad por estado)
// ============================================================
/**
 * Cuando agentA intenta moverse a un tile reservado por agentB.
 * Decisión:
 *   - Si priority(A) > priority(B): A toma el tile, B debe ceder (step aside).
 *   - Si igual: FIFO (quien reservó primero gana → A espera).
 *   - Si A < B: A recalcula path o espera.
 */
export function resolveTileConflict(
  agentA: Agent,
  agentB: Agent,
  tile: Vec2,
  room: RoomDef
): 'A_wins_B_steps_aside' | 'A_waits' | 'A_reroutes' {
  const pA = STATE_PRIORITY[agentA.state];
  const pB = STATE_PRIORITY[agentB.state];

  if (pA > pB) {
    // A gana. B intenta apartarse a un tile adyacente walkable libre.
    const occupied = RESERVATIONS.occupiedTilesInRoom(room.id, agentB.id);
    occupied.add(`${tile.x},${tile.y}`); // A va aquí
    const aside = findNearestWalkable(room, agentB.currentTile, occupied, 2);
    if (aside) {
      // Reasigna B a moverse aside; su path original se recomputa después.
      agentB.path = [aside];
      agentB.reservedNext = aside;
      RESERVATIONS.reserve(agentB.id, room.id, aside);
      return 'A_wins_B_steps_aside';
    }
    // B no puede apartarse → A espera de todos modos
    return 'A_waits';
  }

  if (pA < pB) {
    // A debe reorientar.
    return 'A_reroutes';
  }

  // Empate → FIFO (B ya tiene la reserva, A espera)
  return 'A_waits';
}

// ============================================================
// 3. COLISIÓN FRONTAL (A va a tile de B, B va a tile de A)
// ============================================================
/**
 * Detecta y resuelve cruce frontal: ambos agentes intercambian tiles simultáneamente.
 * Sin esta lógica, ambos se reservarían mutuamente y se quedarían bloqueados.
 */
export function detectFrontalSwap(
  agentA: Agent,
  agentB: Agent
): boolean {
  if (agentA.currentRoomId !== agentB.currentRoomId) return false;
  if (!agentA.reservedNext || !agentB.reservedNext) return false;
  return (
    agentA.reservedNext.x === agentB.currentTile.x &&
    agentA.reservedNext.y === agentB.currentTile.y &&
    agentB.reservedNext.x === agentA.currentTile.x &&
    agentB.reservedNext.y === agentA.currentTile.y
  );
}

/** Permite el swap: ambos se mueven en el mismo tick. */
export function executeFrontalSwap(agentA: Agent, agentB: Agent) {
  const tmp = agentA.currentTile;
  agentA.currentTile = agentB.currentTile;
  agentB.currentTile = tmp;
  agentA.reservedNext = undefined;
  agentB.reservedNext = undefined;
  RESERVATIONS.release(agentA.id);
  RESERVATIONS.release(agentB.id);
}

// ============================================================
// 4. INTERRUPCIÓN DE RUTA (cambio de estado a media transición)
// ============================================================
/**
 * Cuando el estado de un agente cambia mientras está en movimiento, NO se cancela
 * la transición tile-a-tile en curso (evita glitches visuales). Se cancela el path
 * restante. El recálculo se hace al completar el tile actual.
 */
export function interruptAgent(
  agent: Agent,
  newState: AgentState,
  newTargetRoom?: string,
  newTargetTile?: Vec2,
) {
  agent.state = newState;
  // No tocamos currentTile ni reservedNext: terminamos el paso actual.
  agent.path = []; // recálculo en próximo tick
  if (newTargetRoom !== undefined) agent.targetRoomId = newTargetRoom;
  if (newTargetTile !== undefined) agent.targetTile = newTargetTile;
  if (newState === 'idle') agent.idleSince = Date.now();
}

// ============================================================
// 5. DESTINO POR ESTADO  (regla del spec sección 5)
// ============================================================
export function destinationForState(
  agent: Agent,
  rooms: Record<string, RoomDef>
): { roomId: string; tile: Vec2 } | null {
  switch (agent.state) {
    case 'working':
    case 'waiting_approval':
      return { roomId: agent.homeRoomId, tile: agent.homeSpot };
    case 'meeting':
      return findMeetingSpot(rooms.meeting_room);
    case 'idle': {
      const idleMs = agent.idleSince ? Date.now() - agent.idleSince : 0;
      if (idleMs > IDLE_TO_TERRACE_MS) {
        return findCafeTerraceSpot(rooms.cafe_terrace, agent.id);
      }
      return { roomId: agent.homeRoomId, tile: agent.homeSpot };
    }
    case 'failed':
      return findCorridorWanderSpot(rooms.corridor, agent.id);
  }
}

// ============================================================
// 6. SALA DE REUNIONES: spot adyacente a mesa
// ============================================================
/**
 * Tiles válidos para sentarse en la Sala Reuniones: los walkable adyacentes a
 * la mesa ovalada (que es el bloque B en (4..7, 3..5)).
 */
const MEETING_SEATS: Vec2[] = [
  // Norte de la mesa
  {x:4, y:2}, {x:5, y:2}, {x:6, y:2}, {x:7, y:2},
  // Sur de la mesa
  {x:4, y:6}, {x:5, y:6}, {x:6, y:6}, {x:7, y:6},
  // Oeste/Este (un asiento por lado: 8 sillas total)
  {x:3, y:4}, {x:8, y:4},
];

export function findMeetingSpot(meetingRoom: RoomDef): { roomId: string; tile: Vec2 } {
  const occupied = RESERVATIONS.occupiedTilesInRoom(meetingRoom.id);
  for (const seat of MEETING_SEATS) {
    const k = `${seat.x},${seat.y}`;
    if (!occupied.has(k) && isWalkable(meetingRoom, seat.x, seat.y)) {
      return { roomId: meetingRoom.id, tile: seat };
    }
  }
  // Sala llena: zona de espera dentro de meeting_room cerca de la puerta W
  const fallback = findNearestWalkable(meetingRoom, {x:1, y:1}, occupied, 4);
  if (fallback) return { roomId: meetingRoom.id, tile: fallback };
  // Sala absolutamente llena (>10 ocupantes): hacer cola en el corredor
  return { roomId: 'corridor', tile: { x: 2, y: 23 } };
}

// ============================================================
// 7. TERRAZA CAFETERÍA (idle > 5min)
// ============================================================
const CAFE_IDLE_SPOTS: Vec2[] = [
  {x:2, y:3},{x:4, y:3},{x:5, y:3},{x:7, y:3},
  {x:8, y:3},{x:10, y:3},{x:11, y:3},{x:12, y:3},
  {x:1, y:1},{x:12, y:1},
];

export function findCafeTerraceSpot(
  cafeTerrace: RoomDef,
  agentId: string
): { roomId: string; tile: Vec2 } {
  // El aftercare tiene su spot fijo en (3,3); otros agentes toman libres.
  if (agentId === 'agent_aftercare') {
    return { roomId: cafeTerrace.id, tile: {x:3, y:3} };
  }
  const occupied = RESERVATIONS.occupiedTilesInRoom(cafeTerrace.id);
  for (const s of CAFE_IDLE_SPOTS) {
    if (!occupied.has(`${s.x},${s.y}`) && isWalkable(cafeTerrace, s.x, s.y)) {
      return { roomId: cafeTerrace.id, tile: s };
    }
  }
  return { roomId: cafeTerrace.id, tile: {x:1, y:1} };
}

// ============================================================
// 8. CORREDOR - WANDER PARA FAILED AGENTS
// ============================================================
const CORRIDOR_WANDER_POINTS: Vec2[] = [
  {x:1, y:3},{x:2, y:5},{x:1, y:8},{x:2, y:10},
  {x:1, y:12},{x:2, y:14},{x:1, y:17},{x:2, y:19},
  {x:1, y:20},{x:2, y:23},
];

export function findCorridorWanderSpot(
  corridor: RoomDef,
  _agentId: string
): { roomId: string; tile: Vec2 } {
  // Pseudo-aleatorio determinístico por agentId (varía cada vez que recomputa)
  const idx = Math.floor(Math.random() * CORRIDOR_WANDER_POINTS.length);
  const spot = CORRIDOR_WANDER_POINTS[idx];
  if (isWalkable(corridor, spot.x, spot.y)) {
    return { roomId: corridor.id, tile: spot };
  }
  return { roomId: corridor.id, tile: {x:1, y:1} };
}
