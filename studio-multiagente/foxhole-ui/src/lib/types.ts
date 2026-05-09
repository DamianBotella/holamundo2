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

// X7 — Studio canvas
export type AgentState = 'idle' | 'working' | 'waiting_approval' | 'failed';
export type AgentCategory = 'core' | 'auxiliary' | 'util' | 'orchestrator';

export interface StudioRoom {
  room_id: string;
  display_name: string;
  description: string | null;
  bounding_box: { x: number; y: number; w: number; h: number };
  floor_color: string | null;
  background_sprite: string | null;
  display_order: number;
}

export interface StudioAgent {
  agent_name: string;
  display_name: string;
  category: AgentCategory;
  room_id: string;
  default_position: { x: number; y: number };
  sprite_id: string;
  description: string | null;
  display_order: number;
  state: AgentState;
  active_count: number;
  pending_approvals_count: number;
  recent_failures: number;
  last_started_at: string | null;
  active_project_ids: string[];
}

export interface StudioFeedEvent {
  id: string;
  project_id: string | null;
  agent_name: string;
  action: string;
  status: 'success' | 'error' | 'warning' | 'skipped' | string;
  output_summary: string | null;
  timestamp: string;
}

export interface PendingApproval {
  approval_id: string;
  project_id: string;
  project_name: string | null;
  approval_type: string;
  agent_name: string;
  summary: string;
  requested_by: string;
  created_at: string;
  expires_at: string | null;
}

export interface ApprovalDecisionResult {
  approval_id: string;
  project_id: string;
  approval_type: string;
  status: 'approved' | 'rejected';
  decided_at: string;
  decided_by: string;
}

export interface AgentChatResponse {
  agent_name: string;
  display_name: string;
  response: string;
  timestamp: string;
}

// B61 (A.4) — chat persistido en agent_conversations
export interface ConversationMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  agent_name: string;
  project_id: string | null;
  timestamp: string;
}

export interface ConversationHistoryResponse {
  agent_name: string;
  project_id: string | null;
  count: number;
  messages: ConversationMessage[];
}

// B67 — Deliverables de los 4 agentes pre-launch
export interface IEEData {
  iee_id?: string;
  draft_id?: string;
  calificacion_global?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null;
  estado_conservacion?: string | null;
  condiciones_accesibilidad?: string | null;
  eficiencia_energetica?: string | null;
  recomendaciones?: Array<{
    prioridad: string;
    actuacion: string;
    coste_estimado_eur?: number;
    justificacion?: string;
  }>;
  draft_content?: Record<string, unknown>;
  approved_at?: string;
  created_at?: string;
}

export interface RCDData {
  rcd_id?: string;
  draft_id?: string;
  tipo_obra?: string;
  total_toneladas?: number;
  coste_gestion_eur?: number;
  alertas_peligrosos?: Array<{
    tipo: string;
    severidad: string;
    descripcion: string;
  }>;
  draft_content?: Record<string, unknown>;
  approved_at?: string;
  created_at?: string;
}

export interface GrantsLastExec {
  exec_id: string;
  output: {
    recomendaciones?: Array<{
      grant_id: string;
      nombre: string;
      organismo: string;
      ahorro_estimado_eur: number;
      porcentaje_aplicable: number;
      probabilidad_aprobacion: string;
      fecha_limite_solicitud?: string;
    }>;
    ahorro_total_acumulable_eur?: number;
    siguiente_accion_recomendada?: string;
  };
  metadata?: Record<string, unknown>;
  finished_at: string;
}

export interface TelematicLastExec {
  exec_id: string;
  input?: { municipio?: string; tipo_tramite?: string };
  output: {
    estado: 'listo' | 'incompleto';
    docs_validados_count?: number;
    docs_faltantes_count?: number;
    peso_estimado_mb?: number;
  };
  metadata?: Record<string, unknown>;
  finished_at: string;
}

export interface ProjectDeliverables {
  project: { project_id: string; name: string; location_city: string | null } | null;
  iee: { approved: IEEData | null; draft: IEEData | null };
  rcd: { approved: RCDData | null; draft: RCDData | null };
  grants: GrantsLastExec | null;
  telematic: TelematicLastExec | null;
}

// B60 — Wizard Nuevo Proyecto (POST /api/v1/projects/create)
export type ProjectType =
  | 'reforma_integral'
  | 'redistribucion'
  | 'cambio_uso'
  | 'adecuacion'
  | 'apoyo_tecnico'
  | 'otro';

export type PropertyType =
  | 'piso'
  | 'casa'
  | 'local'
  | 'atico'
  | 'bajo'
  | 'duplex'
  | 'otro';

export type Urgency = 'normal' | 'alta' | 'urgente';

export interface CreateProjectPayload {
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  project_name: string;
  project_type: ProjectType;
  location_address: string | null;
  location_city: string | null;
  location_province: string | null;
  property_type: PropertyType | null;
  property_area_m2: number | null;
  budget_target: number | null;
  budget_flexible: boolean;
  urgency: Urgency;
  notes: string | null;
}

export interface CreateProjectResponse {
  project_id: string;
  project_name: string;
  current_phase: ProjectPhase;
  created_at: string;
  briefing_triggered: boolean;
}
