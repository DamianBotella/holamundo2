import { Assets, Container, Graphics, Matrix, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import type { StudioRoom } from '@/lib/types';
import { PALETTE } from './palette';
import { rectToIsoQuad, worldToIso } from './iso';
import { ROOM_VISUAL_IDENTITY } from './data/roomVisualIdentity';
import { ROOM_FLOOR_TILE } from './data/roomFloors';
import { getFurnitureTexture } from './furnitureRegistry';

/**
 * ADDENDUM 2 Bloque 1: fondos isometricos por habitacion generados con
 * Gemini 2.5 flash image (script generate_room_backgrounds.mjs).
 * Si el PNG no existe, drawRoom cae al rombo iso de siempre.
 *
 * Vite import.meta.glob carga todas las PNGs disponibles en build-time.
 */
const bgModules = import.meta.glob('./assets/rooms/*_bg.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const ROOM_BG_URL: Record<string, string> = {};
for (const [filePath, url] of Object.entries(bgModules)) {
  const m = filePath.match(/\/([^/]+)_bg\.png$/);
  if (m) ROOM_BG_URL[m[1]] = url;
}

// Cache de Textures cargadas. preloadRoomBackgrounds() llena este map antes
// de que StudioCanvas renderice rooms, asi drawRoom() puede leer la textura
// sync sin tener que re-disparar useEffects despues.
const bgTextureCache: Map<string, Texture | null> = new Map();
let preloadPromise: Promise<void> | null = null;

/**
 * Pre-carga todas las texturas de fondo de habitacion en Pixi Assets cache.
 * Idempotente: multiples llamadas reusan la misma promise.
 *
 * StudioCanvas la llama UNA vez al inicializar y espera el await antes de
 * marcar pixiReady=true (asi el primer drawRoom() ya tiene texturas listas).
 */
export async function preloadRoomBackgrounds(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  const entries = Object.entries(ROOM_BG_URL);
  if (entries.length === 0) {
    preloadPromise = Promise.resolve();
    return preloadPromise;
  }
  preloadPromise = Promise.all(
    entries.map(async ([roomId, url]) => {
      try {
        const tex = await Assets.load<Texture>({ alias: `room_bg:${roomId}`, src: url });
        bgTextureCache.set(roomId, tex);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[StudioRoom] preload bg "${roomId}" failed:`, err);
        bgTextureCache.set(roomId, null);
      }
    }),
  ).then(() => undefined);
  return preloadPromise;
}

function getRoomBgTexture(roomId: string): Texture | null {
  return bgTextureCache.get(roomId) ?? null;
}

// Escala de la textura del suelo. Validada visualmente en B72d: 0.0875 da
// tablas de ~5-6px en pantalla, finas y proporcionadas a personajes (48x64)
// y muebles. Ajustar aqui si se quiere mas/menos detalle.
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

  // Color del suelo: prioridad ROOM_VISUAL_IDENTITY (B72-rediseno paleta
  // coordinada paredes+suelo) -> room.floor_color de BD -> palette default.
  const identity = ROOM_VISUAL_IDENTITY[room.room_id];
  const fillColor = identity?.floorColor
    ?? parseHex(room.floor_color, parseHex(PALETTE.bgPaper));
  const fillAlpha = identity?.floorAlpha ?? 1;
  const borderColor = parseHex(PALETTE.borderStrong);
  const borderSubtle = parseHex(PALETTE.borderSubtle);

  const { x, y, w, h } = room.bounding_box;
  const [tl, tr, br, bl] = rectToIsoQuad(x, y, w, h);

  // Suelo: si hay tile de tarima cargado, lo usamos como textura del
  // poligono iso (Pixi 8 fill({texture, matrix}) repite tileado y la matrix
  // escala las tablas para que sean finas). Fallback a color plano de la
  // identidad visual si no hay PNG de tarima.
  const floorTileId = ROOM_FLOOR_TILE[room.room_id];
  const floorTexture = floorTileId ? getFurnitureTexture(floorTileId) : null;

  const floor = new Graphics();
  floor.poly([tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
  if (floorTexture) {
    const matrix = new Matrix().scale(FLOOR_TEXTURE_SCALE, FLOOR_TEXTURE_SCALE);
    floor.fill({ texture: floorTexture, matrix });
  } else {
    floor.fill({ color: fillColor, alpha: fillAlpha });
  }
  floor.stroke({ color: borderColor, width: 2 });
  node.addChild(floor);

  // ADDENDUM 2 Bloque 1: sprite de fondo Gemini ENCIMA del rombo (alpha 0.95).
  // La textura debe estar pre-cargada via preloadRoomBackgrounds() antes de
  // este render. Si falta el PNG (cache miss) o la pre-carga aun no termino,
  // se queda solo el rombo del floor.
  const bgTex = getRoomBgTexture(room.room_id);
  if (bgTex) {
    const sprite = new Sprite(bgTex);
    sprite.anchor.set(0.5, 0.5);
    // Centro del rombo iso = worldToIso del centro del bounding box ortogonal
    const center = worldToIso(x + w / 2, y + h / 2);
    sprite.x = center.x;
    sprite.y = center.y;
    // El rombo iso 2:1 tiene ancho (w+h) y alto (w+h)/2. Cubrimos eso.
    sprite.width  = w + h;
    sprite.height = (w + h) / 2;
    sprite.alpha  = 0.95;
    node.addChild(sprite);
  }

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
