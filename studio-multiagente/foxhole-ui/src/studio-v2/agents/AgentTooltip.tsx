import type { AgentDef, AgentState } from './agents-registry';

interface Props {
  agent: AgentDef;
  state: AgentState;
}

const STATE_LABEL: Record<AgentState, string> = {
  idle: 'idle',
  working: 'working',
  meeting: 'en reunion',
  failed: 'failed',
  waiting_approval: 'esperando aprobacion',
};

export function AgentTooltip({ agent, state }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 12px)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(20, 22, 26, 0.96)',
        color: '#f9f5ea',
        padding: '8px 12px',
        borderRadius: 8,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
        border: '1px solid rgba(255, 200, 80, 0.35)',
        minWidth: 140,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: agent.color,
            boxShadow: `0 0 6px ${agent.color}80`,
          }}
        />
        <span style={{ fontWeight: 600 }}>{agent.displayName}</span>
      </div>
      <div
        style={{
          fontSize: 10.5,
          opacity: 0.55,
          marginTop: 2,
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {STATE_LABEL[state]}
      </div>
    </div>
  );
}
