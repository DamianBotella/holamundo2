import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle, Loader2, X, RefreshCw, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { formatError } from '@/lib/errors';

interface IncidentOption {
  descripcion?: string;
  materiales?: string;
  coste_eur?: number;
  dias?: number;
  ventajas?: string[];
  desventajas?: string[];
}

interface ProjectIncident {
  id: string;
  tenant_id: string;
  project_id: string;
  detected_at: string;
  description: string;
  location: string | null;
  severity: 'baja' | 'media' | 'alta' | 'critica' | null;
  causa_probable: string | null;
  options: IncidentOption[] | null;
  selected_option_index: number | null;
  cost_delta_eur: number | null;
  time_delta_days: number | null;
  client_communication_draft: string | null;
  client_communication_sent_at: string | null;
  modification_doc_url: string | null;
  status: 'detected' | 'proposed' | 'communicated' | 'approved' | 'rejected' | 'closed';
  photos: Array<{ url: string; caption?: string }> | null;
  created_at: string;
}

interface IncidentWithProject extends ProjectIncident {
  project_name: string | null;
}

type StatusFilter = 'all' | 'detected' | 'proposed' | 'communicated' | 'approved' | 'rejected';

interface Props {
  onBack: () => void;
}

function severityBadge(sev: ProjectIncident['severity']) {
  if (!sev) return <span className="text-foxhole-muted text-xs">—</span>;
  if (sev === 'critica') return <span className="foxhole-badge-critical">CRITICA</span>;
  if (sev === 'alta') return <span className="foxhole-badge-critical">ALTA</span>;
  if (sev === 'media') return <span className="foxhole-badge-warning">MEDIA</span>;
  return <span className="foxhole-badge-info">BAJA</span>;
}

function statusBadge(status: ProjectIncident['status']) {
  if (status === 'detected') return <span className="foxhole-badge-warning">DETECTADO</span>;
  if (status === 'proposed') return <span className="foxhole-badge-warning">PROPUESTO</span>;
  if (status === 'communicated') return <span className="foxhole-badge-info">ESPERANDO CLIENTE</span>;
  if (status === 'approved') return <span className="foxhole-badge-success">APROBADO</span>;
  if (status === 'rejected') return <span className="foxhole-badge-critical">RECHAZADO</span>;
  return <span className="foxhole-badge">CERRADO</span>;
}

function truncate(s: string | null | undefined, max = 80): string {
  if (!s) return '—';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function IncidentsPage({ onBack }: Props) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [open, setOpen] = useState<IncidentWithProject | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: incidents = [], isLoading, error, refetch, isFetching } = useQuery<IncidentWithProject[]>({
    queryKey: ['project_incidents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_incidents')
        .select('*')
        .neq('status', 'closed')
        .order('detected_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data || []) as ProjectIncident[];
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
    for (const i of incidents) {
      if (i.project_id && i.project_name) map.set(i.project_id, i.project_name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [incidents]);

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (projectFilter !== 'all' && i.project_id !== projectFilter) return false;
      return true;
    });
  }, [incidents, statusFilter, projectFilter]);

  const handleSelect = async (
    incident: IncidentWithProject,
    idx: 0 | 1,
    action: 'communicate' | 'reject',
    emailOverride?: string,
  ) => {
    setBusyId(incident.id);
    setErrorMsg(null);
    try {
      await api.incidents.selectOption(incident.id, idx, action, emailOverride);
      await qc.invalidateQueries({ queryKey: ['project_incidents'] });
      if (open?.id === incident.id) setOpen(null);
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
            <AlertTriangle className="w-6 h-6" />
            IMPREVISTOS DE OBRA
          </h1>
          <p className="text-foxhole-muted text-sm">
            Detecciones de agent_incident_handler. Comunica la opcion elegida al cliente y espera su decision.
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
            <option value="detected">Detectado</option>
            <option value="proposed">Propuesto</option>
            <option value="communicated">Esperando cliente</option>
            <option value="approved">Aprobado</option>
            <option value="rejected">Rechazado</option>
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
          {filtered.length} de {incidents.length} imprevistos
        </span>
      </div>

      <div className="foxhole-card p-0 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-foxhole-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Cargando imprevistos...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-foxhole-muted text-sm">
            <p className="mb-2">No se pudieron cargar los imprevistos.</p>
            <p className="text-xs font-mono text-foxhole-muted/70 break-words">
              {formatError(error)}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-foxhole-muted text-sm">
            {incidents.length === 0
              ? 'Aun no hay imprevistos detectados.'
              : 'No hay imprevistos con estos filtros.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foxhole-border-strong text-left text-[10px] uppercase tracking-wider text-foxhole-muted">
                <th className="p-3">Detectado</th>
                <th className="p-3">Proyecto</th>
                <th className="p-3">Ubicacion</th>
                <th className="p-3">Severidad</th>
                <th className="p-3">Causa probable</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Δ €</th>
                <th className="p-3 text-right">Δ dias</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr
                  key={i.id}
                  className="border-b border-foxhole-border/40 hover:bg-foxhole-surface/40 transition-colors"
                >
                  <td className="p-3 font-mono text-xs text-foxhole-muted">
                    {new Date(i.detected_at).toLocaleString('es-ES', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="p-3">{i.project_name || i.project_id.slice(0, 8)}</td>
                  <td className="p-3 text-foxhole-muted text-xs">{i.location || '—'}</td>
                  <td className="p-3">{severityBadge(i.severity)}</td>
                  <td className="p-3 text-foxhole-muted text-xs">
                    {truncate(i.causa_probable, 50)}
                  </td>
                  <td className="p-3">{statusBadge(i.status)}</td>
                  <td className="p-3 text-right font-mono text-xs">
                    {i.cost_delta_eur != null ? `${i.cost_delta_eur}€` : '—'}
                  </td>
                  <td className="p-3 text-right font-mono text-xs">
                    {i.time_delta_days != null ? `${i.time_delta_days}d` : '—'}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => setOpen(i)} className="foxhole-btn foxhole-btn-ghost">
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <IncidentDetailModal
          incident={open}
          onClose={() => setOpen(null)}
          onSelect={(idx, action, emailOverride) => handleSelect(open, idx, action, emailOverride)}
          busy={busyId === open.id}
        />
      )}
    </div>
  );
}

interface ModalProps {
  incident: IncidentWithProject;
  onClose: () => void;
  onSelect: (idx: 0 | 1, action: 'communicate' | 'reject', emailOverride?: string) => void;
  busy: boolean;
}

function IncidentDetailModal({ incident, onClose, onSelect, busy }: ModalProps) {
  const [emailOverride, setEmailOverride] = useState('');
  const [copied, setCopied] = useState(false);
  const options = Array.isArray(incident.options) ? incident.options : [];
  const isPending = incident.status === 'detected' || incident.status === 'proposed';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="foxhole-card max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 relative"
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
            IMPREVISTO — {incident.project_name || incident.project_id.slice(0, 8)}
          </h2>
          <p className="text-xs text-foxhole-muted font-mono">
            {new Date(incident.detected_at).toLocaleString('es-ES')} · {incident.location || '—'} ·{' '}
            {severityBadge(incident.severity)} · {statusBadge(incident.status)}
          </p>
        </header>

        <section className="mb-4">
          <h3 className="text-xs uppercase tracking-wider text-foxhole-muted mb-2">Descripcion</h3>
          <p className="text-sm">{incident.description}</p>
        </section>

        {incident.causa_probable && (
          <section className="mb-4">
            <h3 className="text-xs uppercase tracking-wider text-foxhole-muted mb-2">
              Causa probable
            </h3>
            <p className="text-sm text-foxhole-muted">{incident.causa_probable}</p>
          </section>
        )}

        {options.length > 0 && (
          <section className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {options.slice(0, 2).map((opt, idx) => {
              const isSelected = incident.selected_option_index === idx;
              return (
                <div
                  key={idx}
                  className={`foxhole-card p-4 ${
                    isSelected ? 'border-foxhole-state-working' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="foxhole-stencil text-sm">
                      OPCION {idx === 0 ? 'A' : 'B'}
                    </h4>
                    {isSelected && <span className="foxhole-badge-success">SELECCIONADA</span>}
                  </div>
                  <p className="text-sm mb-2">{opt.descripcion || '—'}</p>
                  {opt.materiales && (
                    <p className="text-xs text-foxhole-muted mb-2">
                      <span className="uppercase tracking-wider">Materiales:</span> {opt.materiales}
                    </p>
                  )}
                  <div className="flex gap-3 text-xs font-mono mb-2">
                    <span>
                      Coste:{' '}
                      <span className="text-foxhole-bone">
                        {opt.coste_eur != null ? `${opt.coste_eur}€` : '—'}
                      </span>
                    </span>
                    <span>
                      Dias:{' '}
                      <span className="text-foxhole-bone">
                        {opt.dias != null ? `${opt.dias}` : '—'}
                      </span>
                    </span>
                  </div>
                  {Array.isArray(opt.ventajas) && opt.ventajas.length > 0 && (
                    <div className="mb-1">
                      <div className="text-[10px] uppercase tracking-wider text-foxhole-state-working mb-1">
                        Ventajas
                      </div>
                      <ul className="text-xs text-foxhole-muted list-disc list-inside space-y-0.5">
                        {opt.ventajas.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(opt.desventajas) && opt.desventajas.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-foxhole-state-failed mb-1">
                        Desventajas
                      </div>
                      <ul className="text-xs text-foxhole-muted list-disc list-inside space-y-0.5">
                        {opt.desventajas.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {incident.client_communication_draft && (
          <section className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wider text-foxhole-muted">
                Borrador comunicacion al cliente
              </h3>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(incident.client_communication_draft || '');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="foxhole-btn foxhole-btn-ghost text-[10px]"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre className="text-xs text-foxhole-muted whitespace-pre-wrap font-mono leading-relaxed bg-foxhole-bg p-3 border border-foxhole-border">
              {incident.client_communication_draft}
            </pre>
          </section>
        )}

        {isPending && options.length >= 2 && (
          <section className="mb-4">
            <h3 className="text-xs uppercase tracking-wider text-foxhole-muted mb-2">
              Email del cliente (opcional override)
            </h3>
            <input
              type="email"
              value={emailOverride}
              onChange={(e) => setEmailOverride(e.target.value)}
              placeholder="dejar vacio para usar email del cliente real"
              className="w-full bg-foxhole-surface border border-foxhole-border rounded-none px-3 py-2 text-sm focus:outline-none focus:border-foxhole-accent mb-2"
            />
          </section>
        )}

        <footer className="flex justify-end gap-2 pt-4 border-t border-foxhole-border flex-wrap">
          <button onClick={onClose} className="foxhole-btn foxhole-btn-ghost">
            Cerrar
          </button>
          {isPending && options.length >= 2 && (
            <>
              <button
                onClick={() => onSelect(0, 'communicate', emailOverride || undefined)}
                disabled={busy}
                className="foxhole-btn-primary"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Opcion A → cliente'}
              </button>
              <button
                onClick={() => onSelect(1, 'communicate', emailOverride || undefined)}
                disabled={busy}
                className="foxhole-btn-primary"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Opcion B → cliente'}
              </button>
              <button
                onClick={() => onSelect(0, 'reject')}
                disabled={busy}
                className="foxhole-btn-danger"
              >
                Rechazar
              </button>
            </>
          )}
          {incident.status === 'communicated' && (
            <span className="text-xs font-mono text-foxhole-muted px-2 py-1">
              ID para cliente: {incident.id}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
