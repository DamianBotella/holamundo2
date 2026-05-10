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
  // B70b: Quitamos halo y plinto gris. Indicador de estado = orb sobre la
  // cabeza (mas limpio visualmente). Cada estado define alpha base y frec
  // de pulso (rad/s):
  //   working          -> respiracion suave 0.6 Hz
  //   waiting_approval -> parpadeo 1 Hz (docu Opus)
  //   failed           -> rojo fijo
  //   idle             -> sin orb
  const orbConfig =
    agent.state === 'working'           ? { alpha: 0.95, freq: 2 * Math.PI * 0.6 } :
    agent.state === 'waiting_approval'  ? { alpha: 1.00, freq: 2 * Math.PI * 1.0 } :
    agent.state === 'failed'            ? { alpha: 0.95, freq: 0 } :
    null;
  const badgeCount =
    agent.pending_approvals_count > 0
      ? agent.pending_approvals_count
      : agent.active_count > 0
      ? agent.active_count
      : 0;

  // B70b: posicionamiento horizontal del orb de estado y badge de notif.
  //   - Si ambos visibles: orb a la izquierda (x=-10), badge a la derecha (x=10)
  //   - Si solo uno: centrado (x=0)
  // Comparten la misma Y (encima de la cabeza).
  const hasOrb = orbConfig !== null;
  const hasBadge = badgeCount > 0;
  const both = hasOrb && hasBadge;
  const orbX = both ? -10 : 0;
  const badgeX = both ? 10 : 0;
  const headY = -h / 2 - 8;

  const node = new Container();
  node.label = `agent:${agent.agent_name}`;
  node.x = position.x;
  node.y = position.y;
  node.eventMode = 'static';
  node.cursor = 'pointer';
  node.on('pointertap', () => onSelect(agent));

  // B70b: sombra eliptica eliminada (look mas limpio sobre suelos calidos)

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

  // Sprite real (Kenney CC0 hoy, PixelLab.ai mañana) o fallback rect placeholder.
  // B70b: sin plinto gris (mas limpio). Solo sombra + sprite + orb de estado.
  const texture = getAgentTexture(agent.sprite_id);
  if (texture) {
    // Sprite escalado a 48x64 (16x16 -> escalado x3 nearest neighbor para pixel-perfect)
    texture.source.scaleMode = 'nearest';
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.width = w - 8;
    sprite.height = h - 10;
    sprite.x = 0;
    sprite.y = 0;
    // B70b: NO tintamos el sprite por estado. El indicador visual es el
    // orb sobre la cabeza (mas limpio, no enmascara los detalles del sprite).
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

  // B70b: Orb de estado sobre la cabeza (sustituye al halo).
  // Color del orb mas vivo que el de la paleta general (estilo semaforo):
  //   working          -> verde brillante 0x22C55E
  //   waiting_approval -> ambar/naranja 0xF59E0B
  //   failed           -> rojo brillante 0xEF4444
  // Se dibuja en (0,0) y se posiciona el Graphics en (0, orbY) para que
  // el scale anime desde el centro del circulo sin desplazarlo.
  if (orbConfig) {
    const orbColor =
      agent.state === 'working'          ? 0x22c55e :
      agent.state === 'waiting_approval' ? 0xf59e0b :
      agent.state === 'failed'           ? 0xef4444 :
      stateColor;
    const orb = new Graphics();
    const orbRadius = isOrch ? 6 : 5;
    orb
      .circle(0, 0, orbRadius)
      .fill({ color: orbColor, alpha: orbConfig.alpha })
      .stroke({ color: 0x1e1a16, width: 1, alpha: 0.7 });
    orb.label = 'stateOrb';
    orb.x = orbX;
    orb.y = headY;
    (orb as Graphics & { __pulseFreq: number }).__pulseFreq = orbConfig.freq;
    (orb as Graphics & { __baseAlpha: number }).__baseAlpha = orbConfig.alpha;
    node.addChild(orb);
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

  // Badge de notificaciones (aprobaciones pendientes o ejecuciones activas).
  // B70b: posicionado arriba de la cabeza, junto al orb de estado.
  if (hasBadge) {
    const badgeBg = new Graphics();
    badgeBg
      .circle(0, 0, 9)
      .fill({ color: 0xffffff })
      .stroke({ color: 0x000000, width: 1, alpha: 0.6 });
    badgeBg.x = badgeX;
    badgeBg.y = headY;
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
    badgeText.x = badgeX;
    badgeText.y = headY;
    node.addChild(badgeText);
  }

  // B70b: nombre del agente en negro brillante sin placa de fondo.
  // El stroke blanco fino mejora la legibilidad si el sprite cae sobre
  // un suelo mas oscuro (urgency_corridor, taller).
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
  nameLabel.y = h / 2 + 7;
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
 * Texto de la burbuja segun estado del agente.
 * B70 X7 Oficina Viva: si el agente tiene last_action_text reciente
 * (ultimas 2h, viene del view ampliado por migration 073), lo formateamos
 * y lo mostramos en lugar del texto generico. Maximo ~25 chars.
 */
function taskTextForAgent(agent: StudioAgent): string | null {
  // B70b: working ya se indica con el orb verde sobre la cabeza, no
  // necesita burbuja. Solo mostramos texto en waiting (necesita explicar
  // que esperamos aprobacion) y en failed (necesita decir el error).
  if (agent.state === 'waiting_approval') {
    const action = agent.last_action_text;
    if (action) {
      const formatted = formatActionLabel(action);
      if (formatted) return formatted;
    }
    return agent.pending_approvals_count > 1
      ? `Esperando · ${agent.pending_approvals_count}`
      : 'Esperando aprobacion';
  }
  if (agent.state === 'failed') {
    return 'Error en ejecucion';
  }
  return null;
}

/**
 * Formatea el snake_case del campo activity_log.action a algo legible
 * para la burbuja. Ej:
 *   'project_created'      -> 'Proyecto creado'
 *   'briefing_complete'    -> 'Briefing completo'
 *   'design_option_picked' -> 'Diseno elegido'
 *   'rcd_approved'         -> 'RCD aprobado'
 */
function formatActionLabel(action: string): string | null {
  if (!action) return null;
  const trimmed = action.trim().toLowerCase();
  if (!trimmed) return null;

  // Reemplazos especificos para acronimos y terminos comunes
  const replacements: Array<[RegExp, string]> = [
    [/^project_created$/, 'Proyecto creado'],
    [/^briefing_complete$/, 'Briefing completo'],
    [/^design_option_picked$/, 'Diseno elegido'],
    [/^rcd_approved$/, 'RCD aprobado'],
    [/^iee_approved$/, 'IEE aprobado'],
    [/^proposal_sent$/, 'Propuesta enviada'],
    [/^cost_estimate_done$/, 'Coste estimado'],
    [/^trade_request_created$/, 'Encargo a gremio'],
    [/^approval_requested$/, 'Pide aprobacion'],
    [/^approval_granted$/, 'Aprobado'],
  ];
  for (const [re, label] of replacements) {
    if (re.test(trimmed)) return label;
  }

  // Generico: snake_case -> primera letra mayuscula + espacios. Capar a 25 chars.
  const generic = trimmed
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
  return generic.length > 25 ? generic.slice(0, 22) + '...' : generic;
}
