/**
 * Singleton del subsistema Pixi del Studio: Application + Layers (sin viewport).
 *
 * Diagnostico: el viewport pixi-viewport puede ser el causante de la pantalla
 * negra. Por ahora pintamos directamente en el stage sin viewport.
 * Pan/zoom se anadira en una iteracion posterior cuando descartemos otros bugs.
 */

import { Application, Container } from 'pixi.js';
import { preloadSprites } from './spriteRegistry';
import { preloadFurniture } from './furnitureRegistry';

interface Layers {
  rooms: Container;
  furniture: Container;
  agents: Container;
  fx: Container;
}

interface StudioPixi {
  app: Application;
  /** Container raiz que envuelve rooms+agents+fx (permite escalar/trasladar todo a la vez) */
  world: Container;
  layers: Layers;
}

interface InitOptions {
  width: number;
  height: number;
  background: number;
}

let studio: StudioPixi | null = null;
let initPromise: Promise<StudioPixi> | null = null;
let mountCount = 0;
let pendingDestroy: ReturnType<typeof setTimeout> | null = null;

export async function acquireStudio(opts: InitOptions): Promise<StudioPixi> {
  mountCount++;
  if (pendingDestroy) {
    clearTimeout(pendingDestroy);
    pendingDestroy = null;
  }
  if (initPromise) return initPromise;
  if (studio) return studio;

  initPromise = (async () => {
    const app = new Application();
    await app.init({
      width: opts.width,
      height: opts.height,
      background: opts.background,
      antialias: true,
    });
    app.canvas.style.display = 'block';

    // Pre-cargar sprites de agentes y muebles en paralelo. Si alguna textura
    // falla individualmente, el registry la salta (try/catch interno).
    await Promise.all([preloadSprites(), preloadFurniture()]);

    const world = new Container();
    app.stage.addChild(world);

    const roomsLayer = new Container();
    const furnitureLayer = new Container();
    furnitureLayer.sortableChildren = true;
    const agentsLayer = new Container();
    const fxLayer = new Container();
    world.addChild(roomsLayer);
    world.addChild(furnitureLayer);
    world.addChild(agentsLayer);
    world.addChild(fxLayer);

    studio = {
      app,
      world,
      layers: { rooms: roomsLayer, furniture: furnitureLayer, agents: agentsLayer, fx: fxLayer },
    };
    return studio;
  })();
  return initPromise;
}

export function releaseStudio() {
  mountCount = Math.max(0, mountCount - 1);
  if (mountCount > 0) return;
  if (pendingDestroy) clearTimeout(pendingDestroy);
  pendingDestroy = setTimeout(() => {
    if (mountCount === 0 && studio) {
      try {
        studio.app.destroy(true, { children: true, texture: true });
      } catch {
        /* ignore */
      }
      studio = null;
      initPromise = null;
    }
    pendingDestroy = null;
  }, 150);
}

export function getStudio(): StudioPixi | null {
  return studio;
}
