import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, MapPin, Wallet, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import type { ProjectSummary } from '@/lib/types';
import type { TimelineEvent } from '@/lib/api';
import { PHASE_LABELS_EXPORT } from '@/components/ProjectCard';
import { ProjectDeliverablesPanel } from '@/components/ProjectDeliverablesPanel';
import { MunicipalOnboardingBanner } from '@/components/MunicipalOnboardingBanner';

interface Props {
  projectId: string;
  onBack: () => void;
  onOpenStudio?: () => void;
}

export function ProjectDetailPage({ projectId, onBack, onOpenStudio }: Props) {
  const { data: project, isLoading } = useQuery<ProjectSummary | null>({
    queryKey: ['project', projectId],
    queryFn: () => api.projectDetail(projectId) as Promise<ProjectSummary | null>,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: api.alerts,
  });
  const projectAlerts = alerts.filter((a) => a.project_id === projectId);

  const { data: timeline = [] } = useQuery<TimelineEvent[]>({
    queryKey: ['timeline', projectId],
    queryFn: () => api.projectTimeline(projectId),
  });

  if (isLoading) {
    return <div className="p-8 text-center text-foxhole-muted">Cargando...</div>;
  }
  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-foxhole-muted mb-4">Proyecto no encontrado</p>
        <button onClick={onBack} className="text-foxhole-accent hover:underline">
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-[1800px] mx-auto flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-foxhole-muted hover:text-foxhole-fg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Mapa global
        </button>
        {onOpenStudio && (
          <button
            onClick={onOpenStudio}
            className="ml-auto foxhole-btn-primary flex items-center gap-1.5 px-3 py-1.5 text-sm"
            title="Abrir el Estudio con este proyecto activo"
          >
            <Layers className="w-3.5 h-3.5" />
            Abrir en Estudio
          </button>
        )}
      </div>

      {/* PLAN V1.0 Bloque 2: banner onboarding municipal */}
      <MunicipalOnboardingBanner locationCity={project.location_city ?? null} />

      <div className="foxhole-card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-medium mb-1">{project.name}</h1>
            <p className="text-foxhole-muted">{project.client_name}</p>
          </div>
          <span className="foxhole-badge-info">
            {PHASE_LABELS_EXPORT[project.current_phase] || project.current_phase}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-foxhole-border">
          <div className="flex items-center gap-2 text-sm">
            <Wallet className="w-4 h-4 text-foxhole-muted" />
            <span className="font-mono">
              {project.budget_target
                ? `€${new Intl.NumberFormat('es-ES').format(project.budget_target)}`
                : '—'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-foxhole-muted" />
            <span>{project.location_city || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-foxhole-warning" />
            <span>
              {project.alerts_count} alert{project.alerts_count !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-sm text-foxhole-muted">
            Status: <span className="text-foxhole-fg">{project.status}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="foxhole-card p-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-foxhole-muted mb-3">
            Alertas del proyecto
          </h2>
          {projectAlerts.length === 0 ? (
            <p className="text-sm text-foxhole-subtle italic">Sin alertas</p>
          ) : (
            <div className="flex flex-col gap-2">
              {projectAlerts.map((a) => (
                <div key={a.id} className="border-l-2 border-foxhole-border pl-3 py-1">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-foxhole-muted">{a.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="foxhole-card p-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-foxhole-muted mb-3">
            Timeline de agentes
          </h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-foxhole-subtle italic">Sin eventos</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {timeline.map((t) => (
                <div key={t.id} className="border-l-2 border-foxhole-border pl-3 py-1">
                  <div className="flex items-center gap-2 text-xs font-mono text-foxhole-muted">
                    <span>{new Date(t.timestamp).toLocaleString('es-ES')}</span>
                    {t.agent_name && (
                      <span className="text-foxhole-accent">{t.agent_name}</span>
                    )}
                    {t.status && (
                      <span
                        className={
                          t.status === 'success'
                            ? 'text-foxhole-success'
                            : t.status === 'failed' || t.status === 'error'
                            ? 'text-foxhole-warning'
                            : 'text-foxhole-muted'
                        }
                      >
                        {t.status}
                      </span>
                    )}
                  </div>
                  {t.action && <div className="text-sm">{t.action}</div>}
                  {t.output_summary && (
                    <div className="text-xs text-foxhole-muted mt-1 line-clamp-2">
                      {t.output_summary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ProjectDeliverablesPanel projectId={projectId} />
    </div>
  );
}
