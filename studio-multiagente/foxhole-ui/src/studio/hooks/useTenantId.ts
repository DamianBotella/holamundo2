import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Extrae el tenant_id del JWT custom claim. Vuelve a leerlo si la sesion cambia.
 * Necesario para los filtros de Supabase Realtime (postgres_changes filtrado por tenant).
 */
export function useTenantId(): string | null {
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const extract = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const token = data.session?.access_token;
      if (!token) {
        setTenantId(null);
        return;
      }
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        const tid = payload.tenant_id ?? null;
        if (!cancelled) setTenantId(typeof tid === 'string' ? tid : null);
      } catch {
        if (!cancelled) setTenantId(null);
      }
    };

    extract();
    const { data: sub } = supabase.auth.onAuthStateChange(() => extract());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return tenantId;
}
