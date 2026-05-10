import { Container, Graphics, Matrix, Text, TextStyle } from 'pixi.js';
import type { StudioRoom } from '@/lib/types';
import { PALETTE } from './palette';
import { rectToIsoQuad, worldToIso } from './iso';
import { getFurnitureTexture } from './furnitureRegistry';
import { ROOM_FLOOR_TILE } from './data/roomFloors';

// Escala de la textura del suelo. La textura PixelLab es 64x64 con tablas
// gruesas; aplicarla 1:1 hace que las tablas sean tan grandes como un
// personaje (48x64). Con 0.0875 las tablas miden ~5-6px, finas, perfectas
// para que parezca tarima real con muchas tablas por sala.
const FLOOR_TEXTURE_SCALE = 0.0875;

/**
 * Dibuja una habitacion en proyeccion isometrica 2:1 (sec 1.1 del spec).
 *
 * El rect ortogonal del world se proyecta a un rombo iso (4 vertices).
 * La placa stencil de etiqueta se posiciona sobre el rombo, siguiendo el
 * borde superior, manteniendo el texto horizontal (legible).
 *
 * Hoy: rombo plano con color floor + borde militar + placa stencil.
 * Paso 9 (sprites): el rombo se sustituira por TileSprite con textura iso real.
 */
export function drawRoom(parent: Container, room: StudioRoom): Container {
  const node = new Container();
  node.label = `room:${room.room_id}`;

  const fillColor = parseHex(room.floor_color, parseHex(PALETTE.bgPaper));
  const borderColor = parseHex(PALETTE.borderStrong);
  const borderSubtle = parseHex(PALETTE.borderSubtle);

  const { x, y, w, h } = room.bounding_box;
  const [tl, tr, br, bl] = rectToIsoQuad(x, y, w, h);

  // Suelo: si hay tile de tarima cargado para este room, lo usamos como
  // textura del polígono (Pixi 8 fill({texture}) repite la textura como
  // pattern automaticamente). Si no, fallback al color plano de la BD.
  const floorTileId = ROOM_FLOOR_TILE[room.room_id];
  const floorTexture = floorTileId ? getFurnitureTexture(floorTileId) : null;

  const floor = new Graphics();
  floor.poly([tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
  if (floorTexture) {
    // Escalamos la textura para que las tablas sean proporcionadas a los
    // personajes (sin esto cada tabla mide como una persona).
    const matrix = new Matrix().scale(FLOOR_TEXTURE_SCALE, FLOOR_TEXTURE_SCALE);
    floor.fill({ texture: floorTexture, matrix });
  } else {
    floor.fill({ color: fillColor });
  }
  floor.stroke({ color: borderColor, width: 2 });
  node.addChild(floor);

  // Borde interior (rombo mas pequeno) — emula sensacion de papel/baldosa con margen
  const innerInset = 6;
  const [itl, itr, ibr, ibl] = rectToIsoQuad(
    x + innerInset,
    y + innerInset,
    w - innerInset * 2,
    h - innerInset * 2,
  );
  const innerBorder = new Graphics();
  innerBorder
    .poly([itl.x, itl.y, itr.x, itr.y, ibr.x, ibr.y, ibl.x, ibl.y])
    .stroke({ color: borderSubtle, width: 0.8 });
  innerBorder.alpha = 0.5;
  node.addChild(innerBorder);

  // Placa stencil de etiqueta — alineada con la esquina TL del rombo,
  // con el texto horizontal (no inclinado para que sea legible)
  const labelW = Math.min(w - 16, room.display_name.length * 9 + 20);
  const labelH = 20;
  // Posicion: por encima del rombo en la zona "norte" (esquina TL de la pared)
  // En iso 2:1, la esquina TL del rombo cae en world (x,y) -> screen (x-y, (x+y)/2).
  // La placa la colocamos justo encima de tl, ligeramente hacia adentro para no salirse.
  const labelAnchor = worldToIso(x + 12, y + 8);

  const plate = new Graphics();
  plate
    .rect(labelAnchor.x - labelW / 2, labelAnchor.y - labelH / 2, labelW, labelH)
    .fill({ color: 0x1e1a16, alpha: 0.65 })
    .stroke({ color: parseHex(PALETTE.tan), width: 0.8 });
  node.addChild(plate);

  const labelText = new Text({
    text: room.display_name.toUpperCase(),
    style: new TextStyle({
      fontFamily: 'Oswald, Anton, sans-serif',
      fontSize: 12,
      fontWeight: '700',
      fill: parseHex(PALETTE.tan),
      letterSpacing: 1.8,
    }),
  });
  labelText.anchor.set(0.5, 0.5);
  labelText.x = labelAnchor.x;
  labelText.y = labelAnchor.y;
  node.addChild(labelText);

  parent.addChild(node);
  return node;
}

function parseHex(css: string | null | undefined, fallback = 0x000000): number {
  if (!css) return fallback;
  const c = css.startsWith('#') ? css.slice(1) : css;
  const n = parseInt(c, 16);
  return Number.isFinite(n) ? n : fallback;
}
