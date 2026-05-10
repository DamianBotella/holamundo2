/**
 * Posicion world ortogonal del agente segun su estado (B72-rediseno PASO 3+4).
 *
 * REGLA CENTRAL: por DEFECTO el agente esta SIEMPRE en su mesa (su sala).
 * Idle = "esperando trabajo en mi puesto", NO "descanso en la cafeteria".
 * Solo cambia de sala cuando hay un evento explicito (failed -> urgencias,
 * meeting con companeros -> sala reuniones).
 *
 * Mapping definitivo:
 *   working sin reunion  -> su mesa (default_position en su sala)
 *   working en reunion   -> seat alrededor mesa de reuniones (si 2+
 *                            agentes comparten active_project_ids)
 *   waiting_approval     -> su mesa (orb amarillo pulsante)
 *   idle                 -> su mesa (esperando trabajo)
 *   failed               -> pos en corredor de urgencias (asignado por indice
 *                            estable para distribuir a lo largo del pasillo)
 *
 * Sin animacion todavia: el agente se renderiza en la posicion destino
 * directamente. La interpolacion ticker queda para B72-movimiento.
 *
 * IDLE_POSITIONS (terraza-cafe) se reserva para iteracion futura: lugar al
 * que un agente se desplaza si lleva > X tiempo en idle. Por ahora no se
 * usa para no apilar a todos los agentes al arrancar la app.
 */

import type { StudioAgent, StudioRoom } from '@/lib/types';
import {
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
  // FAILED: corredor de urgencias (distribuido por indice estable)
  if (agent.state === 'failed') {
    return FAILED_POSITIONS[agentIndex % FAILED_POSITIONS.length];
  }

  // WORKING en reunion: mesa de reuniones (solo si hay reunion activa Y
  // este agente esta en ella)
  if (agent.state === 'working') {
    const meetingIdx = meetingNames.indexOf(agent.agent_name);
    if (meetingIdx !== -1) {
      return MEETING_POSITIONS[meetingIdx % MEETING_POSITIONS.length];
    }
  }

  // working sin reunion / waiting_approval / idle: SIEMPRE a su mesa.
  // Es el comportamiento por defecto (los agentes "viven" en su sala).
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
