import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { SubscriptionStatusCard } from '@/components/billing/SubscriptionStatusCard';
import { PlanCard } from '@/components/billing/PlanCard';

interface Props {
  onBack: () => void;
}

type CheckoutResult = 'success' | 'canceled' | null;

export function BillingPage({ onBack }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: api.billing.subscription,
    refetchInterval: (q) => {
      // Si acabamos de volver de Stripe Checkout (success), poll cada 3s
      // hasta detectar la nueva suscripcion (el webhook puede tardar 1-5s).
      const sub = q.state.data?.subscription;
      return sub?.has_subscription && sub.status !== 'no_subscription' ? false : 3000;
    },
  });

  const [postCheckout, setPostCheckout] = useState<CheckoutResult>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get('session_id');
    const canceled = url.searchParams.get('canceled');
    if (sessionId) {
      setPostCheckout('success');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
      // forzar refetch para que el banner trial aparezca con datos nuevos
      void refetch();
    } else if (canceled === 'true') {
      setPostCheckout('canceled');
      url.searchParams.delete('canceled');
      window.history.replaceState({}, '', url.toString());
    }
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-foxhole-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Cargando suscripción...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <button onClick={onBack} className="foxhole-btn foxhole-btn-ghost mb-4">
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver
        </button>
        <div className="foxhole-card p-6 border-foxhole-state-failed/40">
          <h2 className="foxhole-stencil text-lg text-foxhole-state-failed mb-2">
            ERROR CARGANDO BILLING
          </h2>
          <p className="text-foxhole-muted text-sm font-mono">{String(error)}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { subscription, available_plans } = data;
  const proPlan = available_plans.find((p) => p.tier === 'pro');

  return (
    <div className="max-w-6xl mx-auto p-6">
      <button onClick={onBack} className="foxhole-btn foxhole-btn-ghost mb-4">
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver
      </button>

      <header className="mb-6">
        <h1 className="foxhole-stencil text-3xl mb-2">SUSCRIPCIÓN Y FACTURACIÓN</h1>
        <p className="text-foxhole-muted text-sm">
          Gestiona tu plan, método de pago y facturas. Powered by Stripe.
        </p>
      </header>

      {postCheckout === 'success' && (
        <div className="mb-6 p-4 bg-foxhole-state-working/10 border border-foxhole-state-working/40 rounded flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-foxhole-state-working flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-mono text-foxhole-state-working">
              ¡Pago confirmado! Tu suscripción se está activando.
            </p>
            <p className="text-xs text-foxhole-muted mt-1">
              Si no ves los datos al instante, espera 5-10 segundos (el webhook puede tardar).
            </p>
          </div>
        </div>
      )}

      {postCheckout === 'canceled' && (
        <div className="mb-6 p-4 bg-foxhole-state-waiting/10 border border-foxhole-state-waiting/40 rounded flex items-start gap-3">
          <XCircle className="w-5 h-5 text-foxhole-state-waiting flex-shrink-0 mt-0.5" />
          <p className="text-sm font-mono text-foxhole-state-waiting">
            Has cancelado el proceso de pago. Puedes volver a intentarlo cuando quieras.
          </p>
        </div>
      )}

      <div className="mb-8">
        <SubscriptionStatusCard subscription={subscription} />
      </div>

      <h2 className="foxhole-stencil text-xl mb-4">PLANES DISPONIBLES</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {available_plans
          .filter((p) => p.tier !== 'founder')
          .map((p) => (
            <PlanCard key={p.tier} plan={p} highlight={p.tier === 'pro' && p === proPlan} />
          ))}
      </div>

      <footer className="mt-12 text-xs text-foxhole-muted font-mono space-y-1">
        <p>• Todos los planes incluyen trial de 14 días sin cobro automático.</p>
        <p>• Pago seguro con Stripe. Aceptamos tarjetas, Apple Pay, Google Pay, Link y Klarna.</p>
        <p>• Puedes cancelar o cambiar de plan en cualquier momento desde "Gestionar suscripción".</p>
      </footer>
    </div>
  );
}
