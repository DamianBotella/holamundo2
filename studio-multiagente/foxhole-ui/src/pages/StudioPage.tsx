import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { StudioAgent } from '@/lib/types';
import {
  StudioCanvas,
  useStudioRooms,
  useStudioAgents,
  PALETTE,
} from '@/studio';
import { StudioSidebar } from '@/studio/StudioSidebar';
import { ProjectSelector } from '@/studio/ProjectSelector';
import { useActiveProject } from '@/studio/hooks/useActiveProject';

interface Props {
  onBack: () => void;
}

// Spec sec 3.1: canvas total 1280x800, panel lateral derecho 320 fijo,
// canvas efectivo 960x800.
const TOTAL_W = 1280;
const TOTAL_H = 800;
const SIDEBAR_W = 320;
const CANVAS_W = TOTAL_W - SIDEBAR_W; // 960

export function StudioPage({ onBack }: Props) {
  const { data: rooms = [], error: roomsError, isLoading: roomsLoading } = useStudioRooms();
  const { data: agents = [], error: agentsError, isLoading: agentsLoading } = useStudioAgents();
  const { activeProjectId, setActiveProjectId } = useActiveProject();

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selectedAgent = useMemo<StudioAgent | null>(
    () => agents.find((a) => a.agent_name === selectedName) ?? null,
    [agents, selectedName],
  );

  const stats = useMemo(() => {
    const byState = { idle: 0, working: 0, waiting_approval: 0, failed: 0 };
    for (const a of agents) byState[a.state]++;
    return byState;
  }, [agents]);

  return (
    <div className="p-4 flex flex-col gap-3 items-center">
      {/* Header — ancho del wrapper canvas+sidebar */}
      <div className="flex items-center gap-4" style={{ width: TOTAL_W }}>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-foxhole-muted hover:text-foxhole-bone transition-colors font-mono uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" />
          Mapa global
        </button>
        <h1 className="foxhole-stencil text-base">Estudio operativo</h1>
        <ProjectSelector
          activeProjectId={activeProjectId}
          onChange={setActiveProjectId}
        />
        <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.2em] text-foxhole-muted">
          {agents.length} agentes · {rooms.length} habitaciones
        </span>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-[11px] font-mono" style={{ width: TOTAL_W }}>
        <Legend color={PALETTE.stateIdle}    label={`idle ${stats.idle}`} />
        <Legend color={PALETTE.stateWorking} label={`working ${stats.working}`} />
        <Legend color={PALETTE.stateWaiting} label={`waiting ${stats.waiting_approval}`} />
        <Legend color={PALETTE.stateFailed}  label={`failed ${stats.failed}`} />
      </div>

      {(roomsError || agentsError) && (
        <div className="foxhole-card p-3 border-foxhole-state-failed text-sm" style={{ width: TOTAL_W }}>
          Error cargando datos:
          <pre className="text-xs mt-1 whitespace-pre-wrap">
            {String(roomsError || agentsError)}
          </pre>
        </div>
      )}

      {/* Layout principal: canvas (960) + sidebar (320) = 1280 total */}
      <div
        className="flex gap-0 border border-foxhole-border-strong"
        style={{ width: TOTAL_W, height: TOTAL_H }}
      >
        <div style={{ width: CANVAS_W, height: TOTAL_H }}>
          <StudioCanvas
            rooms={rooms}
            agents={agents}
            selectedAgentName={selectedName}
            onSelectAgent={(a) => setSelectedName(a.agent_name)}
            loading={roomsLoading || agentsLoading}
          />
        </div>
        <div style={{ width: SIDEBAR_W, height: TOTAL_H }} className="border-l border-foxhole-border-strong">
          <StudioSidebar selectedAgent={selectedAgent} activeProjectId={activeProjectId} />
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-foxhole-muted uppercase tracking-wider">
      <span
        className="inline-block w-2.5 h-2.5"
        style={{ backgroundColor: color, border: '1px solid rgba(0,0,0,0.4)' }}
      />
      {label}
    </span>
  );
}
