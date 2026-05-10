import { useQuery } from '@tanstack/react-query';
import { Briefcase } from 'lucide-react';
import { api } from '@/lib/api';
import type { ProjectSummary } from '@/lib/types';

interface Props {
  activeProjectId: string | null;
  onChange: (id: string | null) => void;
}

/**
 * Selector de proyecto activo del Studio (B70 X7 Oficina Viva).
 * Lista los proyectos no archivados del tenant (activos + recientes).
 * El proyecto activo se propaga a:
 *   - AgentChatPanel (chat contextual filtrado)
 *   - badges/feed (filtrado opcional por proyecto)
 */
export function ProjectSelector({ activeProjectId, onChange }: Props) {
  const { data: projects = [] } = useQuery<ProjectSummary[]>({
    queryKey: ['projects'],
    queryFn: api.projects,
    staleTime: 60 * 1000,
  });

  const ordered = [...projects]
    .filter((p) => p.status !== 'completed')
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  return (
    <div className="flex items-center gap-2">
      <Briefcase className="w-3.5 h-3.5 text-foxhole-muted" />
      <span className="text-[10px] font-mono uppercase tracking-wider text-foxhole-muted">
        Proyecto activo
      </span>
      <select
        value={activeProjectId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="bg-foxhole-surface border border-foxhole-border rounded px-2 py-1 text-xs text-foxhole-bone focus:outline-none focus:border-foxhole-tan"
        style={{ minWidth: 220 }}
      >
        <option value="">— Sin proyecto activo —</option>
        {ordered.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} {p.location_city ? `· ${p.location_city}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
