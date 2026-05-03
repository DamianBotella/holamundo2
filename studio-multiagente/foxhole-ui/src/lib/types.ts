// Tipos espejo de las VIEWS SQL en migration 052_api_views.sql.
// Cuando cambian las views, actualizar aqui.

export type ProjectPhase =
  | 'intake'
  | 'briefing_done'
  | 'design_done'
  | 'analysis_done'
  | 'costs_done'
  | 'trades_done'
  | 'proposal_done'
  | 'approved'
  | 'planning_done'
  | 'completed'
  | 'archived';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType =
  | 'consultation'
  | 'approval_pending'
  | 'regulatory_warning'
  | 'agent_failure';

// v_project_summary
export interface ProjectSummary {
  id: string;
  name: string;
  client_name: string;
  current_phase: ProjectPhase;
  status: 'active' | 'paused' | 'blocked' | 'completed';
  budget_target: number | null;
  location_city: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  alerts_count: number;
  pending_approvals_count: number;
}

// v_dashboard_metrics
export interface DashboardMetrics {
  active_projects: number;
  projects_by_phase: Record<string, number>;
  critical_alerts: number;
  pending_approvals: number;
  revenue_pipeline_eur: number;
  llm_cost_mtd_usd: number;
}

// v_alerts
export interface Alert {
  id: string;
  project_id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  created_at: string;
  resolved_at: string | null;
}

// v_my_profile (post-X4)
export interface MyProfile {
  user_id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'architect' | 'collaborator' | 'client';
  tenant_id: string;
  tenant_name: string;
}
