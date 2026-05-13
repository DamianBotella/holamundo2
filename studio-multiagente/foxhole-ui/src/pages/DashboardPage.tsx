import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { DashboardKPIs } from '@/components/DashboardKPIs';
import { PhaseColumnView } from '@/components/PhaseColumnView';
import { ActivityFeed } from '@/components/ActivityFeed';
import { BusinessIntelligence } from '@/components/BusinessIntelligence';

interface Props {
  onProjectClick: (id: string) => void;
  onNewProject: () => void;
}

export function DashboardPage({ onProjectClick, onNewProject }: Props) {
  const [search, setSearch] = useState('');

  const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: api.metrics });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: api.projects });
  const { data: alerts = [] } = useQuery({ queryKey: ['alerts'], queryFn: api.alerts });

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.client_name.toLowerCase().includes(q) ||
        (p.location_city || '').toLowerCase().includes(q),
    );
  }, [projects, search]);

  return (
    <div className="p-4 max-w-[1800px] mx-auto flex flex-col gap-4">
      <DashboardKPIs metrics={metrics} />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foxhole-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyecto, cliente, ciudad..."
            className="w-full bg-foxhole-surface border border-foxhole-border rounded-md pl-9 pr-3 py-2 text-sm placeholder:text-foxhole-muted focus:outline-none focus:border-foxhole-accent transition-colors"
          />
        </div>
        <span className="text-xs font-mono text-foxhole-muted">
          {filtered.length} de {projects.length} proyectos
        </span>
        <button
          onClick={onNewProject}
          className="foxhole-btn-primary flex items-center gap-1.5 px-3 py-2 text-sm ml-auto"
          title="Crear nuevo proyecto"
        >
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div className="foxhole-card p-3">
          <PhaseColumnView projects={filtered} onProjectClick={onProjectClick} />
        </div>
        <ActivityFeed alerts={alerts} />
      </div>

      {/* ADDENDUM 2 Bloque 7 — Inteligencia de Negocio */}
      <BusinessIntelligence />
    </div>
  );
}
