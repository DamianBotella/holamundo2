import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/**
 * PLAN V1.0 Bloque 2 - Banner onboarding municipal.
 *
 * Cuando un proyecto se crea en un municipio que ArquitAI no conoce,
 * `api_projects_create` dispara `agent_normativa_fetch` async. Mig 087
 * tiene `municipal_onboarding_queue` con status running/done/failed.
 *
 * Este banner consulta esa cola filtrando por (tenant_id implicito via RLS,
 * municipio_slug derivado de location_city), pollea cada 5s mientras esta
 * `running`, y muestra el estado al arquitecto en ProjectDetailPage.
 *
 * Auto-hide a los 10s en estado `done` para no molestar.
 */

type Status = 'pending' | 'running' | 'done' | 'failed' | null;

interface OnboardingRow {
  status: Status;
  started_at: string | null;
  completed_at: string | null;
  rules_extracted: number | null;
  error_message: string | null;
}

function citySlug(city: string | null): string {
  if (!city) return '';
  return city
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

export function useMunicipalOnboardingStatus(locationCity: string | null) {
  const [row, setRow] = useState<OnboardingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const slug = citySlug(locationCity);

  useEffect(() => {
    if (!slug) { setRow(null); setLoading(false); return; }
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function fetchRow() {
      const { data, error } = await supabase
        .from('municipal_onboarding_queue')
        .select('status, started_at, completed_at, rules_extracted, error_message')
        .eq('municipio_slug', slug)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) { setRow(null); }
      else { setRow(data as OnboardingRow | null); }
      setLoading(false);
    }

    fetchRow();
    // Polling cada 5s solo si el estado es running (o no conocido aun)
    intervalId = setInterval(() => {
      if (cancelled) return;
      // Si ya esta done/failed, dejar de polear
      if (row && (row.status === 'done' || row.status === 'failed')) {
        if (intervalId) clearInterval(intervalId);
        return;
      }
      fetchRow();
    }, 5000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [slug, row?.status]);

  return {
    row,
    loading,
    isRunning: row?.status === 'running' || row?.status === 'pending',
    isDone: row?.status === 'done',
    isFailed: row?.status === 'failed',
    hasData: !!row,
  };
}

interface BannerProps {
  locationCity: string | null;
}

export function MunicipalOnboardingBanner({ locationCity }: BannerProps) {
  const { row, isRunning, isDone, isFailed, hasData } = useMunicipalOnboardingStatus(locationCity);
  const [hideDone, setHideDone] = useState(false);

  // Auto-hide del estado "done" tras 10s
  useEffect(() => {
    if (isDone && !hideDone) {
      const t = setTimeout(() => setHideDone(true), 10_000);
      return () => clearTimeout(t);
    }
  }, [isDone, hideDone]);

  if (!locationCity) return null;
  if (!hasData) return null;       // Municipio ya conocido, no hay queue entry
  if (isDone && hideDone) return null;

  if (isRunning) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-foxhole-state-waiting/10 border border-foxhole-state-waiting/40">
        <Loader2 className="w-4 h-4 text-foxhole-state-waiting animate-spin flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-mono text-foxhole-state-waiting">
            Cargando la normativa urbanistica de <strong>{locationCity}</strong>...
          </p>
          <p className="text-xs text-foxhole-muted mt-0.5">
            Esto tarda ~30-60 segundos. Mientras tanto puedes seguir trabajando.
          </p>
        </div>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-foxhole-state-working/10 border border-foxhole-state-working/40">
        <CheckCircle2 className="w-4 h-4 text-foxhole-state-working flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-mono text-foxhole-state-working">
            Normativa de <strong>{locationCity}</strong> cargada
            {typeof row?.rules_extracted === 'number' && row.rules_extracted > 0 && (
              <span className="text-foxhole-muted"> ({row.rules_extracted} reglas)</span>
            )}.
            Ya puedes usar el pre-check normativo y consultas RAG.
          </p>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-foxhole-state-failed/10 border border-foxhole-state-failed/40">
        <AlertTriangle className="w-4 h-4 text-foxhole-state-failed flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-mono text-foxhole-state-failed">
            Carga de normativa de <strong>{locationCity}</strong> fallida.
          </p>
          {row?.error_message && (
            <p className="text-xs text-foxhole-muted mt-0.5 font-mono truncate" title={row.error_message}>
              {row.error_message.slice(0, 160)}
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
