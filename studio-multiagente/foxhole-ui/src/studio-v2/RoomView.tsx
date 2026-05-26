import { useEffect, useRef, useState } from 'react';
import type { RoomDef } from './types';
import { STUDIO_ROOMS } from './rooms';
import { DoorHotspot } from './DoorHotspot';
import { useCanvasSize, computeRoomFitScale } from './hooks/useRoomScale';
import { useDoorHotspots } from './hooks/useDoorHotspots';
import { AgentsLayer } from './agents/AgentsLayer';
import type { AgentPosition } from './agents/agents-positions';

interface Props {
  room: RoomDef;
  onNavigate: (toRoomId: string) => void;
  fadeOpacity: number;
  debugHotspots?: boolean;
  spriteAdjust?: number;
  /** Estado de posiciones (controlado por StudioNavigator). */
  positions: Record<string, AgentPosition>;
  editorMode: boolean;
  onPositionCommit: (agentId: string, nx: number, ny: number) => void;
}

function useImageSize(src: string) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    setSize(null);
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setSize(null);
    img.src = src;
    return () => { img.onload = null; img.onerror = null; };
  }, [src]);
  return size;
}

export function RoomView({
  room,
  onNavigate,
  fadeOpacity,
  debugHotspots = false,
  spriteAdjust = 0.6,
  positions,
  editorMode,
  onPositionCommit,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvas = useCanvasSize(containerRef);

  const pngSrc = `/assets/rooms/${room.id}.png`;
  const imgSize = useImageSize(pngSrc);
  const imgW = imgSize?.w ?? 0;
  const imgH = imgSize?.h ?? 0;

  const fitScale = computeRoomFitScale(imgW, imgH, canvas, 0.9);

  // Hotspots de puertas (siguen usando la proyeccion iso original)
  const hotspots = useDoorHotspots(room, imgW, imgH, fitScale, canvas, STUDIO_ROOMS, spriteAdjust);

  const drawW = imgW * fitScale;
  const drawH = imgH * fitScale;
  // Bbox del PNG dentro del canvas (anchor centro)
  const roomPngLeft = (canvas.w - drawW) / 2;
  const roomPngTop = (canvas.h - drawH) / 2;
  const roomPng = { left: roomPngLeft, top: roomPngTop, width: drawW, height: drawH };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        opacity: fadeOpacity,
        transition: 'opacity 150ms ease',
      }}
    >
      {imgSize && (
        <img
          src={pngSrc}
          alt={room.name}
          draggable={false}
          style={{
            position: 'absolute',
            left: roomPngLeft,
            top: roomPngTop,
            width: drawW,
            height: drawH,
            pointerEvents: 'none',
            userSelect: 'none',
            filter: 'drop-shadow(0 18px 40px rgba(0,0,0,0.45))',
          }}
        />
      )}

      <AgentsLayer
        activeRoomId={room.id}
        roomPng={roomPng}
        sizeScale={spriteAdjust}
        positions={positions}
        editorMode={editorMode}
        onPositionCommit={onPositionCommit}
      />

      {hotspots.map((h, i) => (
        <DoorHotspot
          key={room.id + '_door_' + i + '_' + h.door.to + '_' + h.door.tile.x + 'x' + h.door.tile.y}
          hotspot={h}
          onNavigate={onNavigate}
          debug={debugHotspots}
        />
      ))}
    </div>
  );
}
