import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { StudioAgent } from '@/lib/types';
import { PALETTE } from './palette';

/**
 * ADDENDUM 2 Bloque 1 — figura vectorial del agente (sustituye a sprites Kenney
 * de StudioAgent.tsx + spriteRegistry.ts).
 *
 * Diseno:
 *   - Sombra eliptica en el suelo iso
 *   - Cuerpo eliptico (color segun agent_type) + cabeza circle
 *   - Halo alrededor de la cabeza segun estado (working/waiting/failed)
 *   - Bobbing 2px senoidal cuando isMoving=true (animado por ticker en
 *     StudioCanvas via __bobBody/__baseY)
 *
 * Mantiene la misma API publica que drawAgent() en StudioAgent.tsx
 * (parent + opts) para que el reemplazo sea drop-in en StudioCanvas.
 *
 * Colores derivan de agents_catalog.category (mismo mapeo que la vista
 * SQL agent_registry de la migracion 084):
 *   orchestrator -> amarillo  (#F4C430)
 *   core         -> azul      (#4A90D9)
 *   auxiliary    -> gris      (#8A9BA8)
 *   util         -> gris      (#8A9BA8)
 */

interface DrawAgentFigureOptions {
  agent: StudioAgent;
  position: { x: number; y: number };
  isSelected: boolean;
  isMoving?: boolean;  // Bloque 2: animacion de caminar
  onSelect: (a: StudioAgent) => void;
}

const FIGURE_COLOR: Record<StudioAgent['category'], number> = {
  orchestrator: 0xf4c430,
  core:         0x4a90d9,
  auxiliary:    0x8a9ba8,
  util:         0x8a9ba8,
};

// Geometria base de la figura (cabeza + cuerpo + sombra)
const SHADOW_RX = 11;
const SHADOW_RY = 4;
const BODY_RX   = 10;
const BODY_RY   = 14;
const BODY_CY   = -8;
const HEAD_R    = 8;
const HEAD_CY   = -26;
const HALO_R    = 12;

// Halo: color por estado (verde working, ambar waiting, rojo failed)
const HALO_COLOR: Record<string, number> = {
  working:          0x22c55e,
  waiting_approval: 0xf59e0b,
  failed:           0xef4444,
};

export function drawAgentFigure(parent: Container, opts: DrawAgentFigureOptions): Container {
  const { agent, position, isSelected, isMoving = false, onSelect } = opts;
  const isOrch = agent.category === 'orchestrator';

  const bodyColor = FIGURE_COLOR[agent.category] ?? FIGURE_COLOR.auxiliary;
  const bodyAlpha = agent.state === 'idle' ? 0.7 : 1.0;

  const node = new Container();
  node.label = `agent:${agent.agent_name}`;
  node.x = position.x;
  node.y = position.y;
  node.eventMode = 'static';
  node.cursor = 'pointer';
  node.on('pointertap', () => onSelect(agent));

  // 1) Sombra eliptica en el suelo
  const shadow = new Graphics();
  shadow.ellipse(0, 4, SHADOW_RX, SHADOW_RY).fill({ color: 0x000000, alpha: 0.18 });
  node.addChild(shadow);

  // 2) Cuerpo + cabeza en un sub-container que se anima con bob senoidal.
  //    El ticker en StudioCanvas mueve este container en Y leyendo __bobBody.
  const figure = new Container();
  figure.label = 'figureBody';
  (figure as Container & { __bobBody?: boolean; __baseY?: number }).__bobBody = isMoving;
  (figure as Container & { __bobBody?: boolean; __baseY?: number }).__baseY = 0;
  node.addChild(figure);

  const body = new Graphics();
  body.ellipse(0, BODY_CY, BODY_RX, BODY_RY).fill({ color: bodyColor, alpha: bodyAlpha });
  figure.addChild(body);

  const head = new Graphics();
  head.circle(0, HEAD_CY, HEAD_R).fill({ color: bodyColor, alpha: bodyAlpha });
  figure.addChild(head);

  // 3) Halo segun estado. failed estatico, resto pulsante (ticker StudioCanvas).
  const haloColor = HALO_COLOR[agent.state];
  if (haloColor) {
    const halo = new Graphics();
    halo.circle(0, HEAD_CY, HALO_R).stroke({ color: haloColor, width: 2, alpha: 0.85 });
    halo.label = 'stateOrb';  // Mismo label que el orb antiguo: el ticker
                              // existente lo pulsa sin cambios.
    (halo as Graphics & { __pulseFreq?: number; __baseAlpha?: number }).__pulseFreq =
      agent.state === 'failed' ? 0 : 2 * Math.PI * (agent.state === 'waiting_approval' ? 1.0 : 0.6);
    (halo as Graphics & { __pulseFreq?: number; __baseAlpha?: number }).__baseAlpha = 0.85;
    figure.addChild(halo);
  }

  // 4) Estrella sobre el director (orchestrator) — equivalente al detalle previo
  if (isOrch) {
    const star = new Text({
      text: '★',
      style: new TextStyle({
        fontFamily: 'sans-serif',
        fontSize: 12,
        fontWeight: '700',
        fill: 0xf4c430,
        stroke: { color: 0x1e1a16, width: 2 },
      }),
    });
    star.anchor.set(0.5, 1);
    star.x = 0;
    star.y = HEAD_CY - HEAD_R - 2;
    figure.addChild(star);
  }

  // 5) Badge de notificaciones (aprobaciones pendientes / ejecuciones activas).
  //    Posicion: arriba a la derecha de la cabeza.
  const badgeCount =
    agent.pending_approvals_count > 0 ? agent.pending_approvals_count
    : agent.active_count > 0          ? agent.active_count
    : 0;
  if (badgeCount > 0) {
    const badgeBg = new Graphics();
    badgeBg.circle(0, 0, 9).fill({ color: 0xffffff }).stroke({ color: 0x000000, width: 1, alpha: 0.6 });
    badgeBg.x = 12;
    badgeBg.y = HEAD_CY - 4;
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
    badgeText.x = 12;
    badgeText.y = HEAD_CY - 4;
    node.addChild(badgeText);
  }

  // 6) Burbuja contextual (solo waiting_approval / failed; working ya tiene halo verde)
  const taskText = taskTextForAgent(agent);
  if (taskText) {
    const bubblePadX = 6;
    const bubbleH = 14;
    const bubbleY = HEAD_CY - HEAD_R - 14;
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
    const stateColor =
      agent.state === 'waiting_approval' ? 0xe0a85c :
      agent.state === 'failed'           ? 0xef4444 : 0xffffff;
    const bubble = new Graphics();
    bubble
      .roundRect(-bubbleW / 2, bubbleY - bubbleH / 2, bubbleW, bubbleH, 3)
      .fill({ color: 0x1e1a16, alpha: 0.85 })
      .stroke({ color: stateColor, width: 0.8 });
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

  // 7) Selection ring (ambar parpadeante via ticker)
  if (isSelected) {
    const ring = new Graphics();
    ring
      .roundRect(-14, HEAD_CY - HALO_R - 2, 28, 38, 4)
      .stroke({ color: parseHex(PALETTE.stateWaiting), width: 2 });
    ring.label = 'selectionRing';
    node.addChild(ring);
  }

  // 8) Etiqueta display_name + categoria
  const nameLabel = new Text({
    text: agent.display_name,
    style: new TextStyle({
      fontFamily: 'Oswald, sans-serif',
      fontSize: 10,
      fontWeight: '700',
      fill: 0x000000,
      letterSpacing: 0.6,
      stroke: { color: 0xffffff, width: 2 },
    }),
  });
  nameLabel.anchor.set(0.5, 0);
  nameLabel.x = 0;
  nameLabel.y = 12;
  node.addChild(nameLabel);

  const catLabel = new Text({
    text: agent.category.toUpperCase(),
    style: new TextStyle({
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 7,
      fill: 0x000000,
      letterSpacing: 1,
    }),
  });
  catLabel.anchor.set(0.5, 0);
  catLabel.x = 0;
  catLabel.y = 26;
  node.addChild(catLabel);

  parent.addChild(node);
  return node;
}

function parseHex(css: string, fallback = 0x000000): number {
  const c = css.startsWith('#') ? css.slice(1) : css;
  const n = parseInt(c, 16);
  return Number.isFinite(n) ? n : fallback;
}

function taskTextForAgent(agent: StudioAgent): string | null {
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
