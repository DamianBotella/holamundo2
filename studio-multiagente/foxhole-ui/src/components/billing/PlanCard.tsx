import { useMutation } from '@tanstack/react-query';
import { Check, Loader2, Sparkles } from 'lucide-react';
import type { AvailablePlan } from '@/lib/types';
import { api } from '@/lib/api';

interface Props {
  plan: AvailablePlan;
  highlight?: boolean;
  disabled?: boolean;
  ctaLabel?: string;
}

function fmtLimit(n: number | undefined, suffix = '') {
  if (n === undefined) return '—';
  if (n === -1) return 'Ilimitado';
  return `${n.toLocaleString('es-ES')}${suffix}`;
}

function fmtTokens(n: number | undefined) {
  if (n === undefined) return '—';
  if (n === -1) return 'Ilimitado';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tokens IA`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K tokens IA`;
  return `${n} tokens IA`;
}

const PLAN_DESCRIPTIONS: Record<string, string> = {
  starter: 'Para arquitecto individual que arranca.',
  pro: 'Para arquitecto consolidado o estudio pequeño.',
  equipo: 'Para estudios medianos y grandes.',
};

export function PlanCard({ plan, highlight, disabled, ctaLabel }: Props) {
  const checkoutMut = useMutation({
    mutationFn: () => api.billing.checkout(plan.tier),
    onSuccess: (data) => {
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    },
  });

  const isCurrent = plan.is_current;
  const cta = ctaLabel ?? (isCurrent ? 'Tu plan actual' : `Empezar trial ${plan.trial_days}d`);

  return (
    <div
      className={`foxhole-card p-6 flex flex-col ${highlight ? 'border-foxhole-tan border-2' : ''} ${isCurrent ? 'ring-1 ring-foxhole-accent/40' : ''}`}
    >
      {highlight && (
        <div className="flex items-center gap-1.5 text-foxhole-tan text-[10px] uppercase tracking-[0.2em] font-display font-semibold mb-2">
          <Sparkles className="w-3 h-3" />
          Más popular
        </div>
      )}
      <h3 className="foxhole-stencil text-2xl mb-1">{plan.name.toUpperCase()}</h3>
      <p className="text-foxhole-muted text-xs mb-4">
        {PLAN_DESCRIPTIONS[plan.tier] || ''}
      </p>

      <div className="mb-6">
        <span className="text-4xl font-mono font-medium text-foxhole-bone">
          {plan.price_eur_monthly}€
        </span>
        <span className="text-foxhole-muted text-sm font-mono"> /mes</span>
      </div>

      <ul className="space-y-2 mb-6 flex-1">
        <li className="flex items-start gap-2 text-sm">
          <Check className="w-4 h-4 text-foxhole-state-working mt-0.5 flex-shrink-0" />
          <span className="text-foxhole-fg">
            {fmtLimit(plan.limits.max_projects, ' proyectos simultáneos')}
          </span>
        </li>
        <li className="flex items-start gap-2 text-sm">
          <Check className="w-4 h-4 text-foxhole-state-working mt-0.5 flex-shrink-0" />
          <span className="text-foxhole-fg">{fmtLimit(plan.limits.max_users, ' usuarios')}</span>
        </li>
        <li className="flex items-start gap-2 text-sm">
          <Check className="w-4 h-4 text-foxhole-state-working mt-0.5 flex-shrink-0" />
          <span className="text-foxhole-fg">{fmtTokens(plan.limits.max_ai_tokens)} / mes</span>
        </li>
        <li className="flex items-start gap-2 text-sm">
          <Check className="w-4 h-4 text-foxhole-state-working mt-0.5 flex-shrink-0" />
          <span className="text-foxhole-fg">
            {plan.limits.max_agents === -1 ? 'Todos los agentes' : `${plan.limits.max_agents} agentes`}
          </span>
        </li>
        {plan.limits.support && (
          <li className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-foxhole-state-working mt-0.5 flex-shrink-0" />
            <span className="text-foxhole-fg">
              Soporte: <span className="text-foxhole-muted">{plan.limits.support.replace(/_/g, ' ')}</span>
            </span>
          </li>
        )}
        {plan.features.includes('sso_saml') && (
          <li className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-foxhole-state-working mt-0.5 flex-shrink-0" />
            <span className="text-foxhole-fg">SSO SAML</span>
          </li>
        )}
        {plan.features.includes('multi_arquitecto') && (
          <li className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-foxhole-state-working mt-0.5 flex-shrink-0" />
            <span className="text-foxhole-fg">Multi-arquitecto</span>
          </li>
        )}
      </ul>

      <button
        onClick={() => checkoutMut.mutate()}
        disabled={isCurrent || disabled || checkoutMut.isPending}
        className={`foxhole-btn w-full justify-center ${
          isCurrent
            ? 'foxhole-btn-ghost cursor-not-allowed opacity-60'
            : highlight
              ? 'foxhole-btn-primary'
              : 'foxhole-btn-ghost'
        }`}
      >
        {checkoutMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {cta}
      </button>

      {checkoutMut.error && (
        <p className="mt-2 text-xs text-foxhole-state-failed font-mono">
          {String(checkoutMut.error).slice(0, 120)}
        </p>
      )}
    </div>
  );
}
