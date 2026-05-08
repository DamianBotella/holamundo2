/**
 * Conversion de coordenadas world ortogonales (BD: pixeles X/Y) a screen
 * isometrico 2:1 estandar (sec 1.1 del spec).
 *
 * Formula:
 *   screenX = worldX - worldY
 *   screenY = (worldX + worldY) / 2
 *
 * Resultado: un cuadrado world de WxW pixeles se ve como un rombo iso de
 * 2W de ancho x W de alto (ratio 2:1).
 *
 * Tile base 64x32 (sec 3.1 del spec): un tile world de 64x64 da un rombo iso
 * de 128x64. Conversion equivalente.
 */

import type { StudioRoom } from '@/lib/types';

export const TILE_W = 64;
export const TILE_H = 32;

export interface IsoPoint {
  x: number;
  y: number;
}

export function worldToIso(x: number, y: number): IsoPoint {
  return { x: x - y, y: (x + y) / 2 };
}

export interface IsoBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

/** Bounds iso de un rect ortogonal world */
export function rectToIsoBounds(x: number, y: number, w: number, h: number): IsoBounds {
  const tl = worldToIso(x, y);
  const tr = worldToIso(x + w, y);
  const br = worldToIso(x + w, y + h);
  const bl = worldToIso(x, y + h);
  const minX = Math.min(tl.x, tr.x, bl.x, br.x);
  const maxX = Math.max(tl.x, tr.x, bl.x, br.x);
  const minY = Math.min(tl.y, tr.y, bl.y, br.y);
  const maxY = Math.max(tl.y, tr.y, bl.y, br.y);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/** Devuelve los 4 vertices iso (TL, TR, BR, BL) de un rect world */
export function rectToIsoQuad(
  x: number,
  y: number,
  w: number,
  h: number,
): [IsoPoint, IsoPoint, IsoPoint, IsoPoint] {
  return [
    worldToIso(x, y),         // TL
    worldToIso(x + w, y),     // TR
    worldToIso(x + w, y + h), // BR
    worldToIso(x, y + h),     // BL
  ];
}

// World ortogonal: 960x760 (sec 3.1 del spec)
export const WORLD_W = 960;
export const WORLD_H = 760;

// Bounds iso del world entero. Se usan para ajustar el fit y el offset del
// world container (porque iso puede dar coords X negativas).
export const ISO_WORLD = rectToIsoBounds(0, 0, WORLD_W, WORLD_H);
// Aprox: minX=-760, maxX=960, minY=0, maxY=860 -> width=1720, height=860

/**
 * Offset que se aplica al world container para que TODAS las coords iso
 * sean >= 0 (la esquina iso superior-izquierda del world cae en (0,0)).
 */
export const ISO_OFFSET: IsoPoint = {
  x: -ISO_WORLD.minX,
  y: -ISO_WORLD.minY,
};

/**
 * Comparator para z-ordering de rooms/agents en isometrico:
 * los que tienen mayor (worldX + worldY) se dibujan DESPUES (encima).
 */
export function isoZIndexFromWorld(x: number, y: number): number {
  return x + y;
}

export function compareRoomsIso(a: StudioRoom, b: StudioRoom): number {
  return (
    isoZIndexFromWorld(a.bounding_box.x + a.bounding_box.w / 2, a.bounding_box.y + a.bounding_box.h / 2) -
    isoZIndexFromWorld(b.bounding_box.x + b.bounding_box.w / 2, b.bounding_box.y + b.bounding_box.h / 2)
  );
}
