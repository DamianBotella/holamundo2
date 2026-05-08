import { useEffect, useRef, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import type { StudioAgent } from '@/lib/types';
import { ApprovalPanel } from './ApprovalPanel';
import { useAgentChat } from './hooks/useAgentChat';
import { colorForState, STATE_LABEL } from './palette';

interface Props {
  agent: StudioAgent | null;
}

/**
 * Panel de inspeccion + chat con el agente seleccionado.
 *
 * Sec 6.4 spec / nota final: chat real conectado a POST /api/v1/studio/agent-chat
 * que invoca al LLM con un system prompt construido a partir de agents_catalog.
 * Conversacion en memoria por agente (sin persistencia BD todavia).
 */
export function AgentChatPanel({ agent }: Props) {
  return (
    <aside className="foxhole-corner p-4 flex flex-col gap-2 overflow-hidden h-full">
      <h2 className="foxhole-stencil text-[11px]">Inspeccion</h2>
      <div className="foxhole-divider" />

      {!agent ? (
        <div className="mt-2 flex flex-col gap-3 overflow-y-auto flex-1">
          <p className="text-xs text-foxhole-muted italic">
            Click en un agente para ver detalle y abrir chat.
          </p>
          <div>
            <h3 className="foxhole-stencil text-[10px] mb-2">Cola global</h3>
            <ApprovalPanel compact />
          </div>
        </div>
      ) : (
        <AgentDetailWithChat agent={agent} />
      )}
    </aside>
  );
}

function AgentDetailWithChat({ agent }: { agent: StudioAgent }) {
  const { messages, sendMessage, isSending, error } = useAgentChat(agent.agent_name);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll al fondo cuando llega un mensaje nuevo
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isSending]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || isSending) return;
    sendMessage(draft);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-2 text-sm flex-1 min-h-0">
      {/* Cabecera del agente */}
      <div className="flex-shrink-0">
        <div className="text-[10px] font-mono text-foxhole-muted uppercase tracking-wider">
          {agent.agent_name}
        </div>
        <div className="text-base font-display font-semibold text-foxhole-bone tracking-wide">
          {agent.display_name}
        </div>
        <div className="text-[10px] font-mono text-foxhole-tan uppercase tracking-wider">
          {agent.category} · {agent.room_id}
        </div>
        <div className="border-t border-foxhole-border pt-1.5 mt-1.5 text-xs">
          <span className="text-foxhole-muted">Estado:</span>{' '}
          <span
            className="font-mono uppercase tracking-wider"
            style={{ color: colorForState(agent.state) }}
          >
            {STATE_LABEL[agent.state]}
          </span>
          {' · '}
          <span className="text-foxhole-muted">activos:</span>{' '}
          <span className="font-mono">{agent.active_count}</span>
          {' · '}
          <span className="text-foxhole-muted">pend:</span>{' '}
          <span className="font-mono">{agent.pending_approvals_count}</span>
        </div>
      </div>

      {/* Aprobaciones del agente (solo si waiting_approval) */}
      {agent.state === 'waiting_approval' && (
        <div className="flex-shrink-0 max-h-40 overflow-y-auto">
          <ApprovalPanel agentName={agent.agent_name} />
        </div>
      )}

      {/* Chat */}
      <div className="border-t border-foxhole-border pt-2 flex flex-col flex-1 min-h-0">
        <h3 className="foxhole-stencil text-[10px] mb-1.5 flex-shrink-0">Comunicacion</h3>

        <div
          ref={scrollRef}
          className="flex flex-col gap-1.5 overflow-y-auto flex-1 min-h-0 pr-1 -mr-1"
        >
          {messages.length === 0 && !isSending && (
            <p className="text-[11px] text-foxhole-muted italic">
              Pregunta a {agent.display_name} sobre su trabajo, decisiones o contexto.
            </p>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} role={m.role} text={m.text} />
          ))}
          {isSending && (
            <div className="flex items-center gap-1.5 text-[10px] text-foxhole-muted italic px-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {agent.display_name} esta escribiendo...
            </div>
          )}
          {error && (
            <div className="text-[10px] text-foxhole-state-failed">
              Error: {String(error)}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="flex gap-1.5 mt-2 flex-shrink-0">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Mensaje para ${agent.display_name}...`}
            disabled={isSending}
            maxLength={2000}
            className="flex-1 bg-foxhole-surface border border-foxhole-border-strong rounded-none px-2 py-1.5 text-xs text-foxhole-bone placeholder:text-foxhole-muted focus:outline-none focus:border-foxhole-tan disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="foxhole-btn-primary px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Enviar"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

function Bubble({ role, text }: { role: 'user' | 'agent'; text: string }) {
  const isUser = role === 'user';
  return (
    <div
      className={`max-w-[85%] px-2 py-1.5 text-[11px] leading-snug ${
        isUser
          ? 'self-end bg-foxhole-state-working/15 border border-foxhole-state-working/40 text-foxhole-bone'
          : 'self-start bg-foxhole-surface-2 border border-foxhole-border-strong text-foxhole-bone'
      }`}
    >
      {text}
    </div>
  );
}
