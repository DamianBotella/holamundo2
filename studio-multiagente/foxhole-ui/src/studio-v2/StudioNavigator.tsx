import { useCallback, useState } from 'react';
import { STUDIO_ROOMS } from './rooms';
import { RoomView } from './RoomView';
import { HUD } from './HUD';
import { useTransition } from './hooks/useTransition';
import { AGENT_POSITIONS, formatPositionsBlock } from './agents/agents-positions';
import type { AgentPosition } from './agents/agents-positions';
import { PositionsExportModal } from './agents/PositionsExportModal';

const INITIAL_ROOM = 'reception';
const FADE_MS = 150;

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background:
    'radial-gradient(circle at 50% 30%, #f5ead8 0%, #d9c9b3 35%, #6b6259 80%, #2a2622 100%)',
  overflow: 'hidden',
  fontFamily: 'Inter, system-ui, sans-serif',
};

export function StudioNavigator() {
  const [activeRoomId, setActiveRoomId] = useState<string>(INITIAL_ROOM);
  const { phase, startTransition } = useTransition(FADE_MS);
  const [debug, setDebug] = useState(false);
  // Slider HUD: ahora es solo escala de TAMANO del sprite (1.0 default)
  const [spriteAdjust, setSpriteAdjust] = useState(1.0);

  // Estado de posiciones (parte del archivo estatico, se muta con el editor)
  const [positions, setPositions] = useState<Record<string, AgentPosition>>(
    () => ({ ...AGENT_POSITIONS }),
  );
  const [editorMode, setEditorMode] = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);

  const room = STUDIO_ROOMS[activeRoomId];
  if (!room) {
    return <div style={{ color: '#fff', padding: 40 }}>Sala desconocida: {activeRoomId}</div>;
  }

  const navigateToRoom = (toRoomId: string) => {
    if (toRoomId === activeRoomId) return;
    if (!STUDIO_ROOMS[toRoomId]) return;
    startTransition(() => setActiveRoomId(toRoomId));
  };

  const handlePositionCommit = useCallback((agentId: string, nx: number, ny: number) => {
    setPositions(prev => ({ ...prev, [agentId]: { nx, ny } }));
  }, []);

  const handleExportPositions = useCallback(() => {
    const block = formatPositionsBlock(positions);
    console.log('[studio-v2] AGENT_POSITIONS export:\n' + block);
    setExportText(block);
  }, [positions]);

  const handleResetPositions = useCallback(() => {
    if (!confirm('Resetear todas las posiciones a los valores del archivo?')) return;
    setPositions({ ...AGENT_POSITIONS });
  }, []);

  const fadeOpacity = phase === 'fading-out' ? 0 : 1;

  return (
    <div style={containerStyle}>
      <RoomView
        room={room}
        onNavigate={navigateToRoom}
        fadeOpacity={fadeOpacity}
        debugHotspots={debug}
        spriteAdjust={spriteAdjust}
        positions={positions}
        editorMode={editorMode}
        onPositionCommit={handlePositionCommit}
      />
      <HUD
        activeRoomId={activeRoomId}
        onNavigate={navigateToRoom}
        debug={debug}
        setDebug={setDebug}
        spriteAdjust={spriteAdjust}
        setSpriteAdjust={setSpriteAdjust}
        editorMode={editorMode}
        setEditorMode={setEditorMode}
        onExportPositions={handleExportPositions}
        onResetPositions={handleResetPositions}
      />
      {exportText !== null && (
        <PositionsExportModal text={exportText} onClose={() => setExportText(null)} />
      )}
    </div>
  );
}
