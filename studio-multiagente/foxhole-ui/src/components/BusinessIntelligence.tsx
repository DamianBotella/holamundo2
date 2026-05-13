import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Calendar, BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import type { BICargaRow } from '@/lib/types';

/**
 * ADDENDUM 2 Bloque 7 - Widget de Business Intelligence en el Dashboard
 * principal. Carga 6 metricas en una sola llamada a /bi/dashboard.
 * Stale time 5 min para no saturar.
 */
export function BusinessIntelligence() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['bi-dashboard'],
    queryFn: api.bi.dashboard,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <section className="foxhole-card p-4">
        <h2 className="foxhole-stencil text-sm mb-3 text-foxhole-muted">INTELIGENCIA DE NEGOCIO</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-foxhole-surface/30 rounded animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="foxhole-card p-4 border-foxhole-state-failed/30">
        <h2 className="foxhole-stencil text-sm mb-2 text-foxhole-muted">INTELIGENCIA DE NEGOCIO</h2>
        <p className="text-xs text-foxhole-muted font-mono">
          No disponible. Verifica que las vistas v_bi_* esten creadas y el endpoint /bi/dashboard activo.
        </p>
      </section>
    );
  }

  const conversionUltimo = data.conversion?.[data.conversion.length - 1] ?? null;
  const cargaMax = Math.max(1, ...data.prediccion_carga.map((c) => c.proyectos_activos));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="foxhole-stencil text-sm text-foxhole-muted">INTELIGENCIA DE NEGOCIO</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 1. Rentabilidad por proyecto */}
        <Card title="Proyectos mas rentables" icon={<TrendingUp className="w-3.5 h-3.5" />}>
          {data.rentabilidad.length === 0 ? (
            <Empty>Sin datos de roi_metrics</Empty>
          ) : (
            data.rentabilidad.slice(0, 5).map((p) => (
              <Row
                key={p.project_id}
                label={truncate(p.project_name, 28)}
                value={p.margen_pct != null ? `${p.margen_pct.toFixed(1)} %` : '—'}
                tone={p.margen_pct != null && p.margen_pct < 0 ? 'bad' : undefined}
              />
            ))
          )}
        </Card>

        {/* 2. Tiempo medio por fase (placeholder) */}
        <Card title="Tiempo medio por fase" icon={<Calendar className="w-3.5 h-3.5" />}>
          {data.fases.length === 0 ? (
            <Empty>Historial de fases no modelado todavia</Empty>
          ) : (
            data.fases.map((f) => (
              <Row key={f.phase} label={f.phase} value={`${f.dias_medios} dias`} />
            ))
          )}
        </Card>

        {/* 3. Tasa de conversion (ultimo mes) */}
        <Card title="Conversion (ultimo mes)" icon={<BarChart3 className="w-3.5 h-3.5" />}>
          {!conversionUltimo ? (
            <Empty>Aun sin propuestas enviadas</Empty>
          ) : (
            <>
              <Row label="Aceptadas / Enviadas" value={`${conversionUltimo.aceptadas} / ${conversionUltimo.enviadas}`} />
              <Row label="Tasa" value={`${conversionUltimo.tasa_pct.toFixed(0)} %`} />
            </>
          )}
        </Card>

        {/* 4. Agentes mas activos del mes */}
        <Card title="Agentes mas activos del mes" icon={<Activity className="w-3.5 h-3.5" />}>
          {data.agentes_activos_mes.length === 0 ? (
            <Empty>Sin actividad este mes</Empty>
          ) : (
            data.agentes_activos_mes.slice(0, 6).map((a) => (
              <Row key={a.agent_name} label={a.agent_name} value={String(a.ejecuciones)} />
            ))
          )}
        </Card>

        {/* 5. Alertas de desviacion presupuestaria > 15 % */}
        <Card title="Alertas presupuestarias (>15 %)" icon={<AlertTriangle className="w-3.5 h-3.5" />} tone="warn">
          {data.alertas_presupuesto.length === 0 ? (
            <p className="text-xs text-foxhole-state-working font-mono">Todo en rango ✓</p>
          ) : (
            data.alertas_presupuesto.slice(0, 5).map((a) => (
              <Row key={a.project_id} label={truncate(a.name, 28)} value={`+${a.desviacion_pct.toFixed(1)} %`} tone="bad" />
            ))
          )}
        </Card>

        {/* 6. Carga prevista (proximas 4 semanas) */}
        <Card title="Carga prevista (4 semanas)" icon={<TrendingDown className="w-3.5 h-3.5" />}>
          {data.prediccion_carga.length === 0 ? (
            <Empty>Sin proyectos con fecha estimada</Empty>
          ) : (
            <Sparkline rows={data.prediccion_carga} max={cargaMax} />
          )}
        </Card>
      </div>
    </section>
  );
}

function Card({
  title,
  icon,
  children,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: 'warn';
}) {
  return (
    <div
      className={`foxhole-card p-3 flex flex-col gap-1.5 ${
        tone === 'warn' ? 'border-foxhole-state-waiting/30' : ''
      }`}
    >
      <header className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-foxhole-muted mb-1">
        {icon}
        {title}
      </header>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  const valueColor = tone === 'bad' ? 'text-foxhole-state-failed' : 'text-foxhole-bone';
  return (
    <div className="flex items-center justify-between text-[11px] font-mono">
      <span className="text-foxhole-muted truncate flex-1">{label}</span>
      <span className={`${valueColor} flex-shrink-0 ml-2 tabular-nums`}>{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-foxhole-muted/70 italic font-mono">{children}</p>;
}

function truncate(s: string, n: number) {
  if (!s) return '—';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/**
 * Sparkline SVG simple (sin libs externas) para la prediccion de carga.
 * Pinta una linea + puntos sobre las N semanas. ~50 lineas.
 */
function Sparkline({ rows, max }: { rows: BICargaRow[]; max: number }) {
  if (rows.length === 0) return null;
  const W = 220;
  const H = 70;
  const pad = 6;
  const dx = (W - pad * 2) / Math.max(1, rows.length - 1);
  const points = rows.map((r, i) => ({
    x: pad + i * dx,
    y: H - pad - (r.proyectos_activos / max) * (H - pad * 2),
    label: r.proyectos_activos,
    week: r.semana_iso,
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
        <path d={path} fill="none" stroke="#84BC9C" strokeWidth="1.5" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.5" fill="#84BC9C" />
            <text
              x={p.x}
              y={p.y - 6}
              textAnchor="middle"
              fontSize="8"
              fontFamily="JetBrains Mono, monospace"
              fill="#A89880"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex justify-between text-[9px] font-mono text-foxhole-muted/70">
        <span>Hoy</span>
        <span>+30 dias</span>
      </div>
    </div>
  );
}
