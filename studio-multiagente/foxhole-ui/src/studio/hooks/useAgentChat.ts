import { useCallback, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
}

/**
 * Chat persistido en agent_conversations (B61 / A.4 plan Opus).
 *
 * - Carga el historial desde BD al cambiar de agente (TanStack Query).
 * - Cada mensaje del usuario se inserta optimistamente; al confirmar respuesta
 *   se reemplaza por la version con id real (refetch).
 * - El workflow backend persiste tanto el mensaje del usuario como el del
 *   agente, asi que el chat sobrevive recargas y cambios de pestana.
 *
 * Uso: const { messages, sendMessage, isSending, error } = useAgentChat(agentName, projectId)
 */
export function useAgentChat(
  agentName: string | null,
  projectId: string | null = null,
) {
  const queryClient = useQueryClient();
  const queryKey = ['agentConversation', agentName, projectId];

  // Mensajes optimistas que aun no estan en BD (se mezclan con la query)
  const [pending, setPending] = useState<ChatMessage[]>([]);

  // Limpiar pending al cambiar de agente
  useEffect(() => {
    setPending([]);
  }, [agentName, projectId]);

  const history = useQuery({
    queryKey,
    queryFn: () => {
      if (!agentName) throw new Error('NO_AGENT');
      return api.agentConversation(agentName, projectId);
    },
    enabled: Boolean(agentName),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const persistedMessages: ChatMessage[] =
    history.data?.messages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      timestamp: m.timestamp,
    })) ?? [];

  // Mensajes finales = historial BD + mensajes pending (que aun no aparecen en BD)
  const messages: ChatMessage[] = [...persistedMessages, ...pending];

  const send = useMutation({
    mutationFn: async (vars: { name: string; message: string; pid: string | null }) => {
      return api.agentChat(vars.name, vars.message, vars.pid);
    },
    onSuccess: () => {
      // Limpiar pending y refetch BD para tener ids reales
      setPending([]);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      // Mantener el pending del usuario para que pueda reintentar
    },
  });

  const sendMessage = useCallback(
    (text: string) => {
      if (!agentName) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      // Optimistic insert: mensaje del usuario inmediato
      setPending((prev) => [
        ...prev,
        {
          id: 'pending-user-' + Math.random().toString(36).slice(2, 10),
          role: 'user',
          text: trimmed,
          timestamp: new Date().toISOString(),
        },
      ]);
      send.mutate({ name: agentName, message: trimmed, pid: projectId });
    },
    [agentName, projectId, send],
  );

  return {
    messages,
    sendMessage,
    isSending: send.isPending,
    isLoadingHistory: history.isLoading,
    historyError: history.error,
    error: send.error,
    historyCount: history.data?.count ?? 0,
  };
}
