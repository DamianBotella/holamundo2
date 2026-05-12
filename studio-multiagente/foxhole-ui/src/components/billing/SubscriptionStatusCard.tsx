import { useMutation } from '@tanstack/react-query';
import { ExternalLink, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import type { BillingSubscription } from '@/lib/types';
import { api } from '@/lib/api';

interface Props {
  subscription: BillingSubscription;
}

function StatusBadge({ status, isTrialing }: { status: string; isTrialing?: boolean }) {
  if (isTrialing) {
    return (
      <span className="foxhole-badge-warning">
        <AlertTriangle className="w-3 h-3" />
        TRIAL
      </span>
    );
  }
  switch (status) {
    case 'active':
      return (
        <span className="foxhole-badge-success">
          <CheckCircle2 className="w-3 h-3" />
          ACTIVO
        </span>
      );
    case 'past_due':
    case 'unpaid':
      return (
        <span className="foxhole-badge-critical">
          <AlertTriangle className="w-3 h-3" />
          PAGO PENDIENTE
        </span>
      );
    case 'canceled':
    case 'incomplete_expired':
      return (
        <span className="foxhole-badge-critical">
          <XCircle className="w-3 h-3" />
          CANCELADA
        </span>
      );
    case 'no_subscription':
      return (
        <span className="foxhole-badge-info">
          <XCircle className="w-3 h-3" />
          SIN SUSCRIPCIÓN
        </span>
      );
    default:
      return <span className="foxhole-badge-info">{status.toUpperCase()}</span>;
  }
}

function fmtTokens(n: number) {
  if (n === -1) return '∞';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function fmtLimit(n: number | undefined) {
  if (n === undefined) return '—';
  return n === -1 ? '∞' : n.toString();
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  if (limit === -1) {
    return (
      <div className="h-1.5 bg-foxhole-surface rounded">
        <div className="h-full bg-foxhole-state-working/40 rounded" style={{ width: '8%' }} />
      </div>
    );
  }
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 90 ? 'bg-foxhole-state-failed' : pct >= 70 ? 'bg-foxhole-state-waiting' : 'bg-foxhole-state-working';
  return (
    <div className="h-1.5 bg-foxhole-surface rounded overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SubscriptionStatusCard({ subscription }: Props) {
  const portalMut = useMutation({
    mutationFn: () => api.billing.portal(),
    onSuccess: (data) => {
      if (data.portal_url) {
        window.location.href = data.portal_url;
      }
    },
  });

  if (!subscription.has_subscription) {
    return (
      <div className="foxhole-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="foxhole-stencil text-lg">SIN SUSCRIPCIÓN ACTIVA</h2>
          <StatusBadge status="no_subscription" />
        </div>
        <p className="text-foxhole-muted text-sm">
          Elige un plan abajo para empezar tu trial de 14 días.
        </p>
      </div>
    );
  }

  const usage = subscription.usage;
  const limits = subscription.limits;
  const isFounder = subscription.tier === 'founder';

  return (
    <div className="foxhole-card p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="foxhole-stencil text-xl">{subscription.plan_name?.toUpperCase() ?? 'PLAN'}</h2>
            <StatusBadge status={subscription.status} isTrialing={subscription.is_trialing} />
          </div>
          <p className="text-foxhole-muted text-sm font-mono">
            {isFounder
              ? 'Plan interno fundador · acceso ilimitado permanente'
              : subscription.price_eur_monthly != null
                ? `${subscription.price_eur_monthly}€/mes`
                : ''}
          </p>
        </div>

        {!isFounder && (
          <button
            onClick={() => portalMut.mutate()}
            disabled={portalMut.isPending}
            className="foxhole-btn foxhole-btn-ghost"
          >
            {portalMut.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ExternalLink className="w-3.5 h-3.5" />
            )}
            Gestionar suscripción
          </button>
        )}
      </div>

      {portalMut.error && (
        <div className="mb-4 p-3 bg-foxhole-state-failed/10 border border-foxhole-state-failed/30 rounded text-xs text-foxhole-state-failed font-mono">
          Error abriendo Customer Portal: {String(portalMut.error)}
        </div>
      )}

      {subscription.is_trialing && subscription.trial_days_left != null && (
        <div className="mb-4 p-3 bg-foxhole-warning/10 border border-foxhole-state-waiting/30 rounded">
          <p className="text-sm text-foxhole-state-waiting font-mono">
            ⏱ Trial activo · {subscription.trial_days_left} día{subscription.trial_days_left === 1 ? '' : 's'} restante{subscription.trial_days_left === 1 ? '' : 's'}
          </p>
          {subscription.trial_ends_at && (
            <p className="text-xs text-foxhole-muted mt-1">
              Expira: {new Date(subscription.trial_ends_at).toLocaleString('es-ES')}
            </p>
          )}
        </div>
      )}

      {usage && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="foxhole-kpi-label">PROYECTOS ACTIVOS</span>
              <span className="text-xs font-mono text-foxhole-fg">
                {usage.projects_active} / {fmtLimit(limits.max_projects)}
              </span>
            </div>
            <UsageBar used={usage.projects_active} limit={limits.max_projects} />
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="foxhole-kpi-label">TOKENS IA / MES</span>
              <span className="text-xs font-mono text-foxhole-fg">
                {fmtTokens(usage.ai_tokens_used_this_month)} / {fmtTokens(limits.max_ai_tokens)}
              </span>
            </div>
            <UsageBar used={usage.ai_tokens_used_this_month} limit={limits.max_ai_tokens} />
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="foxhole-kpi-label">EJECUCIONES / MES</span>
              <span className="text-xs font-mono text-foxhole-fg">
                {usage.agent_executions_this_month} / {fmtLimit(limits.max_agent_executions)}
              </span>
            </div>
            <UsageBar used={usage.agent_executions_this_month} limit={limits.max_agent_executions} />
          </div>
        </div>
      )}

      {subscription.cancel_at_period_end && subscription.current_period_end && (
        <p className="mt-4 text-xs text-foxhole-state-failed font-mono">
          ⚠ La suscripción se cancelará el {new Date(subscription.current_period_end).toLocaleDateString('es-ES')}.
        </p>
      )}
    </div>
  );
}
