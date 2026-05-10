import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { Container, Graphics, Ticker } from 'pixi.js';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { StudioAgent, StudioRoom } from '@/lib/types';
import { PALETTE } from './palette';
import { acquireStudio, releaseStudio, getStudio } from './pixiSingleton';
import { drawRoom } from './StudioRoom';
import { drawAgent } from './StudioAgent';
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

      // Ticker para halos pulsantes y selection ring (B70 X7 Oficina Viva).
      // Cada halo guarda su __pulseFreq y __baseAlpha en drawAgent. El ticker
      // multiplica baseAlpha por (0.5 + 0.5*sin(t*freq)) para que pulse:
      //   working  freq=2pi*0.6 -> "respiracion" cada ~1.6s
      //   waiting  freq=2pi*1.0 -> parpadeo cada 1s (1 Hz docu Opus)
      //   failed   freq=0       -> alpha estatica (rojo fijo)
      // Selection ring sigue con frecuencia ~0.8 Hz ambar parpadeante.
      const handler = (_t: Ticker) => {
        const layer = studio.layers.agents;
        const t = performance.now() / 1000;
        const ringAlpha = 0.45 + Math.sin(t * 5) * 0.45;
        for (const node of layer.children) {
          const halo = (node as Container).children?.find(
            (c) => (c as Graphics).label === 'halo',
          ) as (Graphics & { __pulseFreq?: number; __baseAlpha?: number }) | undefined;
          if (halo) {
            const freq = halo.__pulseFreq ?? 2 * Math.PI * 0.8;
            const base = halo.__baseAlpha ?? 0.18;
            halo.alpha = freq === 0 ? base : base * (0.5 + 0.5 * Math.sin(t * freq));
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

  // 3) Render agents (z-orden iso por (worldX + worldY) — fondo primero)
  useEffect(() => {
    if (!pixiReady) return;
    const studio = getStudio();
    if (!studio || agents.length === 0 || rooms.length === 0) return;
    const roomMap = new Map<string, StudioRoom>();
    for (const r of rooms) roomMap.set(r.room_id, r);
    studio.layers.agents.removeChildren();

    const placed = agents
      .map((a) => {
        const room = roomMap.get(a.room_id);
        if (!room) return null;
        const wx = room.bounding_box.x + a.default_position.x;
        const wy = room.bounding_box.y + a.default_position.y;
        const iso = worldToIso(wx, wy);
        return { a, wx, wy, iso, z: isoZIndexFromWorld(wx, wy) };
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
