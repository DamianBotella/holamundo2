import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { StudioFeedEvent } from '@/lib/types';

/**
 * Activity feed del estudio (ticker lateral).
 * Polling cada 3s (segun spec sec 6.6).
 */
export function useActivityFeed(limit = 30) {
  return useQuery<StudioFeedEvent[]>({
    queryKey: ['studio', 'feed', limit],
    queryFn: () => api.studioFeed(undefined, limit),
    refetchInterval: 3000,
    staleTime: 1500,
  });
}
