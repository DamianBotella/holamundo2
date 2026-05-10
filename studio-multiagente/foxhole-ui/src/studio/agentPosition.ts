/**
 * Posicion world ortogonal del agente segun su estado (B72-rediseno PASO 3+4).
 *
 * Mapping de estado a destino:
 *   working           -> su workstation (default_position en su sala) = donde
 *                         "trabaja" en su mesa
 *   waiting_approval  -> mismo que working (visible en su mesa, orb amarillo)
 *   idle              -> seat en terraza-cafe (asignado por indice alfabetico
 *                         de agent_name para que sea estable)
 *   failed            -> pos en corredor de urgencias (asignado por indice)
 *   "meeting" (virtual) -> seat alrededor de la mesa de reuniones (cuando 2+
 *                         agentes comparten project_id)
 *
 * Las coords son world ortogonales absolutas (mismo sistema que
 * room.bounding_box). El canvas las proyecta a iso al renderizar.
 *
 * Sin animacion de movimiento todavia: el agente se renderiza en la posicion
 * destino directamente. La interpolacion ticker queda para B72-movimiento.
 */

import type { StudioAgent, StudioRoom } from '@/lib/types';
import {
  IDLE_POSITIONS,
  MEETING_POSITIONS,
  FAILED_POSITIONS,
  type WorldPosition,
} from './data/agentPositions';

export function getAgentWorldPosition(
  agent: StudioAgent,
  agentIndex: number,
  roomMap: Map<string, StudioRoom>,
  meetingNames: string[],
): WorldPosition | null {
  // FAILED: corredor de urgencias (asignado por indice alfabetico)
  if (agent.state === 'failed') {
    return FAILED_POSITIONS[agentIndex % FAILED_POSITIONS.length];
  }

  // IDLE: terraza-cafe (asignado por indice alfabetico)
  if (agent.state === 'idle') {
    return IDLE_POSITIONS[agentIndex % IDLE_POSITIONS.length];
  }

  // WORKING en reunion: mesa de reuniones (solo si hay reunion activa Y
  // este agente esta en ella)
  if (agent.state === 'working') {
    const meetingIdx = meetingNames.indexOf(agent.agent_name);
    if (meetingIdx !== -1) {
      return MEETING_POSITIONS[meetingIdx % MEETING_POSITIONS.length];
    }
    // sin reunion: a su mesa
    return getDefaultWorldPosition(agent, roomMap);
  }

  // WAITING_APPROVAL: en su mesa, visible (orb amarillo pulsante indica espera)
  return getDefaultWorldPosition(agent, roomMap);
}

/** Default = mesa del agente segun agents_catalog.default_position */
export function getDefaultWorldPosition(
  agent: StudioAgent,
  roomMap: Map<string, StudioRoom>,
): WorldPosition | null {
  const room = roomMap.get(agent.room_id);
  if (!room) return null;
  return {
    x: room.bounding_box.x + agent.default_position.x,
    y: room.bounding_box.y + agent.default_position.y,
  };
}

/**
 * Detector de reunion: 2+ agentes con state=working compartiendo algun
 * project_id en active_project_ids. Devuelve nombres del proyecto MAS
 * grande, ordenados alfabeticamente para asignacion estable de seats.
 */
export function detectMeetingAgents(agents: StudioAgent[]): {
  meetingNames: string[];
  meetingProjectId: string | null;
} {
  const working = agents.filter(
    (a) =>
      a.state === 'working' &&
      Array.isArray(a.active_project_ids) &&
      a.active_project_ids.length > 0,
  );
  if (working.length < 2) return { meetingNames: [], meetingProjectId: null };

  const byProject = new Map<string, string[]>();
  for (const a of working) {
    for (const pid of a.active_project_ids ?? []) {
      const list = byProject.get(pid) ?? [];
      list.push(a.agent_name);
      byProject.set(pid, list);
    }
  }

  let bestPid: string | null = null;
  let bestNames: string[] = [];
  for (const [pid, names] of byProject) {
    if (names.length >= 2 && names.length > bestNames.length) {
      bestPid = pid;
      bestNames = names;
    }
  }

  return {
    meetingNames: bestNames.slice().sort(),
    meetingProjectId: bestPid,
  };
}
