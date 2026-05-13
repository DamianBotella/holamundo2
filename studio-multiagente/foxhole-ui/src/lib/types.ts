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
  // B70 (X7 Oficina Viva): texto de la ultima accion del agente desde activity_log
  // (migracion 073). Sirve para la burbuja contextual sobre el sprite.
  last_action_text?: string | null;
  last_action_at?: string | null;
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

// G — Billing (Stripe)
export type BillingTier = 'starter' | 'pro' | 'equipo' | 'founder';
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | 'unpaid'
  | 'no_subscription';

export interface PlanLimits {
  max_projects: number;
  max_users: number;
  max_ai_tokens: number;
  max_agents: number;
  max_agent_executions: number;
  render_mnml_per_month?: number;
  support?: string;
}

export interface BillingUsage {
  projects_active: number;
  projects_created_this_month: number;
  ai_tokens_used_this_month: number;
  agent_executions_this_month: number;
}

export interface BillingSubscription {
  has_subscription: boolean;
  tier: BillingTier | null;
  plan_name?: string | null;
  price_eur_monthly?: number | null;
  status: SubscriptionStatus;
  is_trialing?: boolean;
  trial_ends_at?: string | null;
  trial_days_left?: number | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  limits: PlanLimits;
  usage?: BillingUsage;
  features?: string[];
}

export interface AvailablePlan {
  tier: BillingTier;
  name: string;
  price_eur_monthly: number;
  features: string[];
  limits: PlanLimits;
  trial_days: number;
  is_current: boolean;
}

export interface BillingSubscriptionResponse {
  subscription: BillingSubscription;
  available_plans: AvailablePlan[];
}

export interface CheckoutSessionResponse {
  checkout_url: string;
  session_id: string;
  tier: BillingTier;
  plan_name: string;
  status: string;
  expires_at: number;
}

export interface PortalSessionResponse {
  portal_url: string;
  return_url: string;
}

// ADDENDUM 2 Bloque 7 — Business Intelligence Dashboard
export interface BIRentabilidadRow {
  project_id: string;
  project_name: string;
  status: string | null;
  margen_eur: number | null;
  margen_pct: number | null;
}
export interface BIFaseRow {
  phase: string;
  n_proyectos: number;
  dias_medios: number;
}
export interface BIConversionRow {
  mes: string;
  enviadas: number;
  aceptadas: number;
  tasa_pct: number;
}
export interface BIAgentActivityRow {
  agent_name: string;
  ejecuciones: number;
}
export interface BIBudgetAlertRow {
  project_id: string;
  name: string;
  desviacion_pct: number;
}
export interface BICargaRow {
  semana_iso: string;
  proyectos_activos: number;
}
export interface BIDashboardData {
  rentabilidad: BIRentabilidadRow[];
  fases: BIFaseRow[];
  conversion: BIConversionRow[];
  agentes_activos_mes: BIAgentActivityRow[];
  alertas_presupuesto: BIBudgetAlertRow[];
  prediccion_carga: BICargaRow[];
}
