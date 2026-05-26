import { useMemo } from 'react';
import type { RoomDef, Door } from '../types';
import { tileToIso, TILE_W, TILE_H } from '../iso-math';
import type { CanvasSize } from './useRoomScale';

export interface DoorHotspot {
  door: Door;
  /** Posicion en pantalla (px) del centro del hotspot. */
  x: number;
  y: number;
  /** Lado del hotspot (px). */
  size: number;
  /** Nombre legible de la sala destino (para tooltip). */
  destName: string;
}

/**
 * Para cada door de la sala activa calcula la posicion en pantalla.
 *
 * Estrategia: el PNG de Gemini contiene el diamante iso CENTRADO. El centro
 * del PNG coincide con el centro del bbox de tiles de la sala. Por tanto:
 *
 *   1. localIso = tileToIso(door.tile.x, door.tile.y)
 *   2. roomCenterIso = tileToIso((W-1)/2, (H-1)/2)
 *   3. offsetFromCenter = localIso - roomCenterIso
 *   4. screenPos = canvasCenter + offsetFromCenter * scale * spriteAdjust
 *
 * spriteAdjust: el diamante iso ocupa solo una parte del PNG (Gemini deja
 * margen + paredes traseras N+W que se extienden hacia arriba). En la
 * practica el diamante "visible" ocupa ~55-65% del ancho del PNG. La
 * relacion exacta varia por sala. Por ahora calibramos con un factor
 * empirico unico.
 */
export function useDoorHotspots(
  room: RoomDef,
  imgW: number,
  imgH: number,
  scale: number,
  canvas: CanvasSize,
  rooms: Record<string, RoomDef>,
  spriteAdjust = 0.6,
): DoorHotspot[] {
  return useMemo(() => {
    if (!canvas.w || !canvas.h || !scale) return [];
    const cx = canvas.w / 2;
    const cy = canvas.h / 2;

    // Iso center del bbox de tiles
    const center = tileToIso((room.width - 1) / 2, (room.height - 1) / 2);

    const out: DoorHotspot[] = [];
    for (const door of room.doors) {
      const local = tileToIso(door.tile.x, door.tile.y);
      const ox = local.x - center.x;
      const oy = local.y - center.y;

      // Conversion al canvas: aplicamos scale de fit del PNG completo y
      // ademas un factor sprite-adjust porque el bbox iso es mas pequeno
      // que el PNG (Gemini deja margen y paredes traseras).
      const effectiveScale = scale * spriteAdjust * (imgW / ((room.width + room.height) * (TILE_W / 2)));

      const x = cx + ox * effectiveScale;
      const y = cy + oy * effectiveScale;

      const destRoom = rooms[door.to];
      const destName = destRoom?.name || door.to;

      // Tamano del hotspot proporcional al tile (un tile iso ~64x32, hotspot
      // ~1 tile completo). Lo limitamos a un minimo de 36px para usabilidad.
      const hotspotSize = Math.max(36, TILE_W * scale * spriteAdjust * (imgW / ((room.width + room.height) * (TILE_W / 2))));

      out.push({ door, x, y, size: hotspotSize, destName });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, imgW, imgH, scale, canvas.w, canvas.h, spriteAdjust]);
}

// Silenciar warning de imports no usados que pueden quedar segun calibracion
void TILE_H;
