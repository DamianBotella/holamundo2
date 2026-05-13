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
      const handler = (_t: Ticker) => {
        const layer = studio.layers.agents;
        const t = performance.now() / 1000;
        const ringAlpha = 0.45 + Math.sin(t * 5) * 0.45;
        for (const node of layer.children) {
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
              const phase = Math.sin(t * freq);
              orb.alpha = base * (0.55 + 0.45 * phase);
              orb.scale.set(1 + 0.22 * phase);
            }
          }
          const ring = (node as Container).children?.find(
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

  // 3) Render agents en posicion segun ESTADO (B72-rediseno PASO 4):
  //   working           -> su mesa (default_position)
  //   waiting_approval  -> su mesa (orb amarillo pulsante indica espera)
  //   idle              -> seat en terraza-cafe (asignado por indice estable)
  //   failed            -> pos en corredor de urgencias
  //   working+meeting   -> seat alrededor mesa de reuniones (si comparten proyecto)
  // Sin animacion todavia: el agente se renderiza en destino directamente.
  useEffect(() => {
    if (!pixiReady) return;
    const studio = getStudio();
    if (!studio || agents.length === 0 || rooms.length === 0) return;
    const roomMap = new Map<string, StudioRoom>();
    for (const r of rooms) roomMap.set(r.room_id, r);
    studio.layers.agents.removeChildren();

    const { meetingNames } = detectMeetingAgents(agents);

    // Indice estable por nombre alfabetico para asignar seats deterministicamente
    const sortedAgents = [...agents].sort((a, b) =>
      a.agent_name.localeCompare(b.agent_name),
    );

    const placed = sortedAgents
      .map((a, i) => {
        const pos = getAgentWorldPosition(a, i, roomMap, meetingNames);
        if (!pos) return null;
        const iso = worldToIso(pos.x, pos.y);
        return { a, wx: pos.x, wy: pos.y, iso, z: isoZIndexFromWorld(pos.x, pos.y) };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((p, q) => p.z - q.z);

    for (const { a, iso } of placed) {
      drawAgent(studio.layers.agents, {
        agent: a,
        position: { x: iso.x, y: iso.y },
        isSelected: selectedAgentName === a.agent_name,
        onSelect: onSelectAgent,
      });
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
