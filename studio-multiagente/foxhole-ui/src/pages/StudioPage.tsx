import { ArrowLeft, Construction } from 'lucide-react';

interface Props {
  onBack: () => void;
}

/**
 * ADDENDUM 2 — Estudio temporalmente apagado.
 *
 * Decision Damian (sesion 2026-05-13): pospones toda la UI del estudio
 * (figuras vectoriales, fondos Gemini iso, sidebar de actividad natural,
 * panel de coordinacion) hasta el final del addendum. Mientras tanto el
 * backend (Bloques 3-INSERTs, 4-directiva, 5-normativa_fetch, 6-RAG, 7-BI)
 * avanza sin tocar este archivo.
 *
 * La implementacion previa esta intacta en git history (commits 24b91d7
 * para el visual Kenney + tarima funcional). Para reactivarla cuando
 * llegue el momento: revertir este commit y rehacer el wrapper Pixi sobre
 * los archivos que se han ido dejando en disco (AgentFigure.ts, fondos
 * Gemini en assets/rooms/, scripts/generate_room_backgrounds.mjs).
 */
export function StudioPage({ onBack }: Props) {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 gap-6 bg-black">
      <button
        onClick={onBack}
        className="absolute top-4 left-4 flex items-center gap-2 text-sm text-foxhole-muted hover:text-foxhole-bone transition-colors font-mono uppercase tracking-wider"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <Construction className="w-16 h-16 text-foxhole-muted opacity-50" />
      <div className="text-center max-w-md">
        <h1 className="foxhole-stencil text-2xl mb-3 text-foxhole-bone">
          ESTUDIO TEMPORALMENTE EN REDISENO
        </h1>
        <p className="text-foxhole-muted text-sm font-mono leading-relaxed">
          La vista isometrica del estudio esta pausada mientras se completan
          las funciones de backend del ADDENDUM 2 (normativa automatica,
          RAG de PGOU, directivas a agentes, dashboard de inteligencia de
          negocio).
        </p>
        <p className="text-foxhole-muted text-xs font-mono mt-4 opacity-60">
          Vuelve al Dashboard y abre cualquier proyecto para ver el
          estado actual de los agentes.
        </p>
      </div>
    </div>
  );
}
