/**
 * Registry de los 39 agentes del studio-v2 (MVP estatico populado).
 *
 * Cada agente: archetype (1 de 8 sprites) + color (overlay identificacion) +
 * roomId. El tile se resuelve desde rooms.ts.agentSpots con un lookup
 * defensivo (algunos IDs llevan prefijo 'agent_' en rooms.ts, otros no).
 *
 * No depende del backend (pathfinding/conflicts). MVP solo idle + working.
 */

import { STUDIO_ROOMS } from '../rooms';
import type { Vec2 } from '../iso-math';

export type Archetype =
  | 'executive' | 'welcome' | 'designer' | 'scholar'
  | 'clerk' | 'accountant' | 'operator' | 'inspector';

export type AgentState = 'idle' | 'working' | 'meeting' | 'failed' | 'waiting_approval';

export interface AgentDef {
  id: string;
  displayName: string;
  archetype: Archetype;
  color: string;
  roomId: string;
}

export interface AgentRuntime {
  state: AgentState;
  currentRoomId: string;
  currentTile: Vec2;
}

// Paleta del brief visual
export const COLOR = {
  terracotta:  '#C97C5D',
  navy:        '#1E3A5F',
  brass:       '#B08D57',
  cream:       '#F5E6D3',
  sage:        '#6B8E5A',
  olive:       '#6B7A3B',
  burgundy:    '#722F37',
  charcoal:    '#36454F',
  orange:      '#FF6B35',
  ocre:        '#C49A45',
} as const;

export const AGENTS: AgentDef[] = [
  // EJECUTIVO (4) - Direccion
  { id: 'main_orchestrator',   displayName: 'Orquestador Principal',  archetype: 'executive', color: COLOR.terracotta, roomId: 'direction' },
  { id: 'memory',              displayName: 'Memoria',                archetype: 'executive', color: COLOR.navy,       roomId: 'direction' },
  { id: 'collab_coordinator',  displayName: 'Coordinador Colab',      archetype: 'executive', color: COLOR.brass,      roomId: 'direction' },
  { id: 'decision_engine',     displayName: 'Motor de Decision',      archetype: 'executive', color: COLOR.navy,       roomId: 'direction' },

  // WELCOME (5) - Recepcion
  { id: 'briefing',            displayName: 'Briefing Cliente',       archetype: 'welcome',   color: COLOR.cream,      roomId: 'reception' },
  { id: 'client_concierge',    displayName: 'Concierge Cliente',      archetype: 'welcome',   color: COLOR.navy,       roomId: 'reception' },
  { id: 'client_translator',   displayName: 'Traductor Cliente',      archetype: 'welcome',   color: COLOR.cream,      roomId: 'reception' },
  { id: 'aftercare',           displayName: 'Aftercare',              archetype: 'welcome',   color: COLOR.sage,       roomId: 'reception' },
  { id: 'client_update',       displayName: 'Update Semanal Cliente', archetype: 'welcome',   color: COLOR.sage,       roomId: 'reception' },

  // DISENADOR (3) - Mesa Dibujo
  { id: 'design',              displayName: 'Diseno',                 archetype: 'designer',  color: COLOR.terracotta, roomId: 'drawing_room' },
  { id: 'sketch_to_scale',     displayName: 'Sketch a Escala',        archetype: 'designer',  color: COLOR.terracotta, roomId: 'drawing_room' },
  { id: 'proposal',            displayName: 'Propuesta',              archetype: 'designer',  color: COLOR.terracotta, roomId: 'drawing_room' },

  // ACADEMICO (5) - Biblioteca
  { id: 'regulatory',          displayName: 'Normativa',              archetype: 'scholar',   color: COLOR.olive,      roomId: 'library' },
  { id: 'normativa_refresh',   displayName: 'Refresh Normativa',      archetype: 'scholar',   color: COLOR.olive,      roomId: 'library' },
  { id: 'accessibility',       displayName: 'Accesibilidad',          archetype: 'scholar',   color: COLOR.olive,      roomId: 'library' },
  { id: 'iee',                 displayName: 'IEE',                    archetype: 'scholar',   color: COLOR.burgundy,   roomId: 'library' },
  { id: 'compliance_audit',    displayName: 'Auditoria Compliance',   archetype: 'scholar',   color: COLOR.burgundy,   roomId: 'library' },

  // ADMINISTRATIVO (7) - Archivo
  { id: 'documents',           displayName: 'Documentos',             archetype: 'clerk',     color: COLOR.cream,      roomId: 'archive' },
  { id: 'certificate_generator', displayName: 'Certificados',         archetype: 'clerk',     color: COLOR.cream,      roomId: 'archive' },
  { id: 'permit_tracker',      displayName: 'Licencias',              archetype: 'clerk',     color: COLOR.cream,      roomId: 'archive' },
  { id: 'qc_checklists',       displayName: 'QC Checklists',          archetype: 'clerk',     color: COLOR.cream,      roomId: 'archive' },
  { id: 'telematic_filing',    displayName: 'Presentacion Telematica',archetype: 'clerk',     color: COLOR.cream,      roomId: 'archive' },
  { id: 'catalog_sync',        displayName: 'Sync Catalogos',         archetype: 'clerk',     color: COLOR.cream,      roomId: 'archive' },
  { id: 'grants_finder',       displayName: 'Buscador Ayudas',        archetype: 'clerk',     color: COLOR.cream,      roomId: 'archive' },

  // CONTABLE (3) - Despacho Contable
  { id: 'costs',               displayName: 'Costes',                 archetype: 'accountant',color: COLOR.brass,      roomId: 'accounting' },
  { id: 'financial_tracker',   displayName: 'Tracker Financiero',     archetype: 'accountant',color: COLOR.charcoal,   roomId: 'accounting' },
  { id: 'contracts',           displayName: 'Contratos',              archetype: 'accountant',color: COLOR.charcoal,   roomId: 'accounting' },

  // OPERARIO (6) - Taller Gremios
  { id: 'trades',              displayName: 'Gremios',                archetype: 'operator',  color: COLOR.orange,     roomId: 'workshop' },
  { id: 'trade_comms',         displayName: 'Comm Gremios',           archetype: 'operator',  color: COLOR.orange,     roomId: 'workshop' },
  { id: 'materials',           displayName: 'Materiales',             archetype: 'operator',  color: COLOR.terracotta, roomId: 'workshop' },
  { id: 'rcd',                 displayName: 'RCD',                    archetype: 'operator',  color: COLOR.sage,       roomId: 'workshop' },
  { id: 'home_automation',     displayName: 'Domotica',               archetype: 'operator',  color: COLOR.ocre,       roomId: 'workshop' },
  { id: 'site_monitor',        displayName: 'Monitor Obra',           archetype: 'operator',  color: COLOR.ocre,       roomId: 'workshop' },

  // INSPECTOR (6) - Terraza Inspeccion
  { id: 'anomaly_detector',    displayName: 'Detector Anomalias',     archetype: 'inspector', color: COLOR.charcoal,   roomId: 'inspection_terrace' },
  { id: 'pathology',           displayName: 'Patologias',             archetype: 'inspector', color: COLOR.charcoal,   roomId: 'inspection_terrace' },
  { id: 'safety_plan',         displayName: 'Plan Seguridad',         archetype: 'inspector', color: COLOR.ocre,       roomId: 'inspection_terrace' },
  { id: 'energy_assessor',     displayName: 'Asesor Energetico',      archetype: 'inspector', color: COLOR.ocre,       roomId: 'inspection_terrace' },
  { id: 'acta_obra',           displayName: 'Cronista de Obra',       archetype: 'inspector', color: COLOR.terracotta, roomId: 'inspection_terrace' },
  { id: 'incident_handler',    displayName: 'Gestor Imprevistos',     archetype: 'inspector', color: COLOR.ocre,       roomId: 'inspection_terrace' },
];

/**
 * Fallback de spots para agentes que no estan aun en rooms.ts.agentSpots
 * (PATCH v1.1 pendiente de aplicar al backend). Tiles walkable elegidos
 * a mano evitando colisiones con spots existentes.
 */
const FALLBACK_SPOTS: Record<string, Vec2> = {
  client_update:    { x: 7, y: 4 },  // reception: lateral derecho, briefing(5,4) + concierge(2,4) ocupados
  acta_obra:        { x: 2, y: 2 },  // inspection_terrace: site_monitor(4,2)
  incident_handler: { x: 6, y: 2 },  // inspection_terrace
};

/**
 * Resuelve el tile del homeSpot de un agente. Lookup defensivo:
 * 1. rooms[roomId].agentSpots[id] (caso main_orchestrator)
 * 2. rooms[roomId].agentSpots['agent_'+id] (caso prefijado)
 * 3. FALLBACK_SPOTS[id] (3 nuevos pendientes de patch)
 * 4. {x:1, y:1} (ultimo recurso, evita crash)
 */
export function findHomeSpot(roomId: string, agentId: string): Vec2 {
  const room = STUDIO_ROOMS[roomId];
  if (room) {
    if (room.agentSpots[agentId]) return room.agentSpots[agentId];
    const prefixed = 'agent_' + agentId;
    if (room.agentSpots[prefixed]) return room.agentSpots[prefixed];
  }
  if (FALLBACK_SPOTS[agentId]) return FALLBACK_SPOTS[agentId];
  return { x: 1, y: 1 };
}

/**
 * Estado runtime inicial. Cada 7mo agente queda en 'working' para que el
 * usuario pueda ver bobbing.
 */
export const INITIAL_AGENT_STATE: Record<string, AgentRuntime> = Object.fromEntries(
  AGENTS.map((a, idx) => [
    a.id,
    {
      state: (idx % 7 === 0 ? 'working' : 'idle') as AgentState,
      currentRoomId: a.roomId,
      currentTile: findHomeSpot(a.roomId, a.id),
    },
  ]),
);

export const AGENTS_BY_ID: Record<string, AgentDef> = Object.fromEntries(
  AGENTS.map(a => [a.id, a]),
);
