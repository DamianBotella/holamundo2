// pathfinding.ts
import type { RoomDef } from './types';
import type { Vec2 } from './iso-math';

interface AStarNode {
  x: number; y: number;
  g: number; h: number; f: number;
  parent: AStarNode | null;
}

const DIRS: Array<[number, number]> = [[0,-1],[1,0],[0,1],[-1,0]]; // N E S W

/** Devuelve true si el tile (x,y) es transitable. */
export function isWalkable(room: RoomDef, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= room.width || y >= room.height) return false;
  const t = room.collision[y][x];
  return t === 'W' || t === 'D' || t === 'E';
}

/** Heurística Manhattan. */
function h(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * A* en el grid de una sala.
 * @param room Sala donde se hace el path.
 * @param start Tile local de origen.
 * @param goal Tile local de destino.
 * @param blockedExtra Tiles adicionales bloqueados (otros agentes ocupando tiles).
 * @returns Lista de waypoints (excluyendo start, incluyendo goal). Vacía si no hay ruta.
 */
export function findPath(
  room: RoomDef,
  start: Vec2,
  goal: Vec2,
  blockedExtra: Set<string> = new Set()
): Vec2[] {
  if (!isWalkable(room, goal.x, goal.y)) return [];
  if (start.x === goal.x && start.y === goal.y) return [];

  const key = (x: number, y: number) => `${x},${y}`;
  const open = new Map<string, AStarNode>();
  const closed = new Set<string>();

  const startNode: AStarNode = {
    x: start.x, y: start.y,
    g: 0, h: h(start.x, start.y, goal.x, goal.y),
    f: 0, parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  open.set(key(start.x, start.y), startNode);

  while (open.size > 0) {
    // Extraer nodo con menor f
    let current: AStarNode | null = null;
    let currentKey = '';
    for (const [k, n] of open) {
      if (current === null || n.f < current.f) {
        current = n; currentKey = k;
      }
    }
    if (!current) break;

    if (current.x === goal.x && current.y === goal.y) {
      const path: Vec2[] = [];
      let n: AStarNode | null = current;
      while (n && n.parent) {
        path.unshift({ x: n.x, y: n.y });
        n = n.parent;
      }
      return path;
    }

    open.delete(currentKey);
    closed.add(currentKey);

    for (const [dx, dy] of DIRS) {
      const nx = current.x + dx, ny = current.y + dy;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      if (!isWalkable(room, nx, ny)) continue;
      if (blockedExtra.has(nk) && !(nx === goal.x && ny === goal.y)) continue;

      const tentG = current.g + 1;
      const existing = open.get(nk);
      if (!existing || tentG < existing.g) {
        const node: AStarNode = {
          x: nx, y: ny,
          g: tentG, h: h(nx, ny, goal.x, goal.y),
          f: 0, parent: current,
        };
        node.f = node.g + node.h;
        open.set(nk, node);
      }
    }
  }
  return []; // sin ruta
}

/**
 * Encuentra el tile walkable más cercano a un objetivo (útil cuando el spot
 * está ocupado o bloqueado dinámicamente).
 */
export function findNearestWalkable(
  room: RoomDef,
  target: Vec2,
  blockedExtra: Set<string> = new Set(),
  maxRadius = 5
): Vec2 | null {
  for (let r = 0; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) + Math.abs(dy) !== r) continue;
        const x = target.x + dx, y = target.y + dy;
        if (!isWalkable(room, x, y)) continue;
        if (blockedExtra.has(`${x},${y}`)) continue;
        return { x, y };
      }
    }
  }
  return null;
}

/** Velocidad de movimiento del agente: 60 px/seg (per spec). */
export const AGENT_SPEED_PX_PER_SEC = 60;

/** Cálculo del tiempo (ms) para moverse entre 2 tiles iso adyacentes. */
export function tileTransitionMs(from: Vec2, to: Vec2): number {
  // Distancia iso aproximada entre centros de tiles adyacentes:
  // N/S: ~36px; E/W: ~36px (ambos = sqrt(32^2 + 16^2))
  const distPx = Math.hypot((to.x - from.x), (to.y - from.y));
  return (distPx / AGENT_SPEED_PX_PER_SEC) * 1000;
}
