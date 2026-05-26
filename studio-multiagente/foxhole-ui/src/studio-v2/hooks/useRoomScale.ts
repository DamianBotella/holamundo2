import { useEffect, useState } from 'react';
import type { RoomDef } from '../types';
import { TILE_W, TILE_H } from '../iso-math';

/**
 * Calcula la escala uniforme para que la sala (su bbox isometrico, no el PNG)
 * encaje en el 90% del lado menor del canvas.
 *
 * El bbox iso de una sala WxH es:
 *   wIso = (W+H) * TILE_W/2
 *   hIso = (W+H) * TILE_H/2
 *
 * Las PNGs de Gemini son cuadradas/casi-cuadradas con el diamante iso DENTRO
 * + margen. Para que el sprite encaje sin recortarse usamos el TAMANO DEL
 * PNG (no el bbox iso) como referencia de fit. El bbox iso se usa solo para
 * posicionar door hotspots relativos al centro del diamante.
 */
export interface CanvasSize { w: number; h: number; }

export function useCanvasSize(ref: React.RefObject<HTMLElement | null>): CanvasSize {
  const [size, setSize] = useState<CanvasSize>({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, [ref]);
  return size;
}

/**
 * Devuelve la escala a aplicar a la imagen PNG para que ocupe el 90% del
 * lado menor del canvas. Mantiene aspect ratio.
 */
export function computeRoomFitScale(
  imgW: number,
  imgH: number,
  canvas: CanvasSize,
  fitFactor = 0.9,
): number {
  if (!imgW || !imgH || !canvas.w || !canvas.h) return 1;
  const sx = (canvas.w * fitFactor) / imgW;
  const sy = (canvas.h * fitFactor) / imgH;
  return Math.min(sx, sy);
}

/**
 * Tamano iso (px) del bbox de una sala (independientemente del PNG).
 */
export function roomIsoBBox(room: RoomDef) {
  return {
    wIso: (room.width + room.height) * (TILE_W / 2),
    hIso: (room.width + room.height) * (TILE_H / 2),
  };
}
