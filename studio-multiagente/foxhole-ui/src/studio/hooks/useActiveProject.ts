import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'arquitai.activeProjectId';

/**
 * Hook que gestiona el "proyecto activo" del Studio (B70 X7 Oficina Viva).
 *
 * Fuentes de verdad (en orden de prioridad):
 *   1. URL search param `?project=<uuid>` (si presente al cargar)
 *   2. localStorage `arquitai.activeProjectId`
 *   3. null (sin proyecto seleccionado)
 *
 * Cuando setActiveProjectId se llama:
 *   - Actualiza estado React
 *   - Persiste en localStorage
 *   - Reescribe el query param sin recargar (history.replaceState)
 *
 * NO depende de react-router (App.tsx tiene un router casero por estado).
 */
export function useActiveProject() {
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('project');
    if (fromUrl && isLikelyUuid(fromUrl)) {
      try {
        window.localStorage.setItem(STORAGE_KEY, fromUrl);
      } catch {
        /* storage no disponible */
      }
      return fromUrl;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored && isLikelyUuid(stored) ? stored : null;
    } catch {
      return null;
    }
  });

  // Sincroniza URL si el estado cambia desde fuera (ej. cuando se hace setActive)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get('project');
    if (activeProjectId && current !== activeProjectId) {
      url.searchParams.set('project', activeProjectId);
      window.history.replaceState({}, '', url.toString());
    } else if (!activeProjectId && current) {
      url.searchParams.delete('project');
      window.history.replaceState({}, '', url.toString());
    }
  }, [activeProjectId]);

  const setActiveProjectId = useCallback((id: string | null) => {
    setActiveProjectIdState(id);
    if (typeof window === 'undefined') return;
    try {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { activeProjectId, setActiveProjectId };
}

function isLikelyUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
