import { useEffect, useRef, useState } from 'react';

interface Props {
  text: string;
  onClose: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
  backdropFilter: 'blur(4px)',
};

const modalStyle: React.CSSProperties = {
  width: 'min(820px, 92vw)',
  maxHeight: '88vh',
  background: '#16181c',
  color: '#f9f5ea',
  borderRadius: 12,
  padding: 22,
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  border: '1px solid rgba(255, 200, 80, 0.4)',
  fontFamily: 'Inter, system-ui, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const textareaStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 360,
  width: '100%',
  background: '#0f1115',
  color: '#f9f5ea',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: 14,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 12.5,
  lineHeight: 1.55,
  resize: 'vertical',
  outline: 'none',
};

const btn = (primary: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  background: primary ? 'rgba(255, 200, 80, 0.22)' : 'transparent',
  color: '#f9f5ea',
  border: primary ? '1px solid rgba(255, 200, 80, 0.7)' : '1px solid rgba(255,255,255,0.2)',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 1,
});

export function PositionsExportModal({ text, onClose }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  // Selecciona todo el contenido al abrir (Ctrl+C copia de un toque)
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    ta.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('ok');
      setTimeout(() => setCopyStatus('idle'), 2500);
    } catch {
      // Fallback: select + document.execCommand('copy') deprecated pero aun funciona en localhost
      const ta = taRef.current;
      if (ta) {
        ta.focus();
        ta.select();
        try {
          const ok = document.execCommand('copy');
          setCopyStatus(ok ? 'ok' : 'err');
          setTimeout(() => setCopyStatus('idle'), 2500);
        } catch {
          setCopyStatus('err');
        }
      }
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agents-positions-export.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h3 style={{ margin: 0, fontFamily: 'Oswald, sans-serif', fontSize: 20, letterSpacing: 0.5 }}>
            Bloque AGENT_POSITIONS exportado
          </h3>
          <button onClick={onClose} style={{ ...btn(false), padding: '4px 10px' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
          El textarea ya está <b>seleccionado entero</b>. Pulsa{' '}
          <kbd style={{ background: '#2a2d33', padding: '1px 6px', borderRadius: 3 }}>Ctrl+C</kbd>{' '}
          para copiar al portapapeles, o pega directamente en el chat con Claude.<br />
          Tambien puedes descargarlo como .txt o copiar via el boton.
        </div>
        <textarea
          ref={taRef}
          value={text}
          readOnly
          spellCheck={false}
          style={textareaStyle}
          onClick={e => (e.currentTarget as HTMLTextAreaElement).select()}
        />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
          {copyStatus === 'ok' && (
            <span style={{ color: '#86efac', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
              ✓ Copiado
            </span>
          )}
          {copyStatus === 'err' && (
            <span style={{ color: '#fca5a5', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
              Clipboard bloqueado — usa Ctrl+C
            </span>
          )}
          <button style={btn(false)} onClick={handleDownload}>⬇ Descargar .txt</button>
          <button style={btn(true)} onClick={handleCopy}>📋 Copiar</button>
        </div>
      </div>
    </div>
  );
}
