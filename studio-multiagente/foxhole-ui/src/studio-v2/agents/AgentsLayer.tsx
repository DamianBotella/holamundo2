import { useMemo } from 'react';
import { AGENTS, INITIAL_AGENT_STATE } from './agents-registry';
import type { AgentPosition } from './agents-positions';
import { AgentSprite } from './AgentSprite';
import { useAgentsBobbing } from './useAgentsBobbing';

interface Props {
  activeRoomId: string;
  /** Bbox del PNG dentro del canvas (calculado por RoomView). */
  roomPng: { left: number; top: number; width: number; height: number };
  /** Escala del slider HUD — solo afecta TAMANO del sprite, no posicion. */
  sizeScale: number;
  /** Diccionario de posiciones actuales (positions del state, no del archivo estatico). */
  positions: Record<string, AgentPosition>;
  /** Modo editor activo? */
  editorMode: boolean;
  /** Callback cuando un agente termina de arrastrarse. */
  onPositionCommit: (agentId: string, nx: number, ny: number) => void;
}

/**
 * Capa que renderiza los agentes cuyo currentRoomId === activeRoomId.
 * Posicion VISUAL = bbox del PNG + (nx, ny) normalizado del agente.
 * Sin proyeccion iso. Z-order por ny (mayor = mas cerca del observador).
 */
export function AgentsLayer({
  activeRoomId,
  roomPng,
  sizeScale,
  positions,
  editorMode,
  onPositionCommit,
}: Props) {
  const bobbingPhase = useAgentsBobbing();

  const visible = useMemo(
    () => AGENTS.filter(a => INITIAL_AGENT_STATE[a.id].currentRoomId === activeRoomId),
    [activeRoomId],
  );

  if (!roomPng.width || !roomPng.height) return null;

  // Sort por ny ascendente -> los de arriba en el PNG se dibujan primero (atras)
  const sorted = [...visible].sort(
    (a, b) => (positions[a.id]?.ny ?? 0.5) - (positions[b.id]?.ny ?? 0.5),
  );

  return (
    <>
      {sorted.map(agent => {
        const pos = positions[agent.id] ?? { nx: 0.5, ny: 0.7 };
        const runtime = INITIAL_AGENT_STATE[agent.id];
        return (
          <AgentSprite
            key={agent.id}
            agent={agent}
            runtime={runtime}
            position={pos}
            roomPng={roomPng}
            sizeScale={sizeScale}
            bobbingPhase={bobbingPhase}
            editorMode={editorMode}
            onPositionCommit={onPositionCommit}
          />
        );
      })}
    </>
  );
}
