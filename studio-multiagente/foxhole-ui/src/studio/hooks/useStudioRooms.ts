import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { StudioRoom } from '@/lib/types';

/**
 * Carga el catalogo de habitaciones del estudio.
 * Cache largo: el catalogo es global y casi nunca cambia.
 * Refetch cada 5s mientras esta vacio (recuperacion tras migrations).
 */
export function useStudioRooms() {
  return useQuery<StudioRoom[]>({
    queryKey: ['studio', 'rooms'],
    queryFn: api.studioRooms,
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
    refetchInterval: (q) => (q.state.data && q.state.data.length > 0 ? false : 5000),
  });
}
