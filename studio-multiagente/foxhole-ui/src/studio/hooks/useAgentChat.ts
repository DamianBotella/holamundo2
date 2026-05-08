import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
}

/**
 * Chat con un agente via POST /api/v1/studio/agent-chat.
 * El historial se mantiene en memoria por agentName (no persiste todavia en BD).
 *
 * Cuando se cambia de agente seleccionado, las conversaciones de cada uno
 * se conservan en este hook (Map por agent_name) hasta unmount del estudio.
 */
export function useAgentChat(agentName: string | null) {
  const [chatsByAgent, setChatsByAgent] = useState<Map<string, ChatMessage[]>>(
    () => new Map(),
  );
  const messages = agentName ? chatsByAgent.get(agentName) ?? [] : [];

  const send = useMutation({
    mutationFn: async ({ name, message }: { name: string; message: string }) => {
      return api.agentChat(name, message);
    },
    onSuccess: (resp, vars) => {
      setChatsByAgent((prev) => {
        const next = new Map(prev);
        const list = [...(next.get(vars.name) ?? [])];
        list.push({
          id: 'a-' + Math.random().toString(36).slice(2, 10),
          role: 'agent',
          text: resp.response,
          timestamp: resp.timestamp,
        });
        next.set(vars.name, list);
        return next;
      });
    },
  });

  const sendMessage = useCallback(
    (text: string) => {
      if (!agentName) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      // Push del mensaje del usuario inmediatamente (optimistic)
      setChatsByAgent((prev) => {
        const next = new Map(prev);
        const list = [...(next.get(agentName) ?? [])];
        list.push({
          id: 'u-' + Math.random().toString(36).slice(2, 10),
          role: 'user',
          text: trimmed,
          timestamp: new Date().toISOString(),
        });
        next.set(agentName, list);
        return next;
      });
      send.mutate({ name: agentName, message: trimmed });
    },
    [agentName, send],
  );

  return {
    messages,
    sendMessage,
    isSending: send.isPending,
    error: send.error,
  };
}
