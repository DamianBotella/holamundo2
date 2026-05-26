import { ArrowLeft } from 'lucide-react';
import { StudioNavigator } from '../studio-v2/StudioNavigator';

interface Props {
  onBack: () => void;
}

/**
 * Studio activo — modo Camino A (navegacion sala-a-sala estilo Habbo).
 *
 * Monta el StudioNavigator de studio-v2 con sus 11 PNGs limpios por rembg,
 * los 39 agentes (sprites archetypicos), HUD con lista de salas y
 * navegacion por click en puertas. Mantiene el boton Volver al Dashboard.
 *
 * Decision (2026-05-21): se activa el studio en la propia ruta /#studio.
 * Antes mostraba "ESTUDIO TEMPORALMENTE EN REDISENO" como placeholder
 * mientras avanzaba el backend del ADDENDUM 2 — ya completado.
 */
export function StudioPage({ onBack }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <StudioNavigator />
      <button
        onClick={onBack}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 1000,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: 'rgba(20, 22, 26, 0.85)',
          color: '#f9f5ea',
          border: '1px solid rgba(255, 200, 80, 0.4)',
          borderRadius: 8,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>
    </div>
  );
}
