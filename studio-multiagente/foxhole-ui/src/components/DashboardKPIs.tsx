import type { DashboardMetrics } from '@/lib/types';

interface Props {
  metrics: DashboardMetrics | undefined;
}

const formatEUR = (n: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n);
const formatUSD = (n: number) => `$${n.toFixed(2)}`;

export function DashboardKPIs({ metrics }: Props) {
  const items = [
    { label: 'Activos', value: metrics?.active_projects ?? '—', sub: 'proyectos' },
    {
      label: 'Alertas',
      value: metrics?.critical_alerts ?? '—',
      sub: 'críticas',
      tone: (metrics?.critical_alerts ?? 0) > 0 ? 'danger' : undefined,
    },
    {
      label: 'Aprobaciones',
      value: metrics?.pending_approvals ?? '—',
      sub: 'pendientes',
      tone: (metrics?.pending_approvals ?? 0) > 0 ? 'warning' : undefined,
    },
    {
      label: 'Pipeline',
      value: metrics ? `€${formatEUR(metrics.revenue_pipeline_eur)}` : '—',
      sub: 'estimado',
    },
    {
      label: 'Coste LLM',
      value: metrics ? formatUSD(metrics.llm_cost_mtd_usd) : '—',
      sub: 'mes en curso',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((it) => (
        <div key={it.label} className="foxhole-kpi">
          <span className="foxhole-kpi-label">{it.label}</span>
          <span
            className={`foxhole-kpi-value ${
              it.tone === 'danger'
                ? 'text-foxhole-danger'
                : it.tone === 'warning'
                  ? 'text-foxhole-warning'
                  : ''
            }`}
          >
            {it.value}
          </span>
          <span className="text-xs text-foxhole-muted">{it.sub}</span>
        </div>
      ))}
    </div>
  );
}
