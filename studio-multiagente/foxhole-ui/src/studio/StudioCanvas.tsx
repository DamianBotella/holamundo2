import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { Container, Graphics, Ticker } from 'pixi.js';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { StudioAgent, StudioRoom } from '@/lib/types';
import { PALETTE } from './palette';
import { acquireStudio, releaseStudio, getStudio } from './pixiSingleton';
import { drawRoom } from './StudioRoom';
import { drawAgent } from './StudioAgent';
import { drawFurnitureForRoom } from './StudioFurniture';
import {
  detectMeetingAgents,
  getAgentTargetWorldPosition,
  getDefaultWorldPosition,
} from './agentTargets';
import { AGENT_WALK_SPEED, ARRIVAL_THRESHOLD } from './data/agentPositions';

// Custom properties que adjuntamos a cada Container de agente para animar
// movimiento con interpolacion en el ticker.
interface AnimatedAgentNode extends Container {
  __agentName?: string;
  __stateKey?: string;        // hash de (state + selected) para redibujar al cambiar
  __currentWX?: number;       // posicion world actual (animada)
  __currentWY?: number;
  __targetWX?: number;        // posicion world destino
  __targetWY?: number;
}
import {
  WORLD_W,
  WORLD_H,
  ISO_WORLD,
  ISO_OFFSET,
  worldToIso,
  compareRoomsIso,
  isoZIndexFromWorld,
} from './iso';

interface Props {
  rooms: StudioRoom[];
  agents: StudioAgent[];
  selectedAgentName: string | null;
  onSelectAgent: (a: StudioAgent) => void;
  loading?: boolean;
}

// Tamano efectivo del world tras la proyeccion iso (con offset aplicado)
const ISO_W = ISO_WORLD.width;   // ~1720
const ISO_H = ISO_WORLD.height;  // ~860
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.15;

function parseHex(css: string): number {
  const c = css.startsWith('#') ? css.slice(1) : css;
  return parseInt(c, 16);
}

/**
 * Pan/zoom propio: aplicamos scale + position al Container `world`
 * en vez de usar pixi-viewport (descartado por causar pantalla negra).
 */
export function StudioCanvas({
  rooms,
  agents,
  selectedAgentName,
  onSelectAgent,
  loading = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pixiReady, setPixiReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ mx: 0, my: 0, tx: 0, ty: 0 });
  const tickerHandlerRef = useRef<((t: Ticker) => void) | null>(null);

  // 1) Init singleton + adjuntar canvas
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const studio = await acquireStudio({
        width: WORLD_W,
        height: WORLD_H,
        background: parseHex(PALETTE.bgCanvas),
      });
      if (cancelled) return;

      const host = containerRef.current;
      const canvas = studio.app.canvas;
      if (host) {
        if (canvas.parentElement && canvas.parentElement !== host) {
          canvas.parentElement.removeChild(canvas);
        }
        if (canvas.parentElement !== host) {
          host.appendChild(canvas);
        }
      }

      // Ticker para orb de estado pulsante y selection ring (B70b).
      // Cada orb guarda __pulseFreq y __baseAlpha. El ticker:
      //   - Pulsa alpha:  base * (0.5 + 0.5*sin(t*freq))
      //   - Pulsa scale:  1.0 + 0.20*sin(t*freq)  (efecto "latido")
      //   working  freq=2pi*0.6 -> respiracion ~1.6s
      //   waiting  freq=2pi*1.0 -> parpadeo 1s (1 Hz docu Opus)
      //   failed   freq=0       -> alpha y scale estaticos
      // Selection ring sigue con frecuencia ~0.8 Hz ambar parpadeante.
      const handler = (t: Ticker) => {
        const layer = studio.layers.agents;
        const tSec = performance.now() / 1000;
        const ringAlpha = 0.45 + Math.sin(tSec * 5) * 0.45;
        // dt en segundos. Pixi v8 ticker: t.deltaMS es ms desde ultimo frame.
        const dt = t.deltaMS / 1000;
        for (const node of layer.children) {
          // ===== B72 Paso 2: interpolacion world current -> target =====
          const an = node as AnimatedAgentNode;
          if (
            an.__currentWX != null &&
            an.__currentWY != null &&
            an.__targetWX != null &&
            an.__targetWY != null
          ) {
            const dx = an.__targetWX - an.__currentWX;
            const dy = an.__targetWY - an.__currentWY;
            const dist = Math.hypot(dx, dy);
            if (dist > ARRIVAL_THRESHOLD) {
              const step = Math.min(AGENT_WALK_SPEED * dt, dist);
              an.__currentWX += (dx / dist) * step;
              an.__currentWY += (dy / dist) * step;
            } else {
              an.__currentWX = an.__targetWX;
              an.__currentWY = an.__targetWY;
            }
            // Proyectar a iso y aplicar al nodo
            const iso = worldToIso(an.__currentWX, an.__currentWY);
            an.x = iso.x;
            an.y = iso.y;
            an.zIndex = isoZIndexFromWorld(an.__currentWX, an.__currentWY);
          }

          // ===== Pulso de orb + ring (existente) =====
          const orb = (node as Container).children?.find(
            (c) => (c as Graphics).label === 'stateOrb',
          ) as (Graphics & { __pulseFreq?: number; __baseAlpha?: number }) | undefined;
          if (orb) {
            const freq = orb.__pulseFreq ?? 2 * Math.PI * 0.8;
            const base = orb.__baseAlpha ?? 0.95;
            if (freq === 0) {
              orb.alpha = base;
              orb.scale.set(1);
            } else {
              const phase = Math.sin(tSec * freq);
              orb.alpha = base * (0.55 + 0.45 * phase);
              orb.scale.set(1 + 0.22 * phase);
            }
          }
          const ring = (node as Container).children?.find(
            (c) => (c as Graphics).label === 'selectionRing',
          ) as Graphics | undefined;
          if (ring) ring.alpha = ringAlpha;
        }
        // Re-sortear z-order para que agentes mas al sur queden delante
        layer.sortableChildren = true;
      };
      studio.app.ticker.add(handler);
      tickerHandlerRef.current = handler;

      setPixiReady(true);
    })();

    return () => {
      cancelled = true;
      const studio = getStudio();
      if (studio && tickerHandlerRef.current) {
        try {
          studio.app.ticker.remove(tickerHandlerRef.current);
        } catch {
          /* ignore */
        }
      }
      tickerHandlerRef.current = null;
      releaseStudio();
    };
  }, []);

  // 2) Render rooms (z-orden iso: las del fondo primero)
  useEffect(() => {
    if (!pixiReady) return;
    const studio = getStudio();
    if (!studio || rooms.length === 0) return;
    studio.layers.rooms.removeChildren();
    const ordered = [...rooms].sort(compareRoomsIso);
    for (const r of ordered) drawRoom(studio.layers.rooms, r);
  }, [pixiReady, rooms]);

  // 2b) Render mobiliario por habitacion (B72). Capa propia entre rooms y
  // agents. Fallback a rect placeholder si el PNG aun no esta generado.
  useEffect(() => {
    if (!pixiReady) return;
    const studio = getStudio();
    if (!studio || rooms.length === 0) return;
    studio.layers.furniture.removeChildren();
    for (const r of rooms) drawFurnitureForRoom(studio.layers.furniture, r);
  }, [pixiReady, rooms]);

  // 3) Render agents — B72 Paso 2: nodos persistentes que se mueven al
  // cambiar de estado. El ticker (effect 1) interpola current -> target.
  //
  // - Si el agente es nuevo: se crea en su target world position (sin animar).
  // - Si ya existe y cambio state/selected: redibujar (destroy + create) en
  //   su current world position, conservando la animacion en curso.
  // - Si solo cambio el target (transicion idle/working/meeting/failed):
  //   actualizar __targetWX/Y y dejar que el ticker interpole.
  useEffect(() => {
    if (!pixiReady) return;
    const studio = getStudio();
    if (!studio || agents.length === 0 || rooms.length === 0) return;
    const roomMap = new Map<string, StudioRoom>();
    for (const r of rooms) roomMap.set(r.room_id, r);

    const layer = studio.layers.agents;

    // Detectar reuniones (2+ agentes working compartiendo proyecto)
    const { meetingNames } = detectMeetingAgents(agents);

    // Indice por nombre para asignacion estable de IDLE/MEETING positions
    const sortedAgents = [...agents].sort((a, b) => a.agent_name.localeCompare(b.agent_name));

    // Map current children por agent_name para reuso/cleanup
    const existing = new Map<string, AnimatedAgentNode>();
    for (const c of layer.children) {
      const n = c as AnimatedAgentNode;
      if (n.__agentName) existing.set(n.__agentName, n);
    }

    const seen = new Set<string>();

    for (let i = 0; i < sortedAgents.length; i++) {
      const a = sortedAgents[i];
      seen.add(a.agent_name);

      const target =
        getAgentTargetWorldPosition(a, i, roomMap, meetingNames) ??
        getDefaultWorldPosition(a, roomMap);
      if (!target) continue;

      const stateKey = `${a.state}|${selectedAgentName === a.agent_name ? '1' : '0'}`;

      const prev = existing.get(a.agent_name);
      let node: AnimatedAgentNode;

      if (prev && prev.__stateKey === stateKey) {
        // Mismo state: solo actualizar target. El ticker animara.
        node = prev;
      } else {
        // Nuevo o cambio de state: redibujar. Posicion inicial = current si
        // existia, o target si es agente nuevo.
        const currentWX = prev?.__currentWX ?? target.x;
        const currentWY = prev?.__currentWY ?? target.y;
        const initialIso = worldToIso(currentWX, currentWY);

        if (prev) {
          layer.removeChild(prev);
          prev.destroy({ children: true });
        }

        const created = drawAgent(layer, {
          agent: a,
          position: { x: initialIso.x, y: initialIso.y },
          isSelected: selectedAgentName === a.agent_name,
          onSelect: onSelectAgent,
        }) as AnimatedAgentNode;

        created.__currentWX = currentWX;
        created.__currentWY = currentWY;
        node = created;
      }

      node.__agentName = a.agent_name;
      node.__stateKey = stateKey;
      node.__targetWX = target.x;
      node.__targetWY = target.y;
    }

    // Eliminar nodos de agentes que ya no estan (filtros, swap de tenant, etc.)
    for (const [name, n] of existing) {
      if (!seen.has(name)) {
        layer.removeChild(n);
        n.destroy({ children: true });
      }
    }
  }, [pixiReady, rooms, agents, selectedAgentName, onSelectAgent]);

  // 4) Aplicar zoom y pan al world (con offset iso para coords X negativas)
  useEffect(() => {
    if (!pixiReady) return;
    const studio = getStudio();
    if (!studio) return;
    studio.world.scale.set(zoom);
    // pan controla la traslacion del wrapper world; el offset iso se suma para
    // que las coords iso (que pueden ser negativas) caigan dentro del canvas.
    studio.world.position.set(pan.x + ISO_OFFSET.x * zoom, pan.y + ISO_OFFSET.y * zoom);
  }, [pixiReady, zoom, pan]);

  // 5) Resize observer + auto-fit al tamano iso del world
  useEffect(() => {
    if (!pixiReady) return;
    const host = containerRef.current;
    if (!host) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      const w = Math.max(400, Math.floor(e.contentRect.width));
      const h = Math.max(300, Math.floor(e.contentRect.height));
      const studio = getStudio();
      if (!studio) return;
      studio.app.renderer.resize(w, h);
      // Re-fit con dimensiones iso
      const sx = w / ISO_W;
      const sy = h / ISO_H;
      const s = Math.min(sx, sy) * 0.96;
      setZoom(s);
      setPan({ x: (w - ISO_W * s) / 2, y: (h - ISO_H * s) / 2 });
    });
    obs.observe(host);
    return () => obs.disconnect();
  }, [pixiReady]);

  // Handlers de pan/zoom (sobre el div host)
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    const factor = Math.exp(delta);
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
    if (newZoom === zoom) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      setZoom(newZoom);
      return;
    }
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const wx = (cx - pan.x) / zoom;
    const wy = (cy - pan.y) / zoom;
    setZoom(newZoom);
    setPan({ x: cx - wx * newZoom, y: cy - wy * newZoom });
  };

  const onMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 1 && !(e.button === 0 && e.shiftKey)) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = { mx: e.clientX, my: e.clientY, tx: pan.x, ty: pan.y };
  };
  const onMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    const { mx, my, tx, ty } = panStart.current;
    setPan({ x: tx + (e.clientX - mx), y: ty + (e.clientY - my) });
  };
  const onMouseUp = () => { if (isPanning) setIsPanning(false); };

  const fitView = () => {
    const host = containerRef.current;
    if (!host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    const sx = w / ISO_W;
    const sy = h / ISO_H;
    const s = Math.min(sx, sy) * 0.96;
    setZoom(s);
    setPan({ x: (w - ISO_W * s) / 2, y: (h - ISO_H * s) / 2 });
  };

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));

  const showLoading = useMemo(
    () => loading && rooms.length === 0 && agents.length === 0,
    [loading, rooms.length, agents.length],
  );

  const cursorStyle: CSSProperties = { cursor: isPanning ? 'grabbing' : 'default' };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={zoomOut} className="foxhole-btn-ghost p-1.5" title="Zoom out">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button onClick={zoomIn} className="foxhole-btn-ghost p-1.5" title="Zoom in">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button onClick={fitView} className="foxhole-btn-ghost" title="Ajustar al mapa">
          <Maximize2 className="w-3 h-3" />
          Ajustar
        </button>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-wider text-foxhole-muted">
          zoom {zoom.toFixed(2)}x · clic central / shift+clic = pan · rueda = zoom
        </span>
      </div>

      <div
        ref={containerRef}
        className="overflow-hidden relative select-none flex-1"
        style={{ background: PALETTE.bgCanvas, ...cursorStyle }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {!pixiReady && (
          <div className="absolute inset-0 flex items-center justify-center text-foxhole-muted text-xs font-mono pointer-events-none z-10">
            Inicializando canvas Pixi v8...
          </div>
        )}
        {pixiReady && rooms.length === 0 && !showLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-foxhole-muted text-xs font-mono pointer-events-none z-10">
            Sin habitaciones (verifica migracion 056 aplicada)
          </div>
        )}
      </div>
    </div>
  );
}
