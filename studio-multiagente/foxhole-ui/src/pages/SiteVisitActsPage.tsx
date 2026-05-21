import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileSignature, Loader2, X, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { formatError } from '@/lib/errors';

interface SiteVisitAct {
  id: string;
  tenant_id: string;
  project_id: string;
  visit_date: string;
  audio_url: string | null;
  audio_duration_seconds: number | null;
  transcript_raw: string | null;
  transcript_categorized: unknown;
  observations: Array<{
    gremio?: string;
    texto?: string;
    tipo?: string;
    fotos_referenciadas?: string[];
  }> | null;
  photos: Array<{ url: string; caption?: string }> | null;
  acuerdos: string | null;
  proxima_visita_prevista: string | null;
  pdf_url: string | null;
  status: 'draft' | 'approved' | 'signed';
  approved_at: string | null;
  signed_at: string | null;
  created_at: string;
}

interface ActWithProject extends SiteVisitAct {
  project_name: string | null;
}

type StatusFilter = 'all' | 'draft' | 'approved' | 'signed';

interface Props {
  onBack: () => void;
}

function statusBadge(status: SiteVisitAct['status']) {
  if (status === 'draft') return <span className="foxhole-badge-warning">DRAFT</span>;
  if (status === 'approved') return <span className="foxhole-badge-info">APROBADA</span>;
  return <span className="foxhole-badge-success">FIRMADA</span>;
}

function truncate(s: string | null | undefined, max = 80): string {
  if (!s) return '—';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function SiteVisitActsPage({ onBack }: Props) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [openAct, setOpenAct] = useState<ActWithProject | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: acts = [], isLoading, error, refetch, isFetching } = useQuery<ActWithProject[]>({
    queryKey: ['site_visit_acts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_visit_acts')
        .select('*')
        .order('visit_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data || []) as SiteVisitAct[];
      const projectIds = Array.from(new Set(rows.map((r) => r.project_id).filter(Boolean)));
      const nameMap = new Map<string, string>();
      if (projectIds.length > 0) {
        const { data: projs, error: pErr } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIds);
        if (!pErr && projs) {
          for (const p of projs as Array<{ id: string; name: string }>) nameMap.set(p.id, p.name);
        }
      }
      return rows.map((r) => ({ ...r, project_name: nameMap.get(r.project_id) ?? null }));
    },
  });

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of acts) {
      if (a.project_id && a.project_name) map.set(a.project_id, a.project_name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [acts]);

  const filtered = useMemo(() => {
    return acts.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (projectFilter !== 'all' && a.project_id !== projectFilter) return false;
      return true;
    });
  }, [acts, statusFilter, projectFilter]);

  const handleAction = async (act: ActWithProject, action: 'approve' | 'sign') => {
    setBusyId(act.id);
    setErrorMsg(null);
    try {
      await api.acts.approve(act.id, action);
      await qc.invalidateQueries({ queryKey: ['site_visit_acts'] });
      if (openAct?.id === act.id) setOpenAct(null);
    } catch (e: unknown) {
      setErrorMsg(formatError(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <button onClick={onBack} className="foxhole-btn foxhole-btn-ghost mb-4">
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver
      </button>

      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="foxhole-stencil text-3xl mb-2 flex items-center gap-2">
            <FileSignature className="w-6 h-6" />
            ACTAS DE VISITA DE OBRA
          </h1>
          <p className="text-foxhole-muted text-sm">
            Borradores generados por agent_acta_obra. Aprueba para fijar, firma para hacerlas definitivas.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="foxhole-btn foxhole-btn-ghost"
          disabled={isFetching}
          title="Recargar"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Recargar
        </button>
      </header>

      {errorMsg && (
        <div className="mb-4 p-3 foxhole-card border-foxhole-state-failed/40 text-sm text-foxhole-state-failed font-mono">
          {errorMsg}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-foxhole-muted text-xs uppercase tracking-wider">Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-foxhole-surface border border-foxhole-border rounded-none px-2 py-1 text-sm focus:outline-none focus:border-foxhole-accent"
          >
            <option value="all">Todos</option>
            <option value="draft">Draft</option>
            <option value="approved">Aprobadas</option>
            <option value="signed">Firmadas</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-foxhole-muted text-xs uppercase tracking-wider">Proyecto:</span>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-foxhole-surface border border-foxhole-border rounded-none px-2 py-1 text-sm focus:outline-none focus:border-foxhole-accent"
          >
            <option value="all">Todos</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <span className="ml-auto text-xs font-mono text-foxhole-muted">
          {filtered.length} de {acts.length} actas
        </span>
      </div>

      <div className="foxhole-card p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-foxhole-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Cargando actas...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-foxhole-muted text-sm">
            <p className="mb-2">No se pudieron cargar las actas.</p>
            <p className="text-xs font-mono text-foxhole-muted/70 break-words">
              {formatError(error)}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-foxhole-muted text-sm">
            {acts.length === 0
              ? 'Aun no hay actas de visita registradas.'
              : 'No hay actas con estos filtros.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foxhole-border-strong text-left text-[10px] uppercase tracking-wider text-foxhole-muted">
                <th className="p-3">Fecha visita</th>
                <th className="p-3">Proyecto</th>
                <th className="p-3 text-right">Observ.</th>
                <th className="p-3">Acuerdos</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const obsCount = Array.isArray(a.observations) ? a.observations.length : 0;
                const isBusy = busyId === a.id;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-foxhole-border/40 hover:bg-foxhole-surface/40 transition-colors"
                  >
                    <td className="p-3 font-mono text-xs text-foxhole-muted">
                      {new Date(a.visit_date).toLocaleString('es-ES', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3">{a.project_name || a.project_id.slice(0, 8)}</td>
                    <td className="p-3 text-right font-mono">{obsCount}</td>
                    <td className="p-3 text-foxhole-muted text-xs">{truncate(a.acuerdos, 60)}</td>
                    <td className="p-3">{statusBadge(a.status)}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setOpenAct(a)}
                        className="foxhole-btn foxhole-btn-ghost mr-2"
                      >
                        Ver
                      </button>
                      {a.status === 'draft' && (
                        <button
                          onClick={() => handleAction(a, 'approve')}
                          disabled={isBusy}
                          className="foxhole-btn-primary"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Aprobar'}
                        </button>
                      )}
                      {a.status === 'approved' && (
                        <button
                          onClick={() => handleAction(a, 'sign')}
                          disabled={isBusy}
                          className="foxhole-btn-primary"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Firmar'}
                        </button>
                      )}
                      {a.status === 'signed' && a.pdf_url && (
                        <a
                          href={a.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="foxhole-btn foxhole-btn-ghost"
                        >
                          PDF <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {openAct && (
        <ActDetailModal
          act={openAct}
          onClose={() => setOpenAct(null)}
          onAction={(action) => handleAction(openAct, action)}
          busy={busyId === openAct.id}
        />
      )}
    </div>
  );
}

interface ActDetailModalProps {
  act: ActWithProject;
  onClose: () => void;
  onAction: (action: 'approve' | 'sign') => void;
  busy: boolean;
}

function ActDetailModal({ act, onClose, onAction, busy }: ActDetailModalProps) {
  const observations = Array.isArray(act.observations) ? act.observations : [];
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="foxhole-card max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 hover:bg-foxhole-surface rounded text-foxhole-muted hover:text-foxhole-fg"
        >
          <X className="w-4 h-4" />
        </button>

        <header className="mb-4">
          <h2 className="foxhole-stencil text-xl mb-1">
            ACTA — {act.project_name || act.project_id.slice(0, 8)}
          </h2>
          <p className="text-xs text-foxhole-muted font-mono">
            Visita: {new Date(act.visit_date).toLocaleString('es-ES')} · {statusBadge(act.status)}
          </p>
        </header>

        <section className="mb-4">
          <h3 className="text-xs uppercase tracking-wider text-foxhole-muted mb-2">
            Observaciones ({observations.length})
          </h3>
          {observations.length === 0 ? (
            <p className="text-sm text-foxhole-muted">Sin observaciones registradas.</p>
          ) : (
            <ul className="space-y-2">
              {observations.map((o, i) => (
                <li key={i} className="border-l-2 border-foxhole-tan/40 pl-3 py-1">
                  <div className="text-[10px] uppercase tracking-wider text-foxhole-muted">
                    {o.gremio || '—'} · {o.tipo || '—'}
                  </div>
                  <div className="text-sm">{o.texto || '—'}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {act.acuerdos && (
          <section className="mb-4">
            <h3 className="text-xs uppercase tracking-wider text-foxhole-muted mb-2">Acuerdos</h3>
            <p className="text-sm whitespace-pre-wrap">{act.acuerdos}</p>
          </section>
        )}

        {act.proxima_visita_prevista && (
          <section className="mb-4">
            <h3 className="text-xs uppercase tracking-wider text-foxhole-muted mb-2">
              Proxima visita
            </h3>
            <p className="text-sm font-mono">
              {new Date(act.proxima_visita_prevista).toLocaleString('es-ES')}
            </p>
          </section>
        )}

        {act.transcript_raw && (
          <section className="mb-4">
            <h3 className="text-xs uppercase tracking-wider text-foxhole-muted mb-2">
              Transcripcion
            </h3>
            <p className="text-xs text-foxhole-muted whitespace-pre-wrap font-mono leading-relaxed">
              {act.transcript_raw}
            </p>
          </section>
        )}

        <footer className="flex justify-end gap-2 pt-4 border-t border-foxhole-border">
          <button onClick={onClose} className="foxhole-btn foxhole-btn-ghost">
            Cerrar
          </button>
          {act.status === 'draft' && (
            <button
              onClick={() => onAction('approve')}
              disabled={busy}
              className="foxhole-btn-primary"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Aprobar'}
            </button>
          )}
          {act.status === 'approved' && (
            <button
              onClick={() => onAction('sign')}
              disabled={busy}
              className="foxhole-btn-primary"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Firmar'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
