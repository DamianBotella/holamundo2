import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, Loader2, X, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import type { ClientWeeklyUpdateRow } from '@/lib/api';
import { formatError } from '@/lib/errors';

type UpdateWithProject = ClientWeeklyUpdateRow;
type ClientWeeklyUpdate = ClientWeeklyUpdateRow;

type StatusFilter = 'all' | 'draft' | 'approved' | 'sent' | 'failed';

interface Props {
  onBack: () => void;
}

function statusBadge(status: ClientWeeklyUpdate['status']) {
  if (status === 'draft') return <span className="foxhole-badge-warning">DRAFT</span>;
  if (status === 'approved') return <span className="foxhole-badge-info">ENVIANDO...</span>;
  if (status === 'sent') return <span className="foxhole-badge-success">ENVIADO</span>;
  return <span className="foxhole-badge-critical">FALLIDO</span>;
}

function truncate(s: string | null | undefined, max = 80): string {
  if (!s) return '—';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function ClientUpdatesPage({ onBack }: Props) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [open, setOpen] = useState<UpdateWithProject | null>(null);
  const [approveFor, setApproveFor] = useState<UpdateWithProject | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: updates = [], isLoading, error, refetch, isFetching } = useQuery<UpdateWithProject[]>({
    queryKey: ['client_weekly_updates'],
    queryFn: () => api.clientUpdates.list({ limit: 200 }),
  });

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of updates) {
      if (u.project_id && u.project_name) map.set(u.project_id, u.project_name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [updates]);

  const filtered = useMemo(() => {
    return updates.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (projectFilter !== 'all' && u.project_id !== projectFilter) return false;
      return true;
    });
  }, [updates, statusFilter, projectFilter]);

  const handleAction = async (
    update: UpdateWithProject,
    action: 'approve' | 'reject',
    emailOverride?: string,
  ) => {
    setBusyId(update.id);
    setErrorMsg(null);
    try {
      await api.clientUpdates.approve(update.id, action, emailOverride);
      await qc.invalidateQueries({ queryKey: ['client_weekly_updates'] });
      setApproveFor(null);
      if (open?.id === update.id) setOpen(null);
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
            <Mail className="w-6 h-6" />
            RESUMENES SEMANALES AL CLIENTE
          </h1>
          <p className="text-foxhole-muted text-sm">
            Borradores generados por agent_client_update. Aprueba para enviar al cliente.
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
            <option value="approved">Enviando</option>
            <option value="sent">Enviado</option>
            <option value="failed">Fallido</option>
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
          {filtered.length} de {updates.length} resumenes
        </span>
      </div>

      <div className="foxhole-card p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-foxhole-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Cargando resumenes...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-foxhole-muted text-sm">
            <p className="mb-2">No se pudieron cargar los resumenes.</p>
            <p className="text-xs font-mono text-foxhole-muted/70 break-words">
              {formatError(error)}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-foxhole-muted text-sm">
            {updates.length === 0
              ? 'Aun no hay resumenes semanales generados.'
              : 'No hay resumenes con estos filtros.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foxhole-border-strong text-left text-[10px] uppercase tracking-wider text-foxhole-muted">
                <th className="p-3">Semana</th>
                <th className="p-3">Proyecto</th>
                <th className="p-3">Resumen</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Enviado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isBusy = busyId === u.id;
                return (
                  <tr
                    key={u.id}
                    className="border-b border-foxhole-border/40 hover:bg-foxhole-surface/40 transition-colors"
                  >
                    <td className="p-3 font-mono text-xs text-foxhole-muted whitespace-nowrap">
                      {u.week_start} → {u.week_end}
                    </td>
                    <td className="p-3">{u.project_name || u.project_id.slice(0, 8)}</td>
                    <td className="p-3 text-foxhole-muted text-xs">
                      {truncate(u.summary_text, 80)}
                    </td>
                    <td className="p-3" title={u.email_message_id || ''}>
                      {statusBadge(u.status)}
                    </td>
                    <td className="p-3 text-xs font-mono text-foxhole-muted">
                      {u.sent_at
                        ? new Date(u.sent_at).toLocaleString('es-ES', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button onClick={() => setOpen(u)} className="foxhole-btn foxhole-btn-ghost mr-2">
                        Ver
                      </button>
                      {u.status === 'draft' && (
                        <button
                          onClick={() => setApproveFor(u)}
                          disabled={isBusy}
                          className="foxhole-btn-primary"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Aprobar y enviar'}
                        </button>
                      )}
                      {u.status === 'failed' && (
                        <button
                          onClick={() => setApproveFor(u)}
                          disabled={isBusy}
                          className="foxhole-btn-primary"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Reintentar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <UpdateDetailModal
          update={open}
          onClose={() => setOpen(null)}
          onApprove={() => {
            setApproveFor(open);
          }}
        />
      )}

      {approveFor && (
        <ApproveModal
          update={approveFor}
          busy={busyId === approveFor.id}
          onClose={() => setApproveFor(null)}
          onSubmit={(emailOverride) => handleAction(approveFor, 'approve', emailOverride)}
        />
      )}
    </div>
  );
}

interface UpdateDetailModalProps {
  update: UpdateWithProject;
  onClose: () => void;
  onApprove: () => void;
}

function UpdateDetailModal({ update, onClose, onApprove }: UpdateDetailModalProps) {
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
            RESUMEN — {update.project_name || update.project_id.slice(0, 8)}
          </h2>
          <p className="text-xs text-foxhole-muted font-mono">
            Semana {update.week_start} → {update.week_end} · {statusBadge(update.status)}
            {update.sent_at && (
              <> · enviado {new Date(update.sent_at).toLocaleString('es-ES')}</>
            )}
          </p>
        </header>

        <section className="mb-4">
          <h3 className="text-xs uppercase tracking-wider text-foxhole-muted mb-2">
            Texto al cliente
          </h3>
          <div className="text-sm whitespace-pre-wrap leading-relaxed">
            {update.summary_text || <span className="text-foxhole-muted">Sin contenido.</span>}
          </div>
        </section>

        {update.email_message_id && (
          <section className="mb-4">
            <h3 className="text-xs uppercase tracking-wider text-foxhole-muted mb-2">
              Tracking
            </h3>
            <p className="text-xs font-mono text-foxhole-muted">
              email_message_id: {update.email_message_id}
            </p>
          </section>
        )}

        <footer className="flex justify-end gap-2 pt-4 border-t border-foxhole-border">
          <button onClick={onClose} className="foxhole-btn foxhole-btn-ghost">
            Cerrar
          </button>
          {update.status === 'draft' && (
            <button onClick={onApprove} className="foxhole-btn-primary">
              Aprobar y enviar
            </button>
          )}
          {update.status === 'failed' && (
            <button onClick={onApprove} className="foxhole-btn-primary">
              Reintentar
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

interface ApproveModalProps {
  update: UpdateWithProject;
  busy: boolean;
  onClose: () => void;
  onSubmit: (emailOverride?: string) => void;
}

function ApproveModal({ update, busy, onClose, onSubmit }: ApproveModalProps) {
  const [emailOverride, setEmailOverride] = useState('');
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="foxhole-card max-w-md w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 hover:bg-foxhole-surface rounded text-foxhole-muted hover:text-foxhole-fg"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="foxhole-stencil text-lg mb-2">APROBAR Y ENVIAR</h3>
        <p className="text-sm text-foxhole-muted mb-4">
          Se enviara el resumen semanal al cliente del proyecto{' '}
          <span className="font-mono text-foxhole-bone">
            {update.project_name || update.project_id.slice(0, 8)}
          </span>
          .
        </p>

        <label className="block mb-1 text-xs uppercase tracking-wider text-foxhole-muted">
          Email override (opcional)
        </label>
        <input
          type="email"
          value={emailOverride}
          onChange={(e) => setEmailOverride(e.target.value)}
          placeholder="vacio = usar email real del cliente"
          className="w-full bg-foxhole-surface border border-foxhole-border rounded-none px-3 py-2 text-sm focus:outline-none focus:border-foxhole-accent mb-4"
        />

        <footer className="flex justify-end gap-2">
          <button onClick={onClose} className="foxhole-btn foxhole-btn-ghost" disabled={busy}>
            Cancelar
          </button>
          <button
            onClick={() => onSubmit(emailOverride || undefined)}
            disabled={busy}
            className="foxhole-btn-primary"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Enviar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
