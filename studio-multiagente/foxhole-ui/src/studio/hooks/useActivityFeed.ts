import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { StudioFeedEvent } from '@/lib/types';

/**
 * Activity feed del estudio (ticker lateral).
 * B68: Realtime invalida via canal studio-state cuando hay cambios.
 * Polling cada 60s solo como fallback (Realtime caido o no habilitado).
 */
export function useActivityFeed(limit = 30) {
  return useQuery<StudioFeedEvent[]>({
    queryKey: ['studio', 'feed', limit],
    queryFn: () => api.studioFeed(undefined, limit),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });
}
