// Helper compartido para formatear errores de Supabase/PostgREST/Fetch a
// un mensaje legible. Evita mostrar "[object Object]" cuando el error es
// un PostgrestError u otro objeto sin toString util.
export function formatError(e: unknown): string {
  if (!e) return 'Error desconocido';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.message === 'string') parts.push(obj.message);
    if (typeof obj.details === 'string' && obj.details) parts.push(obj.details);
    if (typeof obj.hint === 'string' && obj.hint) parts.push(`hint: ${obj.hint}`);
    if (typeof obj.code === 'string' && obj.code) parts.push(`(code ${obj.code})`);
    if (parts.length > 0) return parts.join(' — ');
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}
