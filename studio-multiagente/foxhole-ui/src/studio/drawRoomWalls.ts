import { Container, Graphics } from 'pixi.js';
import type { StudioRoom } from '@/lib/types';
import { rectToIsoQuad } from './iso';
import { ROOM_VISUAL_IDENTITY, WALL_HEIGHT } from './data/roomVisualIdentity';

/**
 * Dibuja las paredes traseras de una sala (B72 cutaway iso).
 *
 * Cada sala tiene 2 paredes:
 *   - NW (top -> left): pared trasera izquierda, color mas oscuro (sombra)
 *   - NE (top -> right): pared trasera derecha, color mas claro (luz)
 *   - Frente abierto (top -> bottom no se dibuja, asi vemos el interior)
 *
 * Ademas linea de techo blanca sutil para definir la silueta del cuarto.
 * Pixi 8 API: Graphics.poly().fill({color, alpha}) en lugar del beginFill
 * antiguo del documento (que era Pixi 7).
 */
export function drawWallsForRoom(parent: Container, room: StudioRoom): void {
  const identity = ROOM_VISUAL_IDENTITY[room.room_id];
  if (!identity) return;

  const { x, y, w, h } = room.bounding_box;
  const [tl, tr, _br, bl] = rectToIsoQuad(x, y, w, h);
  void _br; // frente abierto: vertice sur no se usa
  // En iso 2:1 los vertices se llaman:
  //   top  = TL del rect ortogonal (vertice norte del rombo iso)
  //   right= TR del rect ortogonal (vertice este)
  //   left = BL del rect ortogonal (vertice oeste)
  const top = tl;
  const right = tr;
  const left = bl;

  const node = new Container();
  node.label = `walls:${room.room_id}`;
  node.zIndex = 45; // PASO 6 doc: paredes entre furniture (10-30) y agents (50)

  // Pared trasera IZQUIERDA (NW): top -> left -> left+up -> top+up
  const wallNW = new Graphics();
  wallNW
    .poly([
      top.x,  top.y,
      left.x, left.y,
      left.x, left.y - WALL_HEIGHT,
      top.x,  top.y - WALL_HEIGHT,
    ])
    .fill({ color: identity.wallLeft, alpha: 0.92 });
  node.addChild(wallNW);

  // Ventana en pared NW (PASO 7 doc)
  drawWindowOnWall(node, top, left, WALL_HEIGHT, 0.55);

  // Pared trasera DERECHA (NE): top -> right -> right+up -> top+up
  const wallNE = new Graphics();
  wallNE
    .poly([
      top.x,   top.y,
      right.x, right.y,
      right.x, right.y - WALL_HEIGHT,
      top.x,   top.y - WALL_HEIGHT,
    ])
    .fill({ color: identity.wallRight, alpha: 0.92 });
  node.addChild(wallNE);

  // Ventana en pared NE (PASO 7 doc)
  drawWindowOnWall(node, top, right, WALL_HEIGHT, 0.55);

  // Linea de techo (silueta de la sala, blanco muy sutil)
  const roof = new Graphics();
  roof
    .moveTo(left.x,  left.y  - WALL_HEIGHT)
    .lineTo(top.x,   top.y   - WALL_HEIGHT)
    .lineTo(right.x, right.y - WALL_HEIGHT)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.18 });
  node.addChild(roof);

  // Linea esquina vertical norte (refuerzo visual donde se juntan ambas paredes)
  const corner = new Graphics();
  corner
    .moveTo(top.x, top.y)
    .lineTo(top.x, top.y - WALL_HEIGHT)
    .stroke({ color: 0x000000, width: 0.6, alpha: 0.3 });
  node.addChild(corner);

  parent.addChild(node);
}

/**
 * Dibuja una ventana pixel art en una pared (PASO 7 doc).
 * pointA y pointB son los extremos de la pared a nivel del suelo.
 * windowOffsetRatio (0..1) define donde a lo largo de la pared se coloca
 * (0=pegada a A, 1=pegada a B, 0.5=centro).
 */
function drawWindowOnWall(
  parent: Container,
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
  height: number,
  windowOffsetRatio: number,
): void {
  // Posicion del centro de la ventana, interpolando en la pared
  const wx = pointA.x + (pointB.x - pointA.x) * windowOffsetRatio;
  const wy = pointA.y + (pointB.y - pointA.y) * windowOffsetRatio;
  const wTop    = wy - height * 0.78;
  const wBottom = wy - height * 0.28;
  const wWidth = 22;

  const win = new Graphics();
  // Marco + relleno azul cielo (sensacion de exterior)
  win
    .rect(wx - wWidth / 2, wTop, wWidth, wBottom - wTop)
    .fill({ color: 0x88ccff, alpha: 0.32 })
    .stroke({ color: 0xffffff, width: 1.2, alpha: 0.55 });
  // Cruz interior (cuarterones)
  win
    .moveTo(wx, wTop)
    .lineTo(wx, wBottom)
    .moveTo(wx - wWidth / 2, (wTop + wBottom) / 2)
    .lineTo(wx + wWidth / 2, (wTop + wBottom) / 2)
    .stroke({ color: 0xffffff, width: 0.8, alpha: 0.4 });
  parent.addChild(win);
}

/**
 * Cristalera semitransparente entre dos puntos (B72 doc paso 1.b).
 * No usado en B72-rediseno inicial: las salas son adyacentes sin compartir
 * pared visible (el rombo NW + NE es propio de cada una). Reservado para
 * iteracion futura si se quiere unir visualmente dos salas con cristal.
 */
export function drawGlassPartition(
  parent: Container,
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
  height: number,
): void {
  const node = new Container();
  node.label = 'glass-partition';
  node.zIndex = 45;

  // Fondo semitransparente
  const glass = new Graphics();
  glass
    .poly([
      pointA.x, pointA.y,
      pointB.x, pointB.y,
      pointB.x, pointB.y - height,
      pointA.x, pointA.y - height,
    ])
    .fill({ color: 0xa8d4e8, alpha: 0.18 });
  node.addChild(glass);

  // Marco
  const frame = new Graphics();
  frame
    .moveTo(pointA.x, pointA.y - height)
    .lineTo(pointA.x, pointA.y)
    .lineTo(pointB.x, pointB.y)
    .lineTo(pointB.x, pointB.y - height)
    .stroke({ color: 0x88bbcc, width: 1.5, alpha: 0.6 });
  node.addChild(frame);

  // Lineas horizontales del marco cada 20px
  for (let h = 20; h < height; h += 20) {
    const line = new Graphics();
    line
      .moveTo(pointA.x, pointA.y - h)
      .lineTo(pointB.x, pointB.y - h)
      .stroke({ color: 0x88bbcc, width: 0.5, alpha: 0.3 });
    node.addChild(line);
  }

  parent.addChild(node);
}
