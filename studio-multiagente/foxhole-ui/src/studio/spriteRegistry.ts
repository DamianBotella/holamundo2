/**
 * @deprecated ADDENDUM 2 Bloque 1: sustituido por AgentFigure.ts (figuras
 * vectoriales). Se mantiene en el repo solo hasta confirmar visualmente que
 * AgentFigure cubre todos los casos. StudioCanvas.tsx ya NO lo importa.
 * Si nada lo consume despues del go/no-go visual, borrar este fichero +
 * StudioAgent.tsx (su unico consumidor) + carpeta assets/sprites/.
 *
 * --- Documentacion original ---
 * Registro de sprites de agentes.
 *
 * Carga todos los PNGs de assets/sprites/*.png con Vite import.meta.glob (eager)
 * y los pre-carga en Pixi Assets para uso instantaneo en drawAgent.
 *
 * Si un agent.sprite_id no tiene PNG correspondiente, fallback a generic_v1.png.
 * Si tampoco existe generic_v1.png, drawAgent usa el rect placeholder original.
 *
 * Sprites incluidos hoy (Kenney Tiny Town, CC0, 16x16 escalados a 48x64):
 *   Tier 1: director_v1, receptionist_v1, drafter_v1, accountant_v1, normative_v1
 *   Tier 2: foreman_v1, site_inspector_v1, archivist_v1, safety_v1, tramitador_v1
 *   Generic: generic_v1 (fallback Tier 3 sin sprite especifico)
 */

import { Assets, Texture } from 'pixi.js';

// Vite glob: importa todos los PNGs de la carpeta sprites como URLs
const spriteModules = import.meta.glob('./assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

// Mapa sprite_id -> URL absoluta (para Pixi Assets.load)
const SPRITE_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(spriteModules)) {
  // path = "./assets/sprites/director_v1.png" -> id = "director_v1"
  const m = path.match(/\/([^/]+)\.png$/);
  if (m) SPRITE_URLS[m[1]] = url;
}

const GENERIC_FALLBACK = 'generic_v1';

export const SPRITE_REGISTRY_INFO = {
  total: Object.keys(SPRITE_URLS).length,
  ids: Object.keys(SPRITE_URLS).sort(),
  hasGeneric: GENERIC_FALLBACK in SPRITE_URLS,
};

let loadPromise: Promise<void> | null = null;
const loadedTextures: Map<string, Texture> = new Map();

/**
 * Pre-carga todos los sprites en Pixi Assets cache.
 * Idempotente: multiples llamadas reusan la misma promise.
 */
export async function preloadSprites(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const entries = Object.entries(SPRITE_URLS);
    if (entries.length === 0) return;
    // Pixi v8: Assets.load acepta array de objetos {alias, src}
    await Promise.all(
      entries.map(async ([id, url]) => {
        try {
          const tex = await Assets.load<Texture>({ alias: id, src: url });
          loadedTextures.set(id, tex);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`[spriteRegistry] Failed to load sprite "${id}":`, err);
        }
      }),
    );
  })();
  return loadPromise;
}

/**
 * Devuelve la textura del sprite para un agent.sprite_id, o el generic fallback,
 * o null si tampoco existe el generico (entonces drawAgent usa rect placeholder).
 */
export function getAgentTexture(spriteId: string): Texture | null {
  if (loadedTextures.has(spriteId)) return loadedTextures.get(spriteId)!;
  if (loadedTextures.has(GENERIC_FALLBACK)) return loadedTextures.get(GENERIC_FALLBACK)!;
  return null;
}
