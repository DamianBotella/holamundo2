import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useTenantId } from './useTenantId';

/**
 * Suscribe el ProjectDeliverablesPanel a Realtime sobre las tablas que pueden
 * cambiar mientras el panel esta visible:
 *
 *   - rcd_studies + rcd_studies_draft  (al generar/aprobar RCD)
 *   - iee_reports + iee_reports_draft  (al generar/aprobar IEE)
 *   - agent_executions                 (al ejecutar grants_finder o telematic)
 *
 * Las 4 cards leen de un mismo endpoint (/project-deliverables?id=X) que
 * combina todo. Por eso solo invalidamos esa query cuando llega cualquier
 * cambio. Tambien invalidamos timeline (ProjectDetailPage la pinta).
 *
 * Filtro por project_id (no tenant_id) para evitar refrescar el panel de
 * un proyecto cuando otro tenant edita el suyo.
 */
export function useProjectDeliverablesRealtime(projectId: string) {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  useEffect(() => {
    if (!projectId || !tenantId) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['project-deliverables', projectId] });
      queryClient.invalidateQueries({ queryKey: ['timeline', projectId] });
    };

    const channel = supabase
      .channel(`deliverables-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rcd_studies',
          filter: `project_id=eq.${projectId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rcd_studies_draft',
          filter: `project_id=eq.${projectId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'iee_reports',
          filter: `project_id=eq.${projectId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'iee_reports_draft',
          filter: `project_id=eq.${projectId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_executions',
          filter: `project_id=eq.${projectId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, tenantId, queryClient]);
}
