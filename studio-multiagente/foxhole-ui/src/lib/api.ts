import type {
  ProjectSummary,
  DashboardMetrics,
  Alert,
  MyProfile,
  StudioAgent,
  StudioRoom,
  StudioFeedEvent,
  PendingApproval,
  ApprovalDecisionResult,
  AgentChatResponse,
  CreateProjectPayload,
  CreateProjectResponse,
} from './types';
import { mockProfile, mockProjects, mockMetrics, mockAlerts } from './mock-data';
import { getAccessToken } from './session';
import { supabase } from './supabase';

const API_BASE = (import.meta.env.VITE_N8N_API_BASE as string) || '';
const FORCE_MOCK = import.meta.env.VITE_FORCE_MOCK === 'true';
const HAS_BACKEND = !FORCE_MOCK && Boolean(API_BASE);

export interface TimelineEvent {
  id: string;
  timestamp: string;
  agent_name: string | null;
  action: string | null;
  status: string | null;
  output_summary: string | null;
  details: Record<string, unknown>;
}

interface EnvelopeResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  if (!HAS_BACKEND) {
    throw new Error('NO_BACKEND');
  }
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init?.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    await supabase.auth.signOut();
    throw new Error(`API 401: unauthorized`);
  }
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function withMockFallback<T>(realCall: () => Promise<T>, mockValue: T): Promise<T> {
  try {
    return await realCall();
  } catch (e) {
    if (HAS_BACKEND) console.warn('API fallback to mock:', e);
    return mockValue;
  }
}

export const api = {
  me: () =>
    withMockFallback<MyProfile>(async () => {
      const r = await fetchAPI<EnvelopeResponse<MyProfile & { tenant?: { id: string; name: string } }>>('/me');
      // El endpoint /me devuelve { data: { ..., tenant: { id, name, slug, subscription_tier } } }
      // Aplanamos a la forma que espera el frontend (MyProfile).
      const d = r.data;
      const tenant = (d as unknown as { tenant?: { id: string; name: string } }).tenant;
      return {
        user_id: d.user_id,
        email: d.email,
        full_name: d.full_name,
        role: d.role,
        tenant_id: tenant?.id ?? d.tenant_id,
        tenant_name: tenant?.name ?? d.tenant_name,
      };
    }, mockProfile),

  projects: () =>
    withMockFallback<ProjectSummary[]>(
      async () => {
        const r = await fetchAPI<EnvelopeResponse<ProjectSummary[]>>('/projects');
        return r.data;
      },
      mockProjects,
    ),

  projectDetail: (id: string) =>
    withMockFallback<ProjectSummary | null>(
      async () => {
        const r = await fetchAPI<EnvelopeResponse<ProjectSummary>>(
          `/project-detail?id=${encodeURIComponent(id)}`,
        );
        return r.data;
      },
      mockProjects.find((p) => p.id === id) || null,
    ),

  projectTimeline: (id: string) =>
    withMockFallback<TimelineEvent[]>(
      async () => {
        const r = await fetchAPI<EnvelopeResponse<TimelineEvent[]>>(
          `/project-timeline?id=${encodeURIComponent(id)}&limit=50`,
        );
        return r.data;
      },
      [],
    ),

  metrics: () =>
    withMockFallback<DashboardMetrics>(async () => {
      const r = await fetchAPI<EnvelopeResponse<DashboardMetrics>>('/metrics/dashboard');
      return r.data;
    }, mockMetrics),

  alerts: () =>
    withMockFallback<Alert[]>(
      async () => {
        const r = await fetchAPI<EnvelopeResponse<Alert[]>>('/alerts/global?limit=50');
        return r.data;
      },
      mockAlerts,
    ),

  studioAgents: () =>
    withMockFallback<StudioAgent[]>(
      async () => {
        const r = await fetchAPI<EnvelopeResponse<StudioAgent[]>>('/studio/agents');
        return r.data;
      },
      [],
    ),

  studioRooms: () =>
    withMockFallback<StudioRoom[]>(
      async () => {
        const r = await fetchAPI<EnvelopeResponse<StudioRoom[]>>(
          `/studio/rooms?_=${Date.now()}`,
          {
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          },
        );
        return r.data;
      },
      [],
    ),

  studioFeed: (since?: string, limit = 30) =>
    withMockFallback<StudioFeedEvent[]>(
      async () => {
        const qs = new URLSearchParams();
        if (since) qs.set('since', since);
        qs.set('limit', String(limit));
        const r = await fetchAPI<EnvelopeResponse<StudioFeedEvent[]>>(
          `/studio/feed?${qs.toString()}`,
        );
        return r.data;
      },
      [],
    ),

  pendingApprovals: () =>
    withMockFallback<PendingApproval[]>(
      async () => {
        const r = await fetchAPI<EnvelopeResponse<PendingApproval[]>>(
          '/studio/pending-approvals',
        );
        return r.data;
      },
      [],
    ),

  submitApprovalDecision: async (
    approvalId: string,
    decision: 'approve' | 'reject',
    notes?: string,
  ): Promise<ApprovalDecisionResult> => {
    const r = await fetchAPI<EnvelopeResponse<ApprovalDecisionResult>>(
      '/approval-decision',
      {
        method: 'POST',
        body: JSON.stringify({ approval_id: approvalId, decision, notes }),
      },
    );
    return r.data;
  },

  agentChat: async (agentName: string, message: string): Promise<AgentChatResponse> => {
    const r = await fetchAPI<EnvelopeResponse<AgentChatResponse>>(
      '/studio/agent-chat',
      {
        method: 'POST',
        body: JSON.stringify({ agent_name: agentName, message }),
      },
    );
    return r.data;
  },

  createProject: async (payload: CreateProjectPayload): Promise<CreateProjectResponse> => {
    const r = await fetchAPI<EnvelopeResponse<CreateProjectResponse>>(
      '/projects/create',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    return r.data;
  },
};

export const isUsingMock = !HAS_BACKEND;
