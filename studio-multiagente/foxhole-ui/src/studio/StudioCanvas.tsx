import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import type { Container, Graphics, Ticker } from 'pixi.js';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { StudioAgent, StudioRoom } from '@/lib/types';
import { PALETTE } from './palette';
import { acquireStudio, releaseStudio, getStudio } from './pixiSingleton';
import { drawRoom } from './StudioRoom';
// ADDENDUM 2 Bloque 1: drawAgent (sprites Kenney en StudioAgent.tsx) sustituido
// por drawAgentFigure (figuras vectoriales) via alias para reversibilidad
// trivial (cambiar el import si hay que revertir). StudioAgent.tsx se queda en
// el repo pendiente de OK visual antes de borrar.
import { drawAgentFigure as drawAgent } from './AgentFigure';
import { drawFurnitureForRoom } from './StudioFurniture';
import { drawWallsForRoom } from './drawRoomWalls';
import { detectMeetingAgents, getAgentWorldPosition } from './agentPosition';
import { AGENT_WALK_SPEED, ARRIVAL_THRESHOLD } from './data/agentPositions';
import {
  WORLD_W,
  WORLD_H,
  ISO_WORLD,
  ISO_OFFSET,
  worldToIso,
  compareRoomsIso,
  isoZIndexFromWorld,
} from './iso';

// ADDENDUM 2 Bloque 2: tipo de Container con metadata de tweening + estado.
// El ticker lee __targetX/Y para interpolar y __prevState para saber si hay
// que re-dibujar la figura (cambio de estado -> halo distinto).
type AgentNode = Container & {
  __agentName: string;
  __targetX: number;
  __targetY: number;
  __prevState: StudioAgent['state'];
  __prevSelected: boolean;
};

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

      // Ticker (B70b orb pulsante + B72-mov tweening + bobbing).
      //
      // 1) Orb de estado: pulsa alpha + scale segun __pulseFreq/__baseAlpha.
      // 2) Selection ring: parpadeo ambar ~0.8 Hz.
      // 3) ADDENDUM 2 Bloque 2 — Tweening hacia __target a AGENT_WALK_SPEED
      //    en world units/seg. Cuando dist <= ARRIVAL_THRESHOLD: snap + stop
      //    bobbing. Cuando dist > umbral: marca __bobBody en figureBody.
      // 4) ADDENDUM 2 Bloque 2 — Bobbing: figureBody.y oscila +/-2px a ~5 Hz
      //    senoidal mientras __bobBody = true.
      const handler = (tick: Ticker) => {
        const layer = studio.layers.agents;
        const t = performance.now() / 1000;
        const ringAlpha = 0.45 + Math.sin(t * 5) * 0.45;
        // Pixi v8: deltaMS es el tiempo real del frame (clamp a 100ms por si
        // hubo pausa de pestania o GC pico).
        const dtSec = Math.min(tick.deltaMS ?? 16.67, 100) / 1000;

        for (const child of layer.children) {
          const node = child as AgentNode;

          // (3) Tweening del nodo hacia su target en world iso
          if (
            typeof node.__targetX === 'number' &&
            typeof node.__targetY === 'number'
          ) {
            const dx = node.__targetX - node.x;
            const dy = node.__targetY - node.y;
            const dist = Math.hypot(dx, dy);
            // Encontrar figureBody para activar/desactivar el bob
            const figure = (node.children?.find(
              (c) => (c as Container).label === 'figureBody',
            ) as (Container & { __bobBody?: boolean; __baseY?: number }) | undefined);

            if (dist <= ARRIVAL_THRESHOLD) {
              node.x = node.__targetX;
              node.y = node.__targetY;
              if (figure) {
                figure.__bobBody = false;
                figure.y = figure.__baseY ?? 0;
              }
            } else {
              // En iso el eje Y aparece comprimido a la mitad => velocidad
              // visual mas natural si avanzamos en pantalla a AGENT_WALK_SPEED.
              const step = AGENT_WALK_SPEED * dtSec;
              const ratio = Math.min(1, step / dist);
              node.x += dx * ratio;
              node.y += dy * ratio;
              if (figure) figure.__bobBody = true;
            }

            // (4) Bobbing: oscilar figure.y +/-2px @ 5 Hz si moviendo
            if (figure?.__bobBody) {
              const baseY = figure.__baseY ?? 0;
              figure.y = baseY + Math.sin(t * 2 * Math.PI * 5) * 2;
            }
          }

          // (1) Orb pulsante
          const orb = node.children?.find(
            (c) => (c as Graphics).label === 'stateOrb',
          ) as (Graphics & { __pulseFreq?: number; __baseAlpha?: number }) | undefined;
          if (orb) {
            const freq = orb.__pulseFreq ?? 2 * Math.PI * 0.8;
            const base = orb.__baseAlpha ?? 0.95;
            if (freq === 0) {
              orb.alpha = base;
              orb.scale.set(1);
            } else {
              const phase = Math.sin(t * freq);
              orb.alpha = base * (0.55 + 0.45 * phase);
              orb.scale.set(1 + 0.22 * phase);
            }
          }
          // (2) Selection ring parpadeante
          const ring = node.children?.find(
            (c) => (c as Graphics).label === 'selectionRing',
          ) as Graphics | undefined;
          if (ring) ring.alpha = ringAlpha;
        }
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
  // Defensivo: si layers.furniture no existe (singleton de version anterior
  // por HMR), saltamos sin crashear.
  useEffect(() => {
    if (!pixiReady) return;
    const studio = getStudio();
    if (!studio || rooms.length === 0) return;
    const furnLayer = studio.layers.furniture;
    if (!furnLayer) return;
    furnLayer.removeChildren();
    for (const r of rooms) drawFurnitureForRoom(furnLayer, r);
  }, [pixiReady, rooms]);

  // 2c) Render paredes traseras NW + NE de cada sala (B72-rediseno cutaway).
  // Dan la sensacion de habitacion real en lugar de rombo plano. Capa propia
  // entre furniture y agents para que muebles del fondo queden ocultos por
  // la pared y agentes/muebles del frente queden delante.
  useEffect(() => {
    if (!pixiReady) return;
    const studio = getStudio();
    if (!studio || rooms.length === 0) return;
    const wallsLayer = studio.layers.walls;
    if (!wallsLayer) return;
    wallsLayer.removeChildren();
    for (const r of rooms) drawWallsForRoom(wallsLayer, r);
  }, [pixiReady, rooms]);

  // ADDENDUM 2 Bloque 2 — Render agents con Map estable in-place:
  //   - Si el nodo existe y el state no cambio -> solo actualizar __targetX/Y
  //     (el ticker anima el tweening).
  //   - Si el state cambio (o isSelected) -> destruir el container y recrear
  //     en la posicion ACTUAL (no en el target), preservando la animacion en
  //     curso. Set new __targetX/Y para que siga animando hacia el destino.
  //   - Si el agente desaparece de la lista -> destroy y remove del map.
  //
  //   Estado -> posicion (definido por getAgentWorldPosition):
  //     working sin reunion / waiting_approval / idle <5min -> su mesa
  //     working en reunion (2+ agentes mismo project)        -> meeting_room
  //     idle >5min con historia                              -> IDLE_POSITIONS
  //     failed                                                -> urgency_corridor
  const agentNodesRef = useRef<Map<string, AgentNode>>(new Map());

  useEffect(() => {
    if (!pixiReady) return;
    const studio = getStudio();
    if (!studio || agents.length === 0 || rooms.length === 0) return;
    const roomMap = new Map<string, StudioRoom>();
    for (const r of rooms) roomMap.set(r.room_id, r);

    const { meetingNames } = detectMeetingAgents(agents);
    const sortedAgents = [...agents].sort((a, b) =>
      a.agent_name.localeCompare(b.agent_name),
    );

    // Calcular target iso para cada agente.
    const targets = new Map<string, { iso: { x: number; y: number }; z: number }>();
    sortedAgents.forEach((a, i) => {
      const pos = getAgentWorldPosition(a, i, roomMap, meetingNames);
      if (!pos) return;
      const iso = worldToIso(pos.x, pos.y);
      targets.set(a.agent_name, { iso, z: isoZIndexFromWorld(pos.x, pos.y) });
    });

    const map = agentNodesRef.current;
    const seen = new Set<string>();

    for (const a of sortedAgents) {
      const tgt = targets.get(a.agent_name);
      if (!tgt) continue;
      seen.add(a.agent_name);
      const isSelected = selectedAgentName === a.agent_name;
      let node = map.get(a.agent_name);

      const stateChanged   = node && node.__prevState   !== a.state;
      const selectionFlip  = node && node.__prevSelected !== isSelected;

      if (node && (stateChanged || selectionFlip)) {
        // Destruir y recrear preservando la posicion actual del nodo viejo
        // (asi la animacion arranca desde donde estaba, no salta al target).
        const currentX = node.x;
        const currentY = node.y;
        studio.layers.agents.removeChild(node);
        node.destroy({ children: true });
        node = undefined;
        // Crear nuevo y arrancarlo en currentX/currentY (el ticker movera al target)
        drawAgent(studio.layers.agents, {
          agent: a,
          position: { x: currentX, y: currentY },
          isSelected,
          onSelect: onSelectAgent,
        });
        // Pixi.addChild devuelve el ultimo hijo agregado a la layer.
        node = studio.layers.agents.children[
          studio.layers.agents.children.length - 1
        ] as AgentNode;
      }

      if (!node) {
        // Primera vez: snap directamente al target (no animar desde 0,0)
        drawAgent(studio.layers.agents, {
          agent: a,
          position: { x: tgt.iso.x, y: tgt.iso.y },
          isSelected,
          onSelect: onSelectAgent,
        });
        node = studio.layers.agents.children[
          studio.layers.agents.children.length - 1
        ] as AgentNode;
      }

      node.__agentName    = a.agent_name;
      node.__targetX      = tgt.iso.x;
      node.__targetY      = tgt.iso.y;
      node.__prevState    = a.state;
      node.__prevSelected = isSelected;
      node.zIndex         = tgt.z;
      map.set(a.agent_name, node);
    }

    // Destruir nodos de agentes que ya no estan en la lista
    for (const [name, node] of map) {
      if (!seen.has(name)) {
        studio.layers.agents.removeChild(node);
        node.destroy({ children: true });
        map.delete(name);
      }
    }

    // Sort children por zIndex iso (manualmente, los agent layers no usan
    // sortableChildren por defecto en este singleton).
    studio.layers.agents.children.sort(
      (a, b) => (a as AgentNode).zIndex - (b as AgentNode).zIndex,
    );
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

  // Handlers de pan/zoom (sobre el div host).
  // Wheel: React 18+ adjunta onWheel como passive listener por defecto, lo
  // que prohibe e.preventDefault() (warning ruidoso en console). Lo
  // adjuntamos manualmente con { passive: false } via useEffect mas abajo.
  // Usamos un ref para que el handler tenga acceso a zoom/pan actuales.
  const wheelStateRef = useRef({ zoom, pan });
  wheelStateRef.current = { zoom, pan };

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: z, pan: p } = wheelStateRef.current;
      const delta = -e.deltaY * 0.0015;
      const factor = Math.exp(delta);
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * factor));
      if (newZoom === z) return;
      const rect = host.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const wx = (cx - p.x) / z;
      const wy = (cy - p.y) / z;
      setZoom(newZoom);
      setPan({ x: cx - wx * newZoom, y: cy - wy * newZoom });
    };
    host.addEventListener('wheel', handleWheel, { passive: false });
    return () => host.removeEventListener('wheel', handleWheel);
  }, []);

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
