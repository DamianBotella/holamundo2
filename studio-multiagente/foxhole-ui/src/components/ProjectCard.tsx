import type { ProjectSummary } from '@/lib/types';
import { AlertTriangle, MapPin } from 'lucide-react';

interface Props {
  project: ProjectSummary;
  onClick: () => void;
}

const PHASE_LABELS: Record<string, string> = {
  intake: 'Intake',
  briefing_done: 'Briefing',
  design_done: 'Diseño',
  analysis_done: 'Normativa',
  costs_done: 'Costes',
  trades_done: 'Oficios',
  proposal_done: 'Propuesta',
  approved: 'Aprobado',
  planning_done: 'Plan',
  completed: 'Completado',
  archived: 'Archivado',
};

function daysAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days}d`;
}

export function ProjectCard({ project, onClick }: Props) {
  const isCritical = project.alerts_count > 1;
  const isWarning = project.alerts_count > 0 || project.pending_approvals_count > 0;

  return (
    <button
      onClick={onClick}
      className="foxhole-card-hover w-full text-left p-3 flex flex-col gap-2 min-h-[140px]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm leading-tight truncate flex-1">{project.name}</h3>
        {isCritical && (
          <AlertTriangle className="w-4 h-4 text-foxhole-danger shrink-0" />
        )}
        {!isCritical && isWarning && (
          <AlertTriangle className="w-4 h-4 text-foxhole-warning shrink-0" />
        )}
      </div>

      <div className="text-xs text-foxhole-muted truncate">{project.client_name}</div>

      <div className="flex flex-wrap gap-1 mt-auto">
        {project.alerts_count > 0 && (
          <span className={isCritical ? 'foxhole-badge-critical' : 'foxhole-badge-warning'}>
            {project.alerts_count} alert{project.alerts_count > 1 ? 's' : ''}
          </span>
        )}
        {project.pending_approvals_count > 0 && (
          <span className="foxhole-badge-info">
            {project.pending_approvals_count} approv
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs font-mono text-foxhole-muted pt-1 border-t border-foxhole-border">
        <span>
          {project.budget_target
            ? `€${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(project.budget_target)}`
            : '—'}
        </span>
        {project.location_city && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {project.location_city}
          </span>
        )}
        <span>{daysAgo(project.updated_at)}</span>
      </div>
    </button>
  );
}

export const PHASE_LABELS_EXPORT = PHASE_LABELS;
