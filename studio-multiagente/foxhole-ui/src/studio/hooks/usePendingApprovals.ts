import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PendingApproval } from '@/lib/types';

export function usePendingApprovals() {
  // B68: Realtime sobre tabla approvals invalida queryKey al instante.
  // Polling 60s solo como fallback.
  return useQuery<PendingApproval[]>({
    queryKey: ['studio', 'pendingApprovals'],
    queryFn: api.pendingApprovals,
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });
}

export function useSubmitApprovalDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      api.submitApprovalDecision(id, decision),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['studio', 'pendingApprovals'] });
      queryClient.invalidateQueries({ queryKey: ['studio', 'agents'] });
    },
  });
}
