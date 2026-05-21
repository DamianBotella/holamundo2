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
  ConversationHistoryResponse,
  ProjectDeliverables,
  BillingSubscriptionResponse,
  CheckoutSessionResponse,
  PortalSessionResponse,
  BillingTier,
  BIDashboardData,
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

  agentChat: async (
    agentName: string,
    message: string,
    projectId?: string | null,
  ): Promise<AgentChatResponse> => {
    const r = await fetchAPI<EnvelopeResponse<AgentChatResponse>>(
      '/studio/agent-chat',
      {
        method: 'POST',
        body: JSON.stringify({
          agent_name: agentName,
          message,
          ...(projectId ? { project_id: projectId } : {}),
        }),
      },
    );
    return r.data;
  },

  agentConversation: async (
    agentName: string,
    projectId?: string | null,
    limit = 30,
  ): Promise<ConversationHistoryResponse> => {
    const qs = new URLSearchParams({ agent_name: agentName, limit: String(limit) });
    if (projectId) qs.set('project_id', projectId);
    const r = await fetchAPI<EnvelopeResponse<ConversationHistoryResponse>>(
      `/studio/conversations?${qs.toString()}`,
      {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      },
    );
    return r.data;
  },

  // B67 — Deliverables y agentes pre-launch
  projectDeliverables: async (projectId: string): Promise<ProjectDeliverables> => {
    const r = await fetchAPI<EnvelopeResponse<ProjectDeliverables>>(
      `/project-deliverables?id=${encodeURIComponent(projectId)}&_=${Date.now()}`,
      { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } },
    );
    return r.data;
  },

  runGrantsFinder: async (projectId: string): Promise<unknown> => {
    const r = await fetchAPI<EnvelopeResponse<unknown>>(
      '/agents/grants-finder/analyze',
      { method: 'POST', body: JSON.stringify({ project_id: projectId }) },
    );
    return r.data;
  },

  runRCD: async (
    projectId: string,
    opts?: { tipo_obra_override?: string; anio_edificio?: number },
  ): Promise<{ draft_id: string; total_toneladas: number; alertas_peligrosos: unknown[] }> => {
    const r = await fetchAPI<EnvelopeResponse<{ draft_id: string; total_toneladas: number; alertas_peligrosos: unknown[] }>>(
      '/agents/rcd/generate-draft',
      { method: 'POST', body: JSON.stringify({ project_id: projectId, ...(opts || {}) }) },
    );
    return r.data;
  },

  approveRCD: async (draftId: string): Promise<{ final_id: string }> => {
    const r = await fetchAPI<EnvelopeResponse<{ final_id: string }>>(
      '/rcd/approve',
      { method: 'POST', body: JSON.stringify({ draft_id: draftId }) },
    );
    return r.data;
  },

  runIEE: async (
    projectId: string,
    opts?: { anio_construccion?: number; numero_plantas?: number; numero_viviendas?: number },
  ): Promise<{ draft_id: string; calificacion_global: string }> => {
    const r = await fetchAPI<EnvelopeResponse<{ draft_id: string; calificacion_global: string }>>(
      '/agents/iee/generate-draft',
      { method: 'POST', body: JSON.stringify({ project_id: projectId, ...(opts || {}) }) },
    );
    return r.data;
  },

  approveIEE: async (draftId: string): Promise<{ final_id: string }> => {
    const r = await fetchAPI<EnvelopeResponse<{ final_id: string }>>(
      '/iee/approve',
      { method: 'POST', body: JSON.stringify({ draft_id: draftId }) },
    );
    return r.data;
  },

  runTelematicFiling: async (
    projectId: string,
    tipoTramite: string,
    municipio?: string,
  ): Promise<unknown> => {
    const r = await fetchAPI<EnvelopeResponse<unknown>>(
      '/agents/telematic-filing/prepare',
      {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, tipo_tramite: tipoTramite, ...(municipio ? { municipio } : {}) }),
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

  // G — Billing (Stripe)
  billing: {
    subscription: async (): Promise<BillingSubscriptionResponse> => {
      const r = await fetchAPI<EnvelopeResponse<BillingSubscriptionResponse>>(
        '/billing/subscription',
        { headers: { 'Cache-Control': 'no-cache' } },
      );
      return r.data;
    },
    checkout: async (tier: BillingTier): Promise<CheckoutSessionResponse> => {
      const r = await fetchAPI<EnvelopeResponse<CheckoutSessionResponse>>(
        '/billing/checkout',
        { method: 'POST', body: JSON.stringify({ tier }) },
      );
      return r.data;
    },
    portal: async (): Promise<PortalSessionResponse> => {
      const r = await fetchAPI<EnvelopeResponse<PortalSessionResponse>>(
        '/billing/portal',
        { method: 'POST', body: JSON.stringify({}) },
      );
      return r.data;
    },
  },

  // ADDENDUM 2 Bloque 7 — Business Intelligence dashboard
  bi: {
    dashboard: async (): Promise<BIDashboardData> => {
      const r = await fetchAPI<EnvelopeResponse<BIDashboardData>>('/bi/dashboard');
      return r.data;
    },
  },

  // PLAN V1.0 ejecucion - 3 agentes (acta_obra, incident_handler, client_update)
  acts: {
    list: async (
      opts?: { status?: 'draft' | 'approved' | 'signed'; projectId?: string; limit?: number },
    ): Promise<SiteVisitActRow[]> => {
      const qs = new URLSearchParams();
      if (opts?.status) qs.set('status', opts.status);
      if (opts?.projectId) qs.set('project_id', opts.projectId);
      if (opts?.limit) qs.set('limit', String(opts.limit));
      const r = await fetchAPI<EnvelopeResponse<SiteVisitActRow[]>>(
        `/site-visit-acts${qs.toString() ? `?${qs.toString()}` : ''}`,
        { headers: { 'Cache-Control': 'no-cache' } },
      );
      return r.data;
    },
    approve: async (
      actId: string,
      action: 'approve' | 'sign',
    ): Promise<{ id: string; status: string; signed_at?: string | null; approved_at?: string | null }> => {
      const r = await fetchAPI<EnvelopeResponse<{ id: string; status: string; signed_at?: string | null; approved_at?: string | null }>>(
        '/site-visit-acts/approve',
        { method: 'POST', body: JSON.stringify({ act_id: actId, action }) },
      );
      return r.data;
    },
  },

  incidents: {
    list: async (
      opts?: {
        status?: 'detected' | 'proposed' | 'communicated' | 'approved' | 'rejected' | 'closed';
        projectId?: string;
        includeClosed?: boolean;
        limit?: number;
      },
    ): Promise<ProjectIncidentRow[]> => {
      const qs = new URLSearchParams();
      if (opts?.status) qs.set('status', opts.status);
      if (opts?.projectId) qs.set('project_id', opts.projectId);
      if (opts?.includeClosed) qs.set('include_closed', 'true');
      if (opts?.limit) qs.set('limit', String(opts.limit));
      const r = await fetchAPI<EnvelopeResponse<ProjectIncidentRow[]>>(
        `/project-incidents${qs.toString() ? `?${qs.toString()}` : ''}`,
        { headers: { 'Cache-Control': 'no-cache' } },
      );
      return r.data;
    },
    selectOption: async (
      incidentId: string,
      selectedOptionIndex: 0 | 1,
      action: 'communicate' | 'reject',
      emailOverride?: string,
    ): Promise<{
      id: string;
      status: string;
      cost_delta_eur: number | null;
      time_delta_days: number | null;
      client_communication_sent_at?: string | null;
    }> => {
      const r = await fetchAPI<EnvelopeResponse<{
        id: string;
        status: string;
        cost_delta_eur: number | null;
        time_delta_days: number | null;
        client_communication_sent_at?: string | null;
      }>>('/incidents/select-option', {
        method: 'POST',
        body: JSON.stringify({
          incident_id: incidentId,
          selected_option_index: selectedOptionIndex,
          action,
          ...(emailOverride ? { email_override: emailOverride } : {}),
        }),
      });
      return r.data;
    },
  },

  clientUpdates: {
    list: async (
      opts?: {
        status?: 'draft' | 'approved' | 'sent' | 'failed';
        projectId?: string;
        limit?: number;
      },
    ): Promise<ClientWeeklyUpdateRow[]> => {
      const qs = new URLSearchParams();
      if (opts?.status) qs.set('status', opts.status);
      if (opts?.projectId) qs.set('project_id', opts.projectId);
      if (opts?.limit) qs.set('limit', String(opts.limit));
      const r = await fetchAPI<EnvelopeResponse<ClientWeeklyUpdateRow[]>>(
        `/client-weekly-updates${qs.toString() ? `?${qs.toString()}` : ''}`,
        { headers: { 'Cache-Control': 'no-cache' } },
      );
      return r.data;
    },
    approve: async (
      updateId: string,
      action: 'approve' | 'reject',
      emailOverride?: string,
    ): Promise<{
      id: string;
      status: string;
      sent_at?: string | null;
      email_message_id?: string | null;
    }> => {
      const r = await fetchAPI<EnvelopeResponse<{
        id: string;
        status: string;
        sent_at?: string | null;
        email_message_id?: string | null;
      }>>('/client-updates/approve', {
        method: 'POST',
        body: JSON.stringify({
          update_id: updateId,
          action,
          ...(emailOverride ? { email_override: emailOverride } : {}),
        }),
      });
      return r.data;
    },
  },
};

// Tipos espejo de las VIEWS / queries (api_*_list.json)
export interface SiteVisitActRow {
  id: string;
  tenant_id: string;
  project_id: string;
  project_name: string | null;
  visit_date: string;
  audio_url: string | null;
  audio_duration_seconds: number | null;
  transcript_raw: string | null;
  transcript_categorized: unknown;
  observations: Array<{ gremio?: string; texto?: string; tipo?: string; fotos_referenciadas?: string[] }> | null;
  photos: Array<{ url: string; caption?: string }> | null;
  acuerdos: string | null;
  proxima_visita_prevista: string | null;
  pdf_url: string | null;
  status: 'draft' | 'approved' | 'signed';
  approved_at: string | null;
  signed_at: string | null;
  created_at: string;
}

export interface IncidentOption {
  descripcion?: string;
  materiales?: string;
  coste_eur?: number;
  dias?: number;
  ventajas?: string[];
  desventajas?: string[];
}

export interface ProjectIncidentRow {
  id: string;
  tenant_id: string;
  project_id: string;
  project_name: string | null;
  detected_at: string;
  description: string;
  location: string | null;
  severity: 'baja' | 'media' | 'alta' | 'critica' | null;
  causa_probable: string | null;
  options: IncidentOption[] | null;
  selected_option_index: number | null;
  cost_delta_eur: number | null;
  time_delta_days: number | null;
  client_communication_draft: string | null;
  client_communication_sent_at: string | null;
  modification_doc_url: string | null;
  status: 'detected' | 'proposed' | 'communicated' | 'approved' | 'rejected' | 'closed';
  photos: Array<{ url: string; caption?: string }> | null;
  created_at: string;
}

export interface ClientWeeklyUpdateRow {
  id: string;
  tenant_id: string;
  project_id: string;
  project_name: string | null;
  week_start: string;
  week_end: string;
  summary_text: string | null;
  photos_referenced: Array<{ url: string; caption?: string }> | null;
  status: 'draft' | 'approved' | 'sent' | 'failed';
  approved_at: string | null;
  sent_at: string | null;
  email_message_id: string | null;
  created_at: string;
}

export const isUsingMock = !HAS_BACKEND;
