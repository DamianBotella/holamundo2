import { useState } from 'react';
import { Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { usePendingApprovals, useSubmitApprovalDecision } from './hooks/usePendingApprovals';

interface Props {
  /** Si se pasa, filtra por agent_name */
  agentName?: string;
  /** Modo compacto (sin titulo) */
  compact?: boolean;
}

const APPROVAL_TYPE_LABEL: Record<string, string> = {
  briefing_review:    'Revision briefing',
  design_review:      'Revision diseno',
  proposal_review:    'Revision propuesta',
  proposal_send:      'Envio propuesta',
  trade_request_send: 'Envio gremios',
  external_contact:   'Contacto externo',
  project_close:      'Cierre proyecto',
};

function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.floor((now - d) / 1000);
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
  return `hace ${Math.floor(s / 86400)}d`;
}

/**
 * Panel de aprobaciones pendientes (sec 6.7 del spec).
 * Aparece cuando hay agentes en waiting_approval y permite aprobar/rechazar
 * llamando a POST /api/v1/approval-decision.
 */
export function ApprovalPanel({ agentName, compact = false }: Props) {
  const [acting, setActing] = useState<string | null>(null);
  const { data: all = [], isLoading } = usePendingApprovals();
  const decide = useSubmitApprovalDecision();

  const items = agentName ? all.filter((a) => a.agent_name === agentName) : all;

  if (isLoading && items.length === 0) {
    return <p className="text-xs text-foxhole-muted italic">Cargando aprobaciones...</p>;
  }
  if (items.length === 0) return null;

  return (
    <div className={`flex flex-col gap-2 ${compact ? '' : 'mt-3'}`}>
      {!compact && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-foxhole-state-waiting" />
          <h3 className="foxhole-stencil text-[11px]">
            Aprobaciones pendientes ({items.length})
          </h3>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {items.map((a) => {
          const isActing = acting === a.approval_id;
          return (
            <div
              key={a.approval_id}
              className="border border-foxhole-state-waiting/40 bg-foxhole-state-waiting/5 p-2 flex flex-col gap-1.5"
            >
              <div className="flex items-baseline justify-between gap-2 text-[10px] font-mono">
                <span className="text-foxhole-state-waiting uppercase tracking-wider">
                  {APPROVAL_TYPE_LABEL[a.approval_type] || a.approval_type}
                </span>
                <span className="text-foxhole-muted">{formatRelative(a.created_at)}</span>
              </div>
              <div className="text-[11px] text-foxhole-bone leading-snug">{a.summary}</div>
              {a.project_name && (
                <div className="text-[10px] font-mono text-foxhole-tan truncate">
                  {a.project_name}
                </div>
              )}

              <div className="flex items-center gap-1.5 mt-1">
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => {
                    setActing(a.approval_id);
                    decide.mutate(
                      { id: a.approval_id, decision: 'approve' },
                      { onSettled: () => setActing(null) },
                    );
                  }}
                  className="foxhole-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Aprobar
                </button>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => {
                    setActing(a.approval_id);
                    decide.mutate(
                      { id: a.approval_id, decision: 'reject' },
                      { onSettled: () => setActing(null) },
                    );
                  }}
                  className="foxhole-btn-danger flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  Rechazar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {decide.isError && (
        <p className="text-[10px] text-foxhole-state-failed">
          Error: {String(decide.error)}
        </p>
      )}
    </div>
  );
}
