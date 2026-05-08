// Barrel export del modulo studio (sec 6.2 del spec FOXHOLE_VISUAL_X7).
// Permite imports limpios desde el resto de la app:
//   import { StudioCanvas, ActivityFeed, ApprovalPanel, AgentChatPanel } from '@/studio';

export { StudioCanvas } from './StudioCanvas';
export { drawRoom } from './StudioRoom';
export { drawAgent } from './StudioAgent';
export { ActivityFeed } from './ActivityFeed';
export { ApprovalPanel } from './ApprovalPanel';
export { AgentChatPanel } from './AgentChatPanel';
export { StudioSidebar } from './StudioSidebar';

export { useStudioRooms } from './hooks/useStudioRooms';
export { useStudioAgents } from './hooks/useStudioAgents';
export { useActivityFeed } from './hooks/useActivityFeed';
export { usePendingApprovals, useSubmitApprovalDecision } from './hooks/usePendingApprovals';

export { PALETTE, STATE_LABEL, colorForState, colorForCategory, ROOM_PATTERN } from './palette';
export { acquireStudio, releaseStudio, getStudio } from './pixiSingleton';
