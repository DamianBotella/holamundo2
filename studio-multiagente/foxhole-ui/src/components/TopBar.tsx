import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, LogOut, Map } from 'lucide-react';
import { api, isUsingMock } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Props {
  onNavigate: () => void;
  onOpenStudio?: () => void;
  active?: 'dashboard' | 'studio';
}

export function TopBar({ onNavigate, onOpenStudio, active = 'dashboard' }: Props) {
  const { data: profile } = useQuery({ queryKey: ['me'], queryFn: api.me });
  const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: api.metrics });
  const { signOut } = useSession();

  return (
    <header className="sticky top-0 z-10 bg-foxhole-bg/95 backdrop-blur border-b border-foxhole-border">
      <div className="flex items-center gap-6 px-4 py-3 text-sm">
        <button
          onClick={onNavigate}
          className={`flex items-center gap-2 font-mono font-medium transition-colors ${
            active === 'dashboard' ? 'text-foxhole-accent' : 'hover:text-foxhole-accent'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>ARQUITAI</span>
        </button>

        {onOpenStudio && (
          <button
            onClick={onOpenStudio}
            className={`flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
              active === 'studio' ? 'text-foxhole-accent' : 'text-foxhole-muted hover:text-foxhole-fg'
            }`}
            title="Estudio operativo (X7 placeholder)"
          >
            <Map className="w-3.5 h-3.5" />
            Estudio
          </button>
        )}

        <span className="text-foxhole-muted">·</span>
        <span className="text-foxhole-muted">{profile?.tenant_name || '—'}</span>

        {metrics && (
          <>
            <span className="text-foxhole-muted">·</span>
            <span className="font-mono">
              {metrics.active_projects} <span className="text-foxhole-muted">activos</span>
            </span>
            {metrics.critical_alerts > 0 && (
              <span className="foxhole-badge-critical">
                <AlertTriangle className="w-3 h-3" />
                {metrics.critical_alerts} crítico{metrics.critical_alerts > 1 ? 's' : ''}
              </span>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          {isUsingMock && (
            <span className="foxhole-badge-warning text-[10px]">MOCK DATA</span>
          )}
          <span className="text-foxhole-muted">{profile?.full_name || '—'}</span>
          <button
            onClick={() => signOut()}
            className="p-1.5 hover:bg-foxhole-surface rounded transition-colors text-foxhole-muted hover:text-foxhole-fg"
            title="Cerrar sesion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
