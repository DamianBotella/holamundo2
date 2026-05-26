/**
 * Posiciones visuales calibradas manualmente con el Position Editor Mode.
 *
 * Coordenadas normalizadas 0-1 dentro del PNG de la sala (el bbox del
 * sprite recortado por rembg). Anchor del agente = pies (bottom-center).
 *
 * Valores INICIALES estimados — Damian recalibra arrastrando cada agente
 * en el editor y exporta el bloque actualizado para pegarlo aqui.
 *
 * NOTA importante: estas posiciones SUSTITUYEN la proyeccion iso para
 * el RENDER VISUAL. El homeSpot (tile) en rooms.ts se mantiene como
 * anchor logico para futuro pathfinding.
 */

export interface AgentPosition {
  nx: number; // 0..1 horizontal dentro del PNG
  ny: number; // 0..1 vertical dentro del PNG (donde estan los pies)
}

export const AGENT_POSITIONS: Record<string, AgentPosition> = {
  // DIRECCION (4)
  main_orchestrator:     { nx: 0.50, ny: 0.55 },
  memory:                { nx: 0.35, ny: 0.65 },
  collab_coordinator:    { nx: 0.65, ny: 0.65 },
  decision_engine:       { nx: 0.50, ny: 0.75 },

  // RECEPCION (5)
  briefing:              { nx: 0.40, ny: 0.55 },
  client_concierge:      { nx: 0.55, ny: 0.55 },
  client_translator:     { nx: 0.30, ny: 0.70 },
  aftercare:             { nx: 0.65, ny: 0.70 },
  client_update:         { nx: 0.50, ny: 0.80 },

  // MESA DIBUJO (3)
  design:                { nx: 0.45, ny: 0.60 },
  sketch_to_scale:       { nx: 0.30, ny: 0.75 },
  proposal:              { nx: 0.65, ny: 0.75 },

  // BIBLIOTECA (5)
  regulatory:            { nx: 0.45, ny: 0.65 },
  normativa_refresh:     { nx: 0.30, ny: 0.65 },
  accessibility:         { nx: 0.60, ny: 0.65 },
  iee:                   { nx: 0.40, ny: 0.78 },
  compliance_audit:      { nx: 0.55, ny: 0.78 },

  // ARCHIVO (7)
  documents:             { nx: 0.30, ny: 0.60 },
  certificate_generator: { nx: 0.45, ny: 0.62 },
  permit_tracker:        { nx: 0.60, ny: 0.62 },
  qc_checklists:         { nx: 0.72, ny: 0.65 },
  telematic_filing:      { nx: 0.35, ny: 0.78 },
  catalog_sync:          { nx: 0.50, ny: 0.78 },
  grants_finder:         { nx: 0.65, ny: 0.78 },

  // DESPACHO CONTABLE (3)
  costs:                 { nx: 0.45, ny: 0.62 },
  financial_tracker:     { nx: 0.55, ny: 0.62 },
  contracts:             { nx: 0.50, ny: 0.78 },

  // TALLER GREMIOS (6)
  trades:                { nx: 0.30, ny: 0.62 },
  trade_comms:           { nx: 0.45, ny: 0.62 },
  materials:             { nx: 0.60, ny: 0.62 },
  rcd:                   { nx: 0.35, ny: 0.78 },
  home_automation:       { nx: 0.50, ny: 0.78 },
  site_monitor:          { nx: 0.65, ny: 0.78 },

  // TERRAZA INSPECCION (6)
  anomaly_detector:      { nx: 0.30, ny: 0.62 },
  pathology:             { nx: 0.45, ny: 0.62 },
  safety_plan:           { nx: 0.60, ny: 0.62 },
  energy_assessor:       { nx: 0.35, ny: 0.78 },
  acta_obra:             { nx: 0.50, ny: 0.78 },
  incident_handler:      { nx: 0.65, ny: 0.78 },
};

/** Formatea el dict como bloque TS listo para pegar (used by Export button). */
export function formatPositionsBlock(positions: Record<string, AgentPosition>): string {
  const lines: string[] = ['export const AGENT_POSITIONS: Record<string, AgentPosition> = {'];
  const maxIdLen = Math.max(...Object.keys(positions).map(k => k.length));
  for (const [id, p] of Object.entries(positions)) {
    const pad = ' '.repeat(maxIdLen - id.length);
    lines.push(`  ${id}:${pad} { nx: ${p.nx.toFixed(2)}, ny: ${p.ny.toFixed(2)} },`);
  }
  lines.push('};');
  return lines.join('\n');
}
