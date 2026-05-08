/**
 * Paleta ArquitAI — tematica estudio de arquitectura tecnica.
 * Spec: X7_CAMBIO_TEMATICA_VISUAL.pdf seccion 3.
 * Reemplaza la paleta militar Foxhole por tonos calidos de oficina profesional.
 */
export const PALETTE = {
  // Fondos
  bgCanvas:     '#2C2820',
  bgPaper:      '#3f3227',
  bgPaper2:     '#4a3c2e',
  bgPanel:      '#2a2218',
  bgWall:       '#2d2520',

  // Suelos por tipo (oficina arquitectura)
  floorDesign:  '#E8E4D8',
  floorLibrary: '#D4C9B0',
  floorOffice:  '#C8D4DC',
  floorMeeting: '#D8D0C4',
  floorTerrace: '#B8C4A8',
  floorWorkshop:'#C4C0B8',
  floorUrgency: '#C4B4A8',

  // Acentos UI
  olive:        '#556B2F',
  oliveBright:  '#84BC9C',
  tan:          '#B49B6E',
  bone:         '#E8E0CC',
  boneDim:      '#A89880',

  // Estados
  stateIdle:    '#7A8A70',
  stateWorking: '#84BC9C',
  stateWaiting: '#E0A85C',
  stateFailed:  '#8B2E1F',

  // Facciones
  factionCore:  '#5C7A9C',
  factionAux:   '#7A6B4A',
  factionUtil:  '#5A6B5A',
  factionOrch:  '#C7A36E',

  // Bordes
  borderStrong: '#5B4A38',
  borderSubtle: '#3A3028',
} as const;

export const STATE_LABEL = {
  idle: 'Idle',
  working: 'Trabajando',
  waiting_approval: 'Esperando aprobacion',
  failed: 'Error',
} as const;

import type { AgentState, StudioAgent } from '@/lib/types';

export function colorForState(s: AgentState): string {
  switch (s) {
    case 'working':          return PALETTE.stateWorking;
    case 'waiting_approval': return PALETTE.stateWaiting;
    case 'failed':           return PALETTE.stateFailed;
    default:                 return PALETTE.stateIdle;
  }
}

export function colorForCategory(c: StudioAgent['category']): string {
  switch (c) {
    case 'orchestrator': return PALETTE.factionOrch;
    case 'core':         return PALETTE.factionCore;
    case 'util':         return PALETTE.factionUtil;
    default:             return PALETTE.factionAux;
  }
}

/** Mapeo room_id -> SVG pattern_id (textura procedural por tipo de suelo) */
export const ROOM_PATTERN: Record<string, string> = {
  reception:         'pat-paper',
  drawing_room:      'pat-wood',
  normative_library: 'pat-wood-dark',
  accounting_office: 'pat-wood',
  main_office:       'pat-stone',
  meeting_room:      'pat-stone',
  site_terrace:      'pat-concrete',
  trades_workshop:   'pat-wood',
  archive:           'pat-wood-dark',
  urgency_corridor:  'pat-urgency',
};
