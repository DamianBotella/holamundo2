// iso-math.ts
export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = 32;
export const HALF_H = 16;

export interface Vec2 { x: number; y: number; }

/** World tile (gx, gy) → iso pixel (centro del rombo). */
export function tileToIso(gx: number, gy: number): Vec2 {
  return { x: (gx - gy) * HALF_W, y: (gx + gy) * HALF_H };
}

/** Iso pixel → world tile (con redondeo). */
export function isoToTile(px: number, py: number): Vec2 {
  return {
    x: Math.round((px / HALF_W + py / HALF_H) / 2),
    y: Math.round((py / HALF_H - px / HALF_W) / 2),
  };
}

/** Local tile dentro de una sala → iso pixel mundial. */
export function roomTileToIso(
  worldOffset: Vec2,
  localX: number,
  localY: number
): Vec2 {
  return tileToIso(worldOffset.x + localX, worldOffset.y + localY);
}

/** Interpolación lineal para animación de movimiento entre tiles. */
export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Z-index para ordenamiento isométrico (rooms y agentes). */
export function isoZIndex(gx: number, gy: number): number {
  return (gx + gy) * 1000;
}
