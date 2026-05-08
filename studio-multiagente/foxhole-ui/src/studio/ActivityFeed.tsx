import { Radio } from 'lucide-react';
import { useActivityFeed } from './hooks/useActivityFeed';

const STATUS_COLOR: Record<string, string> = {
  success: 'text-foxhole-state-working',
  error:   'text-foxhole-state-failed',
  warning: 'text-foxhole-state-waiting',
  skipped: 'text-foxhole-bone-dim',
};

function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.floor((now - d) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/**
 * Activity feed lateral del estudio (ticker en vivo del activity_log).
 * Spec sec 6.6: panel 320px, fondo papel envejecido, tipografia mono,
 * polling cada 3s desde /api/v1/studio/feed.
 */
export function ActivityFeed() {
  const { data: events = [], isLoading } = useActivityFeed(30);

  return (
    <div className="foxhole-corner p-3 flex flex-col gap-2 h-full">
      <div className="flex items-center gap-2 px-1">
        <Radio className="w-3.5 h-3.5 text-foxhole-state-working animate-pulse" />
        <h2 className="foxhole-stencil text-[11px]">Actividad en vivo</h2>
        <span className="ml-auto text-[10px] font-mono text-foxhole-muted">
          {events.length}
        </span>
      </div>
      <div className="foxhole-divider" />

      {isLoading && events.length === 0 ? (
        <p className="text-xs text-foxhole-muted italic px-1">Cargando feed...</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-foxhole-muted italic px-1">Sin actividad reciente.</p>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-y-auto pr-1 -mr-1 flex-1 min-h-0">
          {events.map((e) => (
            <article
              key={e.id}
              className="border-l-2 border-foxhole-border-strong pl-2 py-0.5 hover:bg-foxhole-surface-2/30 transition-colors"
            >
              <div className="flex items-baseline gap-1.5 text-[10px] font-mono">
                <span className="text-foxhole-tan">{formatRelative(e.timestamp)}</span>
                <span className="text-foxhole-muted truncate flex-1">{e.agent_name}</span>
                <span
                  className={`uppercase tracking-wider ${
                    STATUS_COLOR[e.status] ?? 'text-foxhole-bone-dim'
                  }`}
                >
                  {e.status}
                </span>
              </div>
              <div className="text-[11px] text-foxhole-bone leading-snug truncate">
                {e.action}
              </div>
              {e.output_summary && (
                <div className="text-[10px] text-foxhole-muted italic line-clamp-2 mt-0.5">
                  {e.output_summary}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
