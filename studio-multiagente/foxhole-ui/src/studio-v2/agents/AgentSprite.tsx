import { useRef, useState } from 'react';
import type { AgentDef, AgentRuntime } from './agents-registry';
import type { AgentPosition } from './agents-positions';
import { AgentTooltip } from './AgentTooltip';

interface Props {
  agent: AgentDef;
  runtime: AgentRuntime;
  /** Posicion normalizada (nx, ny) actual del agente en el PNG de la sala. */
  position: AgentPosition;
  /** Bbox del PNG dentro del canvas (calculado por RoomView). */
  roomPng: { left: number; top: number; width: number; height: number };
  /** Escala global (slider del HUD) — solo afecta tamano, no posicion. */
  sizeScale: number;
  /** Bobbing global en px. */
  bobbingPhase: number;
  /** Modo editor activo? muestra handle visual + permite drag. */
  editorMode: boolean;
  /** Callback al terminar un drag. */
  onPositionCommit: (id: string, nx: number, ny: number) => void;
}

// 18% de la altura del PNG (figura humana proporcional, no gigante)
const BASE_SPRITE_HEIGHT_PCT = 0.18;

export function AgentSprite({
  agent,
  runtime,
  position,
  roomPng,
  sizeScale,
  bobbingPhase,
  editorMode,
  onPositionCommit,
}: Props) {
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Estado local DURANTE el drag para feedback instantaneo sin esperar al parent
  const [livePos, setLivePos] = useState<AgentPosition | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);

  const effectivePos = livePos ?? position;

  // Posicion en pantalla calculada desde (nx, ny) y el bbox del PNG
  const screenX = roomPng.left + effectivePos.nx * roomPng.width;
  const screenY = roomPng.top + effectivePos.ny * roomPng.height;

  // Tamano del sprite: 18% de la altura del PNG * sizeScale (slider HUD)
  const spriteH = roomPng.height * BASE_SPRITE_HEIGHT_PCT * sizeScale;

  // Disco bajo los pies
  const discW = spriteH * 0.33;
  const discH = discW * 0.28;

  const isWorking = runtime.state === 'working';
  const bobOffset = isWorking && !dragging ? bobbingPhase : 0;

  // ===== DRAG handlers (solo activos en editorMode) =====
  const onPointerDown = (e: React.PointerEvent) => {
    if (!editorMode) return;
    e.stopPropagation();
    setDragging(true);
    elRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    e.stopPropagation();
    // Convierte clientX/clientY a (nx, ny) dentro del PNG
    const rawNx = (e.clientX - roomPng.left) / roomPng.width;
    const rawNy = (e.clientY - roomPng.top) / roomPng.height;
    const nx = Math.max(0, Math.min(1, rawNx));
    const ny = Math.max(0, Math.min(1, rawNy));
    setLivePos({ nx, ny });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    e.stopPropagation();
    setDragging(false);
    elRef.current?.releasePointerCapture(e.pointerId);
    const final = livePos ?? position;
    console.log(`  ${agent.id}: { nx: ${final.nx.toFixed(2)}, ny: ${final.ny.toFixed(2)} },`);
    onPositionCommit(agent.id, final.nx, final.ny);
    setLivePos(null);
  };

  return (
    <div
      ref={elRef}
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY,
        // Anchor: bottom-center (pies del agente)
        transform: `translate(-50%, -100%) translateY(${bobOffset}px)`,
        zIndex: 100 + Math.round(effectivePos.ny * 1000),
        pointerEvents: 'auto',
        cursor: editorMode ? (dragging ? 'grabbing' : 'grab') : 'pointer',
        touchAction: 'none',
      }}
      onMouseEnter={() => !editorMode && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Handle visual del editor: circulo punteado around */}
      {editorMode && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -8,
            transform: 'translateX(-50%)',
            width: spriteH * 0.7,
            height: spriteH + 16,
            border: dragging
              ? `2px solid ${agent.color}`
              : `2px dashed ${agent.color}aa`,
            borderRadius: 12,
            pointerEvents: 'none',
            boxShadow: dragging ? `0 0 18px ${agent.color}88` : 'none',
          }}
        />
      )}

      {/* Disco de color bajo los pies */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -4,
          width: discW,
          height: discH,
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${agent.color}cc 0%, ${agent.color}66 45%, transparent 75%)`,
          opacity: 0.85,
          filter: 'blur(0.6px)',
          pointerEvents: 'none',
        }}
      />

      {/* Sprite del archetype */}
      <img
        src={`/assets/agents/archetypes/${agent.archetype}.png`}
        alt={agent.displayName}
        draggable={false}
        style={{
          display: 'block',
          height: spriteH,
          width: 'auto',
          userSelect: 'none',
          pointerEvents: 'none',
          filter:
            'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' +
            (hover && !editorMode ? ` drop-shadow(0 0 6px ${agent.color}aa)` : ''),
          transition: 'filter 120ms ease',
        }}
      />

      {hover && !editorMode && <AgentTooltip agent={agent} state={runtime.state} />}

      {/* Etiqueta con nx,ny actuales durante drag */}
      {editorMode && (dragging || hover) && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(20,22,26,0.95)',
            color: '#f9f5ea',
            padding: '4px 8px',
            borderRadius: 4,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10.5,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            border: `1px solid ${agent.color}66`,
          }}
        >
          {agent.id} · {effectivePos.nx.toFixed(2)}, {effectivePos.ny.toFixed(2)}
        </div>
      )}
    </div>
  );
}
