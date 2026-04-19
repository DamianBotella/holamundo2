-- ============================================================
-- SISTEMA MULTIAGENTE - ESTUDIO DE ARQUITECTURA TÉCNICA
-- Script de creación de tablas MVP
-- BD: Supabase (PostgreSQL 15+)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- pgvector se activará en V2 cuando se implementen embeddings:
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- FUNCIÓN AUXILIAR: auto-update de updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. CLIENTS
-- Registro mínimo del cliente ya captado.
-- ============================================================
CREATE TABLE clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text,
  phone         text,
  preferred_contact text CHECK (preferred_contact IN ('email', 'whatsapp', 'phone', 'presencial')),
  address       text,
  city          text,
  province      text,
  postal_code   text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_clients_updated
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. PROJECTS
-- Tabla central. El campo current_phase gobierna el orquestador.
-- ============================================================
CREATE TABLE projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  current_phase   text NOT NULL DEFAULT 'intake'
    CHECK (current_phase IN (
      'intake', 'briefing_done', 'design_done', 'analysis_done',
      'costs_done', 'trades_done', 'proposal_done', 'approved',
      'planning_done', 'completed', 'archived'
    )),
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'blocked', 'completed')),
  project_type    text NOT NULL
    CHECK (project_type IN (
      'reforma_integral', 'redistribucion', 'cambio_uso',
      'adecuacion', 'apoyo_tecnico', 'otro'
    )),
  budget_target       numeric(12,2),
  budget_flexible     boolean DEFAULT false,
  location_address    text,
  location_city       text,
  location_province   text,
  property_type       text CHECK (property_type IN (
    'piso', 'casa', 'local', 'atico', 'bajo', 'duplex', 'otro'
  )),
  property_area_m2    numeric(8,2),
  urgency             text DEFAULT 'normal'
    CHECK (urgency IN ('normal', 'alta', 'urgente')),
  started_at          timestamptz,
  target_completion   date,
  completed_at        timestamptz,
  metadata            jsonb DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_projects_updated
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_projects_phase ON projects (current_phase) WHERE status = 'active';
CREATE INDEX idx_projects_status ON projects (status);
CREATE INDEX idx_projects_client ON projects (client_id);

-- ============================================================
-- 3. BRIEFINGS
-- Output del Agente de Briefing. Ficha estructurada del proyecto.
-- ============================================================
CREATE TABLE briefings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  version           int NOT NULL DEFAULT 1,
  summary           text NOT NULL,
  client_needs      jsonb NOT NULL DEFAULT '[]',
  objectives        jsonb DEFAULT '[]',
  constraints       jsonb DEFAULT '[]',
  style_preferences jsonb DEFAULT '{}',
  rooms_affected    jsonb DEFAULT '[]',
  missing_info      jsonb DEFAULT '[]',
  open_questions    jsonb DEFAULT '[]',
  raw_inputs_summary text,
  status            text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'revision_requested')),
  approved_at       timestamptz,
  approved_by       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_briefings_updated
  BEFORE UPDATE ON briefings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_briefings_project ON briefings (project_id, version DESC);

-- ============================================================
-- 4. DESIGN_OPTIONS
-- Output del Agente de Distribución. Opciones de redistribución.
-- ============================================================
CREATE TABLE design_options (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  option_number         int NOT NULL,
  title                 text NOT NULL,
  description           text NOT NULL,
  intervention_logic    text,
  rooms_layout          jsonb DEFAULT '[]',
  technical_notes       jsonb DEFAULT '[]',
  conflict_points       jsonb DEFAULT '[]',
  pros                  jsonb DEFAULT '[]',
  cons                  jsonb DEFAULT '[]',
  estimated_complexity  text CHECK (estimated_complexity IN ('baja', 'media', 'alta')),
  is_selected           boolean DEFAULT false,
  selected_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_design_options_updated
  BEFORE UPDATE ON design_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Solo una opción seleccionada por proyecto
CREATE UNIQUE INDEX idx_one_selected_option
  ON design_options (project_id) WHERE is_selected = true;

-- ============================================================
-- 5. REGULATORY_TASKS
-- Output del Agente de Normativa. Trámites detectados.
-- ============================================================
CREATE TABLE regulatory_tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  task_type         text NOT NULL
    CHECK (task_type IN (
      'licencia_obra', 'comunicacion_previa', 'permiso_comunidad',
      'certificado_habitabilidad', 'cedula_urbanistica',
      'informe_tecnico', 'otro'
    )),
  title             text NOT NULL,
  description       text,
  entity            text,
  required_docs     jsonb DEFAULT '[]',
  estimated_timeline text,
  estimated_cost    numeric(10,2),
  priority          text CHECK (priority IN ('critico', 'importante', 'recomendable', 'informativo')),
  status            text NOT NULL DEFAULT 'detected'
    CHECK (status IN ('detected', 'confirmed', 'in_progress', 'completed', 'not_required')),
  contact_info      jsonb DEFAULT '{}',
  draft_message     text,
  notes             text,
  confirmed_by      text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_regulatory_updated
  BEFORE UPDATE ON regulatory_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_regulatory_project ON regulatory_tasks (project_id);

-- ============================================================
-- 6. DOCUMENTS
-- Índice documental del proyecto. Archivos en Google Drive.
-- ============================================================
CREATE TABLE documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  doc_type        text NOT NULL
    CHECK (doc_type IN (
      'plano', 'foto', 'presupuesto', 'contrato', 'informe',
      'nota', 'acta', 'certificado', 'factura', 'otro'
    )),
  title           text NOT NULL,
  file_name       text,
  drive_path      text,
  drive_file_id   text,
  version         int DEFAULT 1,
  source          text CHECK (source IN (
    'cliente', 'arquitecto', 'agente', 'oficio', 'ayuntamiento', 'otro'
  )),
  related_agent   text,
  tags            text[] DEFAULT '{}',
  status          text DEFAULT 'active'
    CHECK (status IN ('active', 'superseded', 'archived')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_documents_updated
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_documents_project ON documents (project_id);
CREATE INDEX idx_documents_tags ON documents USING GIN (tags);

-- ============================================================
-- 7. MATERIAL_ITEMS
-- Output del Agente de Materiales. Materiales y precios.
-- ============================================================
CREATE TABLE material_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  category            text NOT NULL
    CHECK (category IN (
      'pavimento', 'revestimiento', 'sanitarios', 'griferia',
      'iluminacion', 'carpinteria', 'pintura', 'cocina',
      'electrodomestico', 'otro'
    )),
  name                text NOT NULL,
  brand               text,
  model_ref           text,
  supplier            text,
  unit_price          numeric(10,2),
  unit                text CHECK (unit IN ('m2', 'ml', 'ud', 'm3', 'kg', 'l')),
  quantity_estimated  numeric(10,2),
  total_estimated     numeric(12,2),
  quality_tier        text CHECK (quality_tier IN ('economica', 'media', 'alta', 'premium')),
  is_alternative      boolean DEFAULT false,
  alternative_to      uuid REFERENCES material_items(id) ON DELETE SET NULL,
  room_area           text,
  availability_notes  text,
  source_url          text,
  status              text DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'approved', 'rejected', 'ordered')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_materials_updated
  BEFORE UPDATE ON material_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_materials_project ON material_items (project_id, category);

-- ============================================================
-- 8. COST_ESTIMATES
-- Output del Agente de Costes. Estimación económica.
-- ============================================================
CREATE TABLE cost_estimates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  version               int NOT NULL DEFAULT 1,
  total_estimated       numeric(12,2) NOT NULL,
  budget_target         numeric(12,2),
  deviation_pct         numeric(5,2),
  deviation_status      text CHECK (deviation_status IN (
    'within_budget', 'slight_over', 'over_budget', 'critical_over'
  )),
  breakdown             jsonb NOT NULL DEFAULT '[]',
  adjustments_suggested jsonb DEFAULT '[]',
  scenarios             jsonb DEFAULT '{}',
  assumptions           jsonb DEFAULT '[]',
  risk_notes            text,
  status                text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'reviewed', 'approved')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_costs_updated
  BEFORE UPDATE ON cost_estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_costs_project ON cost_estimates (project_id, version DESC);

-- ============================================================
-- 9. TRADE_REQUESTS
-- Output del Agente de Oficios. Solicitudes de presupuesto.
-- ============================================================
CREATE TABLE trade_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  trade_type        text NOT NULL
    CHECK (trade_type IN (
      'albanileria', 'fontaneria', 'electricidad', 'carpinteria',
      'carpinteria_metalica', 'cocina', 'armarios', 'ventanas',
      'pintura', 'climatizacion', 'otro'
    )),
  scope_description text NOT NULL,
  scope_details     jsonb DEFAULT '[]',
  required_info     jsonb DEFAULT '[]',
  contact_name      text,
  contact_phone     text,
  contact_email     text,
  draft_message     text,
  message_channel   text CHECK (message_channel IN ('email', 'whatsapp', 'phone')),
  status            text NOT NULL DEFAULT 'prepared'
    CHECK (status IN (
      'prepared', 'approved_to_send', 'sent', 'response_received',
      'compared', 'selected', 'rejected'
    )),
  sent_at           timestamptz,
  response_deadline date,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_trades_updated
  BEFORE UPDATE ON trade_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_trades_project ON trade_requests (project_id, status);

-- ============================================================
-- 10. EXTERNAL_QUOTES
-- Presupuestos recibidos de oficios/proveedores.
-- ============================================================
CREATE TABLE external_quotes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_request_id    uuid NOT NULL REFERENCES trade_requests(id) ON DELETE RESTRICT,
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  provider_name       text NOT NULL,
  total_amount        numeric(12,2),
  breakdown           jsonb DEFAULT '[]',
  includes            text,
  excludes            text,
  validity_days       int,
  estimated_duration  text,
  payment_terms       text,
  received_at         timestamptz,
  source_document_id  uuid REFERENCES documents(id) ON DELETE SET NULL,
  comparison_notes    text,
  status              text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'reviewed', 'selected', 'rejected')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_quotes_updated
  BEFORE UPDATE ON external_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_quotes_trade ON external_quotes (trade_request_id);
CREATE INDEX idx_quotes_project ON external_quotes (project_id);

-- ============================================================
-- 11. PROPOSALS
-- Output del Agente de Propuesta. Propuesta comercial al cliente.
-- ============================================================
CREATE TABLE proposals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  version             int NOT NULL DEFAULT 1,
  title               text NOT NULL,
  executive_summary   text,
  scope_description   text NOT NULL,
  phases              jsonb DEFAULT '[]',
  total_price         numeric(12,2) NOT NULL,
  price_breakdown     jsonb DEFAULT '[]',
  exclusions          jsonb DEFAULT '[]',
  inclusions          jsonb DEFAULT '[]',
  payment_conditions  text,
  validity_days       int,
  estimated_duration  text,
  warnings            jsonb DEFAULT '[]',
  optional_items      jsonb DEFAULT '[]',
  document_id         uuid REFERENCES documents(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'pending_review', 'approved_internal',
      'sent_to_client', 'accepted', 'rejected', 'revision_requested'
    )),
  sent_at             timestamptz,
  client_response_at  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_proposals_updated
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_proposals_project ON proposals (project_id, version DESC);

-- ============================================================
-- 12. PROJECT_PLANS
-- Output del Agente Planificador. Plan operativo.
-- ============================================================
CREATE TABLE project_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  version             int NOT NULL DEFAULT 1,
  total_duration_days int,
  start_date          date,
  end_date            date,
  phases              jsonb NOT NULL DEFAULT '[]',
  milestones          jsonb DEFAULT '[]',
  dependencies        jsonb DEFAULT '[]',
  blockers            jsonb DEFAULT '[]',
  critical_path       jsonb DEFAULT '[]',
  status              text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'in_progress', 'completed')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_plans_updated
  BEFORE UPDATE ON project_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_plans_project ON project_plans (project_id);

-- ============================================================
-- 13. APPROVALS
-- Solicitudes de aprobación humana.
-- ============================================================
CREATE TABLE approvals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  approval_type     text NOT NULL
    CHECK (approval_type IN (
      'briefing_review', 'design_review', 'external_contact',
      'trade_request_send', 'proposal_review', 'proposal_send',
      'project_close'
    )),
  requested_by      text NOT NULL,
  summary           text NOT NULL,
  details           jsonb DEFAULT '{}',
  related_entity    text,
  related_entity_id uuid,
  status            text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  decided_by        text,
  decided_at        timestamptz,
  decision_notes    text,
  webhook_token     uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_approval_token ON approvals (webhook_token);
CREATE INDEX idx_approvals_pending ON approvals (project_id, status) WHERE status = 'pending';

-- ============================================================
-- 14. ACTIVITY_LOG
-- Trazabilidad y auditoría del sistema.
-- ============================================================
CREATE TABLE activity_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid REFERENCES projects(id) ON DELETE SET NULL,
  agent_name        text NOT NULL,
  action            text NOT NULL,
  phase_at_time     text,
  input_summary     text,
  output_summary    text,
  llm_model         text,
  llm_tokens_in     int,
  llm_tokens_out    int,
  llm_cost_estimated numeric(8,4),
  duration_ms       int,
  status            text NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'error', 'warning', 'skipped')),
  error_message     text,
  execution_id      text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_project ON activity_log (project_id, created_at DESC);
CREATE INDEX idx_activity_agent ON activity_log (agent_name, created_at DESC);

-- ============================================================
-- 15. MEMORY_CASES
-- Base de conocimiento acumulada del estudio.
-- ============================================================
CREATE TABLE memory_cases (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  project_type            text NOT NULL,
  location_zone           text,
  property_type           text,
  area_m2                 numeric(8,2),
  summary                 text NOT NULL,
  scope_summary           text,
  decisions_made          jsonb DEFAULT '[]',
  cost_estimated          numeric(12,2),
  cost_final              numeric(12,2),
  cost_deviation_pct      numeric(5,2),
  duration_estimated_days int,
  duration_actual_days    int,
  trades_used             jsonb DEFAULT '[]',
  materials_notable       jsonb DEFAULT '[]',
  lessons_learned         jsonb DEFAULT '[]',
  problems_encountered    jsonb DEFAULT '[]',
  patterns                jsonb DEFAULT '[]',
  client_satisfaction     text CHECK (client_satisfaction IN (
    'muy_satisfecho', 'satisfecho', 'neutral', 'insatisfecho'
  )),
  tags                    text[] NOT NULL DEFAULT '{}',
  -- V2: embedding vector(1536),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_type_zone ON memory_cases (project_type, location_zone);
CREATE INDEX idx_memory_tags ON memory_cases USING GIN (tags);

-- ============================================================
-- 16. AGENT_PROMPTS
-- Prompts versionados de cada agente.
-- ============================================================
CREATE TABLE agent_prompts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name        text NOT NULL,
  prompt_type       text NOT NULL
    CHECK (prompt_type IN ('system', 'user_template', 'output_format')),
  version           int NOT NULL DEFAULT 1,
  is_active         boolean NOT NULL DEFAULT false,
  content           text NOT NULL,
  model_recommended text,
  temperature       numeric(3,2),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Solo un prompt activo por agente y tipo
CREATE UNIQUE INDEX idx_active_prompt
  ON agent_prompts (agent_name, prompt_type) WHERE is_active = true;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- Ejecutar después de crear todo para verificar:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' ORDER BY table_name;
--
-- Resultado esperado: 16 tablas
-- activity_log, agent_prompts, approvals, briefings, clients,
-- cost_estimates, design_options, documents, external_quotes,
-- material_items, memory_cases, project_plans, projects,
-- proposals, regulatory_tasks, trade_requests
