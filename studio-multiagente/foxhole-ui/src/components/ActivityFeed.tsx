import type { Alert } from '@/lib/types';
import { AlertTriangle, FileQuestion, MailWarning, XCircle } from 'lucide-react';

interface Props {
  alerts: Alert[];
}

const ICONS: Record<Alert['type'], typeof AlertTriangle> = {
  agent_failure: XCircle,
  approval_pending: MailWarning,
  consultation: FileQuestion,
  regulatory_warning: AlertTriangle,
};

const SEVERITY_COLORS: Record<Alert['severity'], string> = {
  critical: 'text-foxhole-danger',
  warning: 'text-foxhole-warning',
  info: 'text-foxhole-info',
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('es-ES', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function ActivityFeed({ alerts }: Props) {
  return (
    <div className="foxhole-card p-4">
      <h3 className="text-xs font-mono uppercase tracking-wider text-foxhole-muted mb-3">
        Actividad reciente
      </h3>
      <div className="flex flex-col">
        {alerts.length === 0 ? (
          <p className="text-sm text-foxhole-subtle italic">Sin alertas activas</p>
        ) : (
          alerts.slice(0, 8).map((a) => {
            const Icon = ICONS[a.type];
            return (
              <div
                key={a.id}
                className="flex items-start gap-3 py-2 border-b border-foxhole-border last:border-0"
              >
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${SEVERITY_COLORS[a.severity]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium truncate">{a.title}</span>
                    <span className="text-xs font-mono text-foxhole-muted shrink-0">
                      {formatTime(a.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-foxhole-muted truncate">{a.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
