import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import type { StudioAgent } from '@/lib/types';
import { PALETTE, colorForCategory, colorForState } from './palette';
import { getAgentTexture } from './spriteRegistry';

interface DrawAgentOptions {
  agent: StudioAgent;
  position: { x: number; y: number };
  isSelected: boolean;
  onSelect: (a: StudioAgent) => void;
}

const SPRITE_W_DEFAULT = 48;
const SPRITE_H_DEFAULT = 64;
const SPRITE_W_ORCH = 64;
const SPRITE_H_ORCH = 80;

/**
 * Dibuja un agente en un Container Pixi.
 *
 * Spec sec 5: 4 estados visuales (idle/working/waiting/failed) con tint distinto.
 * Spec sec 9: orquestador 64x80 (mas prominente).
 *
 * Hoy: rect placeholder con casco/insignia/bolsillo + halo pulsante para waiting/failed.
 * Paso 9 (sprites): se sustituye el rect por AnimatedSprite con sprite-sheet.
 *
 * Animaciones:
 *  - Halo pulsante: actualizado por el ticker en StudioCanvas (alpha + radio).
 *  - Selection ring: stroke ambar parpadeante (alpha tween en ticker).
 */
export function drawAgent(parent: Container, opts: DrawAgentOptions): Container {
  const { agent, position, isSelected, onSelect } = opts;
  const isOrch = agent.category === 'orchestrator';
  const w = isOrch ? SPRITE_W_ORCH : SPRITE_W_DEFAULT;
  const h = isOrch ? SPRITE_H_ORCH : SPRITE_H_DEFAULT;

  const stateColor = parseHex(colorForState(agent.state));
  const categoryColor = parseHex(colorForCategory(agent.category));
  const halo = agent.state === 'waiting_approval' || agent.state === 'failed';
  const badgeCount =
    agent.pending_approvals_count > 0
      ? agent.pending_approvals_count
      : agent.active_count > 0
      ? agent.active_count
      : 0;

  const node = new Container();
  node.label = `agent:${agent.agent_name}`;
  node.x = position.x;
  node.y = position.y;
  node.eventMode = 'static';
  node.cursor = 'pointer';
  node.on('pointertap', () => onSelect(agent));

  // Sombra eliptica
  const shadow = new Graphics();
  shadow.ellipse(0, h / 2 - 2, w * 0.45, 6).fill({ color: 0x000000, alpha: 0.4 });
  node.addChild(shadow);

  // Burbuja de tarea (sec 5.2 spec): texto flotante sobre el personaje
  const taskText = taskTextForAgent(agent);
  if (taskText) {
    const bubblePadX = 6;
    const bubbleH = 14;
    const bubbleY = -h / 2 - 22;
    const tmp = new Text({
      text: taskText,
      style: new TextStyle({
        fontFamily: 'Inter, sans-serif',
        fontSize: 9,
        fontWeight: '600',
        fill: parseHex(PALETTE.bone),
      }),
    });
    const bubbleW = Math.min(120, tmp.width + bubblePadX * 2);
    const bubble = new Graphics();
    bubble
      .roundRect(-bubbleW / 2, bubbleY - bubbleH / 2, bubbleW, bubbleH, 3)
      .fill({ color: 0x1e1a16, alpha: 0.85 })
      .stroke({ color: stateColor, width: 0.8 });
    // Pico de la burbuja apuntando al sprite
    bubble
      .moveTo(-3, bubbleY + bubbleH / 2)
      .lineTo(0, bubbleY + bubbleH / 2 + 4)
      .lineTo(3, bubbleY + bubbleH / 2)
      .closePath()
      .fill({ color: 0x1e1a16, alpha: 0.85 });
    node.addChild(bubble);

    tmp.anchor.set(0.5, 0.5);
    tmp.x = 0;
    tmp.y = bubbleY;
    node.addChild(tmp);
  }

  // Halo pulsante (etiquetado para que el ticker pueda animarlo)
  if (halo) {
    const haloG = new Graphics();
    haloG.circle(0, 0, w * 0.7).fill({ color: stateColor, alpha: 0.18 });
    haloG.label = 'halo';
    (haloG as Graphics & { __radius: number }).__radius = w * 0.7;
    (haloG as Graphics & { __color: number }).__color = stateColor;
    node.addChild(haloG);
  }

  // Sprite real (Kenney CC0 hoy, PixelLab.ai mañana) o fallback rect placeholder
  const texture = getAgentTexture(agent.sprite_id);
  if (texture) {
    // Plinto sutil debajo del sprite (hueco entre sombra y figura)
    const plinto = new Graphics();
    plinto
      .roundRect(-w / 2, -h / 2, w, h, 3)
      .fill({ color: 0x000000, alpha: 0.18 })
      .stroke({ color: categoryColor, width: isOrch ? 2.5 : 1.5, alpha: 0.85 });
    node.addChild(plinto);

    // Sprite escalado a 48x64 (16x16 -> escalado x3 nearest neighbor para pixel-perfect)
    texture.source.scaleMode = 'nearest';
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.width = w - 8;
    sprite.height = h - 10;
    sprite.x = 0;
    sprite.y = 0;
    // Tint del estado: idle=sin tint (mantiene color original), otros aplican tint
    if (agent.state !== 'idle') {
      sprite.tint = stateColor;
    }
    node.addChild(sprite);
  } else {
    // Fallback rect placeholder (cuando el sprite no esta cargado todavia)
    const body = new Graphics();
    body
      .roundRect(-w / 2, -h / 2, w, h, 3)
      .fill({ color: stateColor })
      .stroke({ color: categoryColor, width: isOrch ? 3 : 2 });
    body
      .roundRect(-w / 2 + 6, -h / 2 + 4, w - 12, isOrch ? 22 : 18, 2)
      .fill({ color: 0x000000, alpha: 0.35 });
    body
      .moveTo(-w / 2 + 12, 0)
      .lineTo(w / 2 - 12, 0)
      .stroke({ color: 0x000000, width: 1, alpha: 0.35 });
    body
      .roundRect(-w / 2 + 10, h / 2 - 14, w - 20, 8, 1)
      .fill({ color: 0x000000, alpha: 0.18 });
    node.addChild(body);
  }

  // Decoracion del orquestador
  if (isOrch) {
    const star = new Text({
      text: '★',
      style: new TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 14,
        fontWeight: '700',
        fill: parseHex(PALETTE.factionOrch),
      }),
    });
    star.anchor.set(0.5, 0);
    star.x = 0;
    star.y = -h / 2 + 4;
    node.addChild(star);
  }

  // Selection ring (ambar parpadeante)
  if (isSelected) {
    const ring = new Graphics();
    ring
      .roundRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10, 4)
      .stroke({ color: parseHex(PALETTE.stateWaiting), width: 2 });
    ring.label = 'selectionRing';
    node.addChild(ring);
  }

  // Badge
  if (badgeCount > 0) {
    const badgeBg = new Graphics();
    badgeBg
      .circle(w / 2 - 2, -h / 2 + 2, 9)
      .fill({ color: stateColor })
      .stroke({ color: 0x000000, width: 1, alpha: 0.5 });
    node.addChild(badgeBg);

    const badgeText = new Text({
      text: String(badgeCount),
      style: new TextStyle({
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        fontWeight: '700',
        fill: 0x1e1a16,
      }),
    });
    badgeText.anchor.set(0.5);
    badgeText.x = w / 2 - 2;
    badgeText.y = -h / 2 + 2;
    node.addChild(badgeText);
  }

  // Label tipo "ficha de campana"
  const labelPlate = new Graphics();
  labelPlate
    .rect(-32, h / 2 + 6, 64, 12)
    .fill({ color: 0x1e1a16, alpha: 0.7 })
    .stroke({ color: categoryColor, width: 0.6 });
  node.addChild(labelPlate);

  const nameLabel = new Text({
    text: agent.display_name,
    style: new TextStyle({
      fontFamily: 'Oswald, sans-serif',
      fontSize: 9,
      fontWeight: '600',
      fill: parseHex(PALETTE.bone),
      letterSpacing: 0.5,
    }),
  });
  nameLabel.anchor.set(0.5, 0);
  nameLabel.x = 0;
  nameLabel.y = h / 2 + 7;
  node.addChild(nameLabel);

  const catLabel = new Text({
    text: agent.category.toUpperCase(),
    style: new TextStyle({
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 7,
      fill: parseHex(PALETTE.boneDim),
      letterSpacing: 1,
    }),
  });
  catLabel.anchor.set(0.5, 0);
  catLabel.x = 0;
  catLabel.y = h / 2 + 22;
  node.addChild(catLabel);

  parent.addChild(node);
  return node;
}

function parseHex(css: string, fallback = 0x000000): number {
  const c = css.startsWith('#') ? css.slice(1) : css;
  const n = parseInt(c, 16);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Texto de la burbuja segun estado del agente (sec 5.2 spec, max 3 palabras).
 * En el futuro se puede ampliar con `current_task_summary` desde el endpoint
 * cuando el orquestador exponga la accion concreta.
 */
function taskTextForAgent(agent: StudioAgent): string | null {
  if (agent.state === 'working') {
    return agent.active_count > 1
      ? `Trabajando · ${agent.active_count}`
      : 'Trabajando';
  }
  if (agent.state === 'waiting_approval') {
    return agent.pending_approvals_count > 1
      ? `Esperando · ${agent.pending_approvals_count}`
      : 'Esperando aprobacion';
  }
  if (agent.state === 'failed') {
    return 'Error en ejecucion';
  }
  return null;
}
