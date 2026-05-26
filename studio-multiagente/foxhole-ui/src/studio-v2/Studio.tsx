/**
 * Studio v2 - CAMINO A (navegacion sala-a-sala estilo Habbo).
 *
 * Reemplaza la composicion isometrica unificada del v1.0 (incompatible con
 * las paredes traseras de los PNGs de Gemini). Una sala visible a la vez,
 * puertas como hotspots clickeables. Backend (rooms.ts, pathfinding.ts,
 * agent-conflicts.ts, types.ts, iso-math.ts) NO se modifica.
 */
import { StudioNavigator } from './StudioNavigator';

export function Studio() {
  return <StudioNavigator />;
}
