import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { StudioAgent } from '@/lib/types';
import { useTenantId } from './useTenantId';

/**
 * Carga el estado en vivo de los agentes del estudio + suscripcion Realtime.
 *
 * Sec 6.4 del spec:
 *   .channel('studio-state')
 *   .on('postgres_changes', { table: 'agent_executions', filter: tenant_id=eq... })
 *   .on('postgres_changes', { table: 'approvals',        filter: tenant_id=eq... })
 *   .subscribe()
 *
 * En cada cambio: invalida cache -> refetch instantaneo de /studio/agents.
 *
 * Polling cada 30s como fallback (por si Realtime se cae o no esta habilitado
 * en la publication supabase_realtime para esas tablas).
 */
export function useStudioAgents() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  const query = useQuery<StudioAgent[]>({
    queryKey: ['studio', 'agents'],
    queryFn: api.studioAgents,
    staleTime: 5 * 1000,
    refetchInterval: 30 * 1000, // fallback si Realtime falla
  });

  useEffect(() => {
    if (!tenantId) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['studio', 'agents'] });
      queryClient.invalidateQueries({ queryKey: ['studio', 'pendingApprovals'] });
    };

    // Nota: agent_executions y approvals NO tienen tenant_id directo en columna.
    // El filtro por tenant se aplica via RLS sobre project_id -> projects.tenant_id.
    // Por tanto NO usamos `filter: 'tenant_id=eq...'` en postgres_changes (no
    // funcionaria). Suscribimos a TODOS los cambios y dejamos que RLS filtre
    // en el refetch.
    const channel = supabase
      .channel(`studio-state-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_executions' },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'approvals' },
        invalidate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);

  return query;
}
