/**
 * Calcula la posicion destino (world ortogonal) de un agente segun su estado
 * (B72 Paso 2 — La Oficina Viva).
 *
 *   idle              -> cafeteria/terraza (pos por indice de agente)
 *   working sin reunion-> su mesa (default_position en su sala)
 *   working en reunion -> sala de reuniones alrededor de la mesa
 *   waiting_approval  -> su mesa (visible, pulsa orb amarillo)
 *   failed            -> corredor de urgencias
 *
 * Una "reunion" se detecta cuando 2+ agentes en state=working comparten
 * algun project_id en active_project_ids. Se elige el proyecto con MAS
 * agentes y esos agentes van a la sala de reuniones.
 */

import type { StudioAgent, StudioRoom } from '@/lib/types';
import {
  IDLE_POSITIONS,
  MEETING_POSITIONS,
  FAILED_POSITIONS,
  type WorldPosition,
} from './data/agentPositions';

/**
 * Devuelve la posicion world por defecto del agente: la mesa en su sala.
 * Es la suma room.bounding_box + agent.default_position.
 */
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
 * Detecta agentes en reunion: 2+ con state=working compartiendo proyecto.
 * Devuelve un Set de agent_name ordenado para asignar posiciones estables.
 *
 * No requiere mucha precision: si hay 3 proyectos compartidos, elige el
 * mas grande. Si todos son 1 a 1 (sin solape) devuelve set vacio.
 */
export function detectMeetingAgents(agents: StudioAgent[]): {
  meetingNames: string[];
  meetingProjectId: string | null;
} {
  const working = agents.filter(
    (a) => a.state === 'working' && Array.isArray(a.active_project_ids) && a.active_project_ids.length > 0,
  );
  if (working.length < 2) return { meetingNames: [], meetingProjectId: null };

  // project_id -> agent_names que lo tienen activo
  const byProject = new Map<string, string[]>();
  for (const a of working) {
    for (const pid of a.active_project_ids ?? []) {
      const list = byProject.get(pid) ?? [];
      list.push(a.agent_name);
      byProject.set(pid, list);
    }
  }

  // Mejor proyecto: el que tiene mas agentes (>=2)
  let bestPid: string | null = null;
  let bestNames: string[] = [];
  for (const [pid, names] of byProject) {
    if (names.length >= 2 && names.length > bestNames.length) {
      bestPid = pid;
      bestNames = names;
    }
  }

  return {
    meetingNames: bestNames.slice().sort(), // sort estable para asignacion por indice
    meetingProjectId: bestPid,
  };
}

/**
 * Calcula la posicion world destino del agente segun su estado y el contexto
 * de reunion. Devuelve null si la sala del agente no existe.
 */
export function getAgentTargetWorldPosition(
  agent: StudioAgent,
  agentIndex: number,
  roomMap: Map<string, StudioRoom>,
  meetingNames: string[],
): WorldPosition | null {
  // failed: van al corredor de urgencias
  if (agent.state === 'failed') {
    return FAILED_POSITIONS[agentIndex % FAILED_POSITIONS.length];
  }

  // idle: van a la cafeteria/terraza
  if (agent.state === 'idle') {
    return IDLE_POSITIONS[agentIndex % IDLE_POSITIONS.length];
  }

  // working en reunion: van a la sala de reuniones alrededor de la mesa
  if (agent.state === 'working') {
    const meetingIdx = meetingNames.indexOf(agent.agent_name);
    if (meetingIdx !== -1) {
      return MEETING_POSITIONS[meetingIdx % MEETING_POSITIONS.length];
    }
    // working sin reunion: a su mesa
    return getDefaultWorldPosition(agent, roomMap);
  }

  // waiting_approval: en su mesa, visible. El orb amarillo pulsante indica
  // que esta esperando.
  return getDefaultWorldPosition(agent, roomMap);
}
