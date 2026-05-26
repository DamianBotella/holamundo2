// types.ts
import type { Vec2 } from './iso-math';

export type TileType = 'W' | 'B' | 'D' | 'E';
//   W = Walkable, B = Blocked (muro/mueble), D = Door (interior), E = Exit (exterior)

export type CollisionMatrix = TileType[][]; // [y][x]

export type DoorLabel = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

export interface Door {
  /** Tile local en esta sala donde está la puerta. */
  tile: Vec2;
  /** ID de la sala destino. */
  to: string;
  /** Tile local en la sala destino (mirror). El agente reaparece aquí. */
  toTile: Vec2;
  label: DoorLabel;
}

export interface RoomDef {
  id: string;
  name: string;
  worldOffset: Vec2;
  width: number;
  height: number;
  collision: CollisionMatrix;
  doors: Door[];
  /** Tile local fijo de cada agente que pertenece a esta sala. */
  agentSpots: Record<string, Vec2>;
}

export type AgentState =
  | 'working'
  | 'meeting'
  | 'waiting_approval'
  | 'idle'
  | 'failed';

export const STATE_PRIORITY: Record<AgentState, number> = {
  working: 4,
  meeting: 3,
  waiting_approval: 2,
  idle: 1,
  failed: 0,
};

export interface Agent {
  id: string;
  /** Sala "casa" donde está su puesto fijo. */
  homeRoomId: string;
  /** Tile fijo dentro de homeRoomId. */
  homeSpot: Vec2;
  /** Color hex para el sprite del agente. */
  color: string;

  // RUNTIME STATE
  state: AgentState;
  currentRoomId: string;
  /** Tile local actual dentro de currentRoomId. */
  currentTile: Vec2;

  // ROUTING
  targetRoomId?: string;
  targetTile?: Vec2;
  /** Path restante (tiles locales dentro de currentRoomId). */
  path: Vec2[];
  /** Tile reservado para el siguiente paso (lock anti-colisión). */
  reservedNext?: Vec2;

  // ANIMATION
  isMoving: boolean;
  /** Última vez que el agente cambió a 'idle'. Epoch ms. */
  idleSince?: number;
}

export interface Studio {
  rooms: Record<string, RoomDef>;
  agents: Record<string, Agent>;
}
