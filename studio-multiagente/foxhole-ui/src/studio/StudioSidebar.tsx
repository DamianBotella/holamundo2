import type { StudioAgent } from '@/lib/types';
import { ActivityFeed } from './ActivityFeed';
import { AgentChatPanel } from './AgentChatPanel';

interface Props {
  selectedAgent: StudioAgent | null;
}

/**
 * Panel lateral derecho — sec 3.1 del spec: 320px fijo, contiene activity feed
 * y chat/inspeccion del agente seleccionado, apilados verticalmente.
 */
export function StudioSidebar({ selectedAgent }: Props) {
  return (
    <aside
      className="flex flex-col gap-3 h-full"
      style={{ width: 320, flexShrink: 0 }}
    >
      <div className="flex-1 min-h-0">
        <ActivityFeed />
      </div>
      <div className="flex-1 min-h-0">
        <AgentChatPanel agent={selectedAgent} />
      </div>
    </aside>
  );
}
