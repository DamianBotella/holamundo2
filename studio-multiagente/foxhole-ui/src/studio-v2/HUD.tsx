import { STUDIO_ROOMS } from './rooms';

interface Props {
  activeRoomId: string;
  onNavigate: (roomId: string) => void;
  onOpenMap?: () => void;
  debug: boolean;
  setDebug: (b: boolean) => void;
  spriteAdjust: number;
  setSpriteAdjust: (n: number) => void;
  editorMode: boolean;
  setEditorMode: (b: boolean) => void;
  onExportPositions: () => void;
  onResetPositions: () => void;
}

const styles = {
  hud: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 320,
    background: 'rgba(20, 22, 26, 0.88)',
    color: '#f9f5ea',
    padding: '14px 16px',
    borderRadius: 10,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
    border: '1px solid rgba(255, 200, 80, 0.18)',
    backdropFilter: 'blur(8px)',
    maxHeight: 'calc(100vh - 40px)',
    overflowY: 'auto',
  } as React.CSSProperties,
  title: {
    fontFamily: 'Oswald, sans-serif',
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 4,
    letterSpacing: 0.4,
  } as React.CSSProperties,
  sub: { fontSize: 11, opacity: 0.55, marginBottom: 12 } as React.CSSProperties,
  sep: { height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0' } as React.CSSProperties,
  otherLabel: { fontSize: 11, textTransform: 'uppercase', opacity: 0.55, letterSpacing: 1, marginBottom: 6 } as React.CSSProperties,
  otherList: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px',
    fontSize: 12,
  } as React.CSSProperties,
  otherItem: {
    background: 'none',
    border: 'none',
    color: '#f9f5ea',
    textAlign: 'left' as const,
    padding: '4px 6px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'inherit',
    opacity: 0.78,
  } as React.CSSProperties,
  debugBox: {
    marginTop: 14,
    padding: 8,
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 6,
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
  } as React.CSSProperties,
  editorBox: {
    marginTop: 10,
    padding: 10,
    background: 'rgba(255, 200, 80, 0.07)',
    borderRadius: 6,
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
    border: '1px solid rgba(255, 200, 80, 0.25)',
  } as React.CSSProperties,
  btn: {
    width: '100%',
    padding: '8px 12px',
    background: 'rgba(255, 200, 80, 0.18)',
    color: '#f9f5ea',
    border: '1px solid rgba(255, 200, 80, 0.55)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'inherit',
    marginTop: 6,
  } as React.CSSProperties,
  btnGhost: {
    width: '100%',
    padding: '6px 10px',
    background: 'transparent',
    color: '#f9f5ea',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'inherit',
    marginTop: 6,
    opacity: 0.65,
  } as React.CSSProperties,
};

export function HUD({
  activeRoomId,
  onNavigate,
  debug,
  setDebug,
  spriteAdjust,
  setSpriteAdjust,
  editorMode,
  setEditorMode,
  onExportPositions,
  onResetPositions,
}: Props) {
  const active = STUDIO_ROOMS[activeRoomId];
  const others = Object.values(STUDIO_ROOMS).filter(r => r.id !== activeRoomId);

  return (
    <div style={styles.hud}>
      <div style={styles.title}>📍 {active?.name ?? activeRoomId}</div>
      <div style={styles.sub}>— · sin agentes integrados aún</div>

      <div style={styles.sep} />

      <div style={styles.otherLabel}>Otras salas</div>
      <div style={styles.otherList}>
        {others.map(r => (
          <button
            key={r.id}
            style={styles.otherItem}
            onClick={() => onNavigate(r.id)}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.78')}
            title={`Ir a ${r.name}`}
          >
            {r.name}
          </button>
        ))}
      </div>

      <div style={styles.debugBox}>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Debug hotspots</span>
          <input type="checkbox" checked={debug} onChange={e => setDebug(e.target.checked)} />
        </label>
        <label style={{ display: 'block', marginTop: 6 }}>
          Sprite adjust (tamaño): {spriteAdjust.toFixed(2)}
          <input
            type="range" min={0.5} max={1.8} step={0.05}
            value={spriteAdjust}
            onChange={e => setSpriteAdjust(Number(e.target.value))}
            style={{ width: '100%', marginTop: 2 }}
          />
        </label>
      </div>

      <div style={styles.editorBox}>
        <label
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontWeight: 600,
          }}
        >
          <span>🎯 Position Editor Mode</span>
          <input
            type="checkbox"
            checked={editorMode}
            onChange={e => setEditorMode(e.target.checked)}
          />
        </label>
        {editorMode && (
          <>
            <div style={{ opacity: 0.7, marginTop: 6, lineHeight: 1.45 }}>
              Arrastra cada agente al sitio correcto. Al soltar, su nueva
              posicion se imprime en consola. Cuando termines todas las
              salas, click <b>Export</b> y pega el bloque en
              <br /><code>agents-positions.ts</code>.
            </div>
            <button style={styles.btn} onClick={onExportPositions}>
              📋 Export positions al portapapeles
            </button>
            <button style={styles.btnGhost} onClick={onResetPositions}>
              ↺ Reset a defaults
            </button>
          </>
        )}
      </div>
    </div>
  );
}
