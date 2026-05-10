/**
 * Registro de sprites de mobiliario (B72 — La Oficina Viva).
 *
 * Mismo patron que spriteRegistry pero para muebles. Carga todos los PNGs de
 * assets/sprites/furniture/*.png con Vite import.meta.glob (eager) y los
 * pre-carga en Pixi Assets.
 *
 * Si un furniture_id no tiene PNG (script PixelLab no ejecutado aun), el
 * componente StudioFurniture pintara un rect placeholder con el color de la
 * categoria del mueble. Esto permite ver el layout antes de generar los assets.
 */

import { Assets, Texture } from 'pixi.js';

const furnitureModules = import.meta.glob('./assets/sprites/furniture/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const FURNITURE_URLS: Record<string, string> = {};
for (const [p, url] of Object.entries(furnitureModules)) {
  const m = p.match(/\/([^/]+)\.png$/);
  if (m) FURNITURE_URLS[m[1]] = url;
}

export const FURNITURE_REGISTRY_INFO = {
  total: Object.keys(FURNITURE_URLS).length,
  ids: Object.keys(FURNITURE_URLS).sort(),
};

let loadPromise: Promise<void> | null = null;
const loadedTextures: Map<string, Texture> = new Map();

export async function preloadFurniture(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const entries = Object.entries(FURNITURE_URLS);
    if (entries.length === 0) return;
    await Promise.all(
      entries.map(async ([id, url]) => {
        try {
          const tex = await Assets.load<Texture>({ alias: `furn:${id}`, src: url });
          loadedTextures.set(id, tex);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`[furnitureRegistry] Failed to load "${id}":`, err);
        }
      }),
    );
  })();
  return loadPromise;
}

export function getFurnitureTexture(id: string): Texture | null {
  return loadedTextures.get(id) ?? null;
}
