import type { ProjectSummary, ProjectPhase } from '@/lib/types';
import { ProjectCard, PHASE_LABELS_EXPORT } from './ProjectCard';

interface Props {
  projects: ProjectSummary[];
  onProjectClick: (id: string) => void;
}

const PHASE_ORDER: ProjectPhase[] = [
  'intake',
  'briefing_done',
  'design_done',
  'analysis_done',
  'costs_done',
  'trades_done',
  'proposal_done',
  'approved',
  'planning_done',
];

export function PhaseColumnView({ projects, onProjectClick }: Props) {
  const byPhase = projects.reduce<Record<string, ProjectSummary[]>>((acc, p) => {
    (acc[p.current_phase] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {PHASE_ORDER.map((phase) => {
        const items = byPhase[phase] || [];
        return (
          <div key={phase} className="flex-shrink-0 w-[260px] flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-mono uppercase tracking-wider text-foxhole-muted">
                {PHASE_LABELS_EXPORT[phase]}
              </span>
              <span className="text-xs font-mono text-foxhole-subtle">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.length === 0 ? (
                <div className="foxhole-card p-4 text-xs text-foxhole-subtle text-center italic">
                  vacío
                </div>
              ) : (
                items.map((p) => (
                  <ProjectCard key={p.id} project={p} onClick={() => onProjectClick(p.id)} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
