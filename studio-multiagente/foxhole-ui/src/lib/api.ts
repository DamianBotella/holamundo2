import type { ProjectSummary, DashboardMetrics, Alert, MyProfile } from './types';
import { mockProfile, mockProjects, mockMetrics, mockAlerts } from './mock-data';

const API_BASE = import.meta.env.VITE_N8N_API_BASE || '';
const FORCE_MOCK = import.meta.env.VITE_FORCE_MOCK === 'true';
const HAS_BACKEND = !FORCE_MOCK && Boolean(API_BASE);

function getToken(): string | null {
  return localStorage.getItem('arquitai_jwt');
}

async function fetchAPI<T>(path: string): Promise<T> {
  if (!HAS_BACKEND) {
    throw new Error('NO_BACKEND');
  }
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Wrapper que usa mock si no hay backend o falla la llamada.
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
    withMockFallback<MyProfile>(() => fetchAPI('/me'), mockProfile),

  projects: () =>
    withMockFallback<ProjectSummary[]>(
      async () => {
        const r = await fetchAPI<{ data: ProjectSummary[] }>('/projects');
        return r.data;
      },
      mockProjects,
    ),

  projectDetail: (id: string) =>
    withMockFallback(
      () => fetchAPI(`/projects/${id}`),
      mockProjects.find((p) => p.id === id) || null,
    ),

  metrics: () =>
    withMockFallback<DashboardMetrics>(() => fetchAPI('/metrics/dashboard'), mockMetrics),

  alerts: () =>
    withMockFallback<Alert[]>(
      async () => {
        const r = await fetchAPI<{ data: Alert[] }>('/alerts/global');
        return r.data;
      },
      mockAlerts,
    ),
};

export const isUsingMock = !HAS_BACKEND;
