import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PendingApproval } from '@/lib/types';

export function usePendingApprovals() {
  return useQuery<PendingApproval[]>({
    queryKey: ['studio', 'pendingApprovals'],
    queryFn: api.pendingApprovals,
    refetchInterval: 5000,
    staleTime: 2000,
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
