import { useState } from 'react';
import type { DoorHotspot as HotspotData } from './hooks/useDoorHotspots';

interface Props {
  hotspot: HotspotData;
  onNavigate: (toRoomId: string) => void;
  /** Si true muestra outline visible para debug. */
  debug?: boolean;
}

const STYLES = {
  hotspot: (size: number, debug: boolean): React.CSSProperties => ({
    position: 'absolute',
    width: size,
    height: size,
    background: debug ? 'rgba(255, 230, 100, 0.18)' : 'transparent',
    border: debug ? '2px dashed rgba(255, 200, 50, 0.7)' : 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    transform: 'translate(-50%, -50%)',
    transition: 'background 120ms ease, transform 120ms ease',
    padding: 0,
    appearance: 'none',
  }),
  hotspotHover: (size: number): React.CSSProperties => ({
    position: 'absolute',
    width: size,
    height: size,
    background: 'rgba(255, 230, 100, 0.32)',
    border: '2px solid rgba(255, 200, 80, 0.85)',
    borderRadius: '50%',
    cursor: 'pointer',
    transform: 'translate(-50%, -50%) scale(1.08)',
    boxShadow: '0 0 24px rgba(255, 200, 80, 0.55)',
    padding: 0,
    appearance: 'none',
  }),
  tooltip: {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(20, 22, 26, 0.95)',
    color: '#f9f5ea',
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'Inter, system-ui, sans-serif',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    border: '1px solid rgba(255, 200, 80, 0.4)',
  } as React.CSSProperties,
};

export function DoorHotspot({ hotspot, onNavigate, debug = false }: Props) {
  const [hover, setHover] = useState(false);
  return (
    <button
      style={{ left: hotspot.x, top: hotspot.y, ...(hover ? STYLES.hotspotHover(hotspot.size) : STYLES.hotspot(hotspot.size, debug)) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onNavigate(hotspot.door.to)}
      aria-label={`Ir a ${hotspot.destName}`}
    >
      {hover && (
        <span style={STYLES.tooltip}>
          → {hotspot.destName}
        </span>
      )}
    </button>
  );
}
