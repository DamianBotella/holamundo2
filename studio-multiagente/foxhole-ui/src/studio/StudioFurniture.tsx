import { Container, Graphics, Sprite } from 'pixi.js';
import type { StudioRoom } from '@/lib/types';
import type { FurnitureItem } from './data/roomFurniture';
import { ROOM_FURNITURE } from './data/roomFurniture';
import { getFurnitureTexture } from './furnitureRegistry';
import { worldToIso, isoZIndexFromWorld } from './iso';
import { PALETTE } from './palette';

/**
 * Dibuja todo el mobiliario de una room. Cada item se posiciona como un agente:
 *   wx = room.bounding_box.x + item.x
 *   wy = room.bounding_box.y + item.y
 * Luego worldToIso lo proyecta. zIndex iso para que muebles del fondo queden
 * tapados por los del frente, y dentro del mismo z se respeta item.zIndex.
 *
 * Si el PNG no esta cargado (script PixelLab no ejecutado aun), se pinta un
 * rect placeholder con el color de la categoria de la room para que el layout
 * sea visible mientras tanto.
 */
export function drawFurnitureForRoom(parent: Container, room: StudioRoom): void {
  const items = ROOM_FURNITURE[room.room_id];
  if (!items || items.length === 0) return;

  for (const item of items) {
    const wx = room.bounding_box.x + item.x;
    const wy = room.bounding_box.y + item.y;
    const iso = worldToIso(wx, wy);

    const node = new Container();
    node.label = `furn:${room.room_id}:${item.id}`;
    node.x = iso.x;
    node.y = iso.y;
    // z-orden combinando posicion iso (perspectiva) + zIndex del item (altura)
    node.zIndex = isoZIndexFromWorld(wx, wy) * 1000 + item.zIndex;

    const texture = getFurnitureTexture(item.id);
    if (texture) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 0.85); // base del mueble apoyada en el suelo
      // Conserva relacion de aspecto del png (32x32 alarma, 64x64 resto)
      node.addChild(sprite);
    } else {
      // Fallback: rect tan suave que indica donde estara el mueble
      const placeholder = drawPlaceholder(item);
      node.addChild(placeholder);
    }

    parent.addChild(node);
  }
}

function drawPlaceholder(item: FurnitureItem): Graphics {
  const g = new Graphics();
  // Tamano variable para distinguir muebles grandes de los pequenos
  const isLarge = /desk|table|bench|bookshelf|cabinet|conference_table/.test(item.id);
  const w = isLarge ? 28 : 18;
  const h = isLarge ? 18 : 14;
  const fillColor = parseHex(PALETTE.tan, 0xa68a64);
  g.rect(-w / 2, -h, w, h)
    .fill({ color: fillColor, alpha: 0.45 })
    .stroke({ color: fillColor, width: 1, alpha: 0.85 });
  return g;
}

function parseHex(css: string | null | undefined, fallback: number): number {
  if (!css) return fallback;
  const c = css.startsWith('#') ? css.slice(1) : css;
  const n = parseInt(c, 16);
  return Number.isFinite(n) ? n : fallback;
}
