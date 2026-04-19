# BLOQUE 2 — Modelo de Datos Mínimo del MVP

## Sistema Multiagente para Estudio de Arquitectura Técnica y Reformas

**BD objetivo: Supabase (PostgreSQL 15+ con pgvector)**
**Versión: MVP**

---

## 0. SUPUESTOS Y DECISIONES PREVIAS

**Convenciones:**
- Todos los `id` son `UUID` generados con `gen_random_uuid()` (nativo en PostgreSQL 13+).
- Timestamps con zona horaria (`timestamptz`), por defecto `now()`.
- Campos flexibles como `jsonb` cuando la estructura puede variar entre proyectos (por ejemplo, metadata de un briefing vs. otro).
- Enums implementados como `text` con CHECK constraints (no como tipos ENUM de PostgreSQL). Razón: en Supabase es más fácil alterar un CHECK que migrar un ENUM.
- Todas las tablas tienen `created_at` y `updated_at`.
- Borrado lógico donde aplique (campo `archived_at` en vez de DELETE).
- Las relaciones son FK estándar con ON DELETE RESTRICT (nunca cascada en datos de negocio).

**Sobre el tamaño:**
- Con 500MB del tier gratuito de Supabase, caben cómodamente entre 50 y 100 proyectos completos con todos sus datos asociados. Suficiente para el primer año de MVP.
- pgvector está disponible sin coste adicional en todos los tiers de Supabase, pero en el MVP no usamos embeddings. La columna `embedding` en `memory_cases` se añade en V2.

**Diagrama de relaciones (simplificado):**

```
clients ─────1:N────── projects
                          │
                          ├──1:1── briefings
                          ├──1:N── design_options
                          ├──1:N── regulatory_tasks
                          ├──1:N── documents
                          ├──1:N── material_items
                          ├──1:N── cost_estimates
                          ├──1:N── trade_requests ──1:N── external_quotes
                          ├──1:1── proposals
                          ├──1:1── project_plans
                          ├──1:N── approvals
                          ├──1:N── activity_log
                          └──1:1── memory_cases
                          
agent_prompts (independiente, referenciada por nombre de agente)
```

---

## 1. ENTIDAD: `clients`

### Propósito
Registro mínimo del cliente ya captado. No es un CRM: solo almacena los datos necesarios para que los agentes trabajen (nombre de contacto, dirección de la vivienda, forma de comunicación preferida).

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `name` | text | Sí | Nombre completo del cliente o referencia |
| `email` | text | No | Email de contacto principal |
| `phone` | text | No | Teléfono de contacto |
| `preferred_contact` | text | No | Canal preferido: email, whatsapp, phone, presencial |
| `address` | text | No | Dirección de la vivienda objeto del proyecto |
| `city` | text | No | Ciudad/municipio (relevante para normativa) |
| `province` | text | No | Provincia |
| `postal_code` | text | No | Código postal |
| `notes` | text | No | Observaciones generales sobre el cliente |
| `created_at` | timestamptz | Sí | Fecha de creación |
| `updated_at` | timestamptz | Sí | Última modificación |

### Relaciones
- `clients` → `projects` (1:N). Un cliente puede tener varios proyectos.

### Notas
- No almacenamos datos financieros, fiscales ni documentos de identidad del cliente en el MVP. Si se necesita facturación, va en un sistema externo.
- El campo `city` y `province` son importantes porque el agente de normativa los usa para determinar qué ayuntamiento y qué regulaciones aplican.

---

## 2. ENTIDAD: `projects`

### Propósito
Tabla central del sistema. Cada proyecto es una intervención sobre una vivienda. El campo `current_phase` es el que el orquestador lee para decidir qué agente ejecutar. Es la fuente de verdad del estado del proyecto.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único del proyecto |
| `client_id` | uuid FK → clients | Sí | Cliente asociado |
| `name` | text | Sí | Nombre descriptivo del proyecto (ej: "Reforma integral Calle Mayor 12") |
| `current_phase` | text | Sí | Fase actual. Valores posibles: `intake`, `briefing_done`, `design_done`, `analysis_done`, `costs_done`, `trades_done`, `proposal_done`, `approved`, `planning_done`, `completed`, `archived` |
| `status` | text | Sí | Estado operativo: `active`, `paused`, `blocked`, `completed` |
| `project_type` | text | Sí | Tipo: `reforma_integral`, `redistribucion`, `cambio_uso`, `adecuacion`, `apoyo_tecnico`, `otro` |
| `budget_target` | numeric(12,2) | No | Presupuesto objetivo del cliente (€) |
| `budget_flexible` | boolean | No | ¿El cliente acepta ajustes de presupuesto? Default: false |
| `location_address` | text | No | Dirección completa de la intervención (puede diferir de la del cliente) |
| `location_city` | text | No | Ciudad de la intervención |
| `location_province` | text | No | Provincia de la intervención |
| `property_type` | text | No | Tipo de inmueble: `piso`, `casa`, `local`, `atico`, `bajo`, `duplex`, `otro` |
| `property_area_m2` | numeric(8,2) | No | Superficie aproximada en m² |
| `urgency` | text | No | Urgencia: `normal`, `alta`, `urgente` |
| `started_at` | timestamptz | No | Fecha de inicio real del proyecto |
| `target_completion` | date | No | Fecha objetivo de finalización |
| `completed_at` | timestamptz | No | Fecha de cierre real |
| `metadata` | jsonb | No | Datos flexibles sin estructura fija |
| `created_at` | timestamptz | Sí | Fecha de creación |
| `updated_at` | timestamptz | Sí | Última modificación |

### Constraint de fases válidas

```sql
ALTER TABLE projects ADD CONSTRAINT chk_phase 
CHECK (current_phase IN (
  'intake', 'briefing_done', 'design_done', 'analysis_done',
  'costs_done', 'trades_done', 'proposal_done', 'approved',
  'planning_done', 'completed', 'archived'
));
```

### Relaciones
- `projects.client_id` → `clients.id` (N:1)
- `projects` → todas las demás tablas (1:N o 1:1 según la entidad)

### Notas
- `current_phase` y `status` son independientes. Un proyecto puede estar en `status = paused` en cualquier fase.
- `location_*` puede diferir de la dirección del cliente (el cliente puede vivir en otro sitio).
- `metadata` es un escape valve para datos que no justifican columna propia en el MVP (por ejemplo, "el vecino tiene llave", "hay mascotas", "horario de acceso").

---

## 3. ENTIDAD: `briefings`

### Propósito
Output del Agente de Briefing. Ficha estructurada del proyecto generada a partir de las notas, audios, fotos y mensajes iniciales. Es el input principal de los agentes posteriores.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `project_id` | uuid FK → projects | Sí | Proyecto asociado (relación 1:1 en MVP) |
| `version` | int | Sí | Versión del briefing (1, 2, 3...) para iteraciones |
| `summary` | text | Sí | Resumen ejecutivo del encargo en 3-5 líneas |
| `client_needs` | jsonb | Sí | Necesidades del cliente como array estructurado |
| `objectives` | jsonb | No | Objetivos principales del proyecto |
| `constraints` | jsonb | No | Restricciones detectadas (estructurales, normativas, temporales, económicas) |
| `style_preferences` | jsonb | No | Preferencias estéticas, materiales, referencias |
| `rooms_affected` | jsonb | No | Estancias afectadas con descripción de intervención |
| `missing_info` | jsonb | No | Información que falta y que se necesita para avanzar |
| `open_questions` | jsonb | No | Dudas abiertas que requieren confirmación del cliente |
| `raw_inputs_summary` | text | No | Resumen de las fuentes de información procesadas |
| `status` | text | Sí | `draft`, `pending_review`, `approved`, `revision_requested` |
| `approved_at` | timestamptz | No | Cuándo fue aprobado por el arquitecto |
| `approved_by` | text | No | Quién aprobó |
| `created_at` | timestamptz | Sí | Fecha de creación |
| `updated_at` | timestamptz | Sí | Última modificación |

### Ejemplo de `client_needs` (jsonb)

```json
[
  {"need": "Abrir cocina al salón", "priority": "alta", "notes": "Quiere barra americana"},
  {"need": "Crear segundo baño", "priority": "alta", "notes": "En la zona del pasillo"},
  {"need": "Más almacenaje en dormitorio principal", "priority": "media", "notes": ""}
]
```

### Relaciones
- `briefings.project_id` → `projects.id` (N:1, pero en la práctica 1:1 con versionado)
- Leído por: `agent_design`, `agent_regulatory`, `agent_costs`, `agent_proposal`

---

## 4. ENTIDAD: `design_options`

### Propósito
Output del Agente de Distribución / Anteproyecto. Cada registro es una opción de redistribución propuesta para el proyecto. Puede haber 1-3 opciones. El arquitecto selecciona una.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `project_id` | uuid FK → projects | Sí | Proyecto asociado |
| `option_number` | int | Sí | Número de opción (1, 2, 3) |
| `title` | text | Sí | Título descriptivo (ej: "Opción A: Cocina abierta con isla") |
| `description` | text | Sí | Descripción de la propuesta de distribución |
| `intervention_logic` | text | No | Lógica de intervención: qué se toca, por qué, en qué orden |
| `rooms_layout` | jsonb | No | Distribución de estancias propuesta |
| `technical_notes` | jsonb | No | Observaciones técnicas preliminares |
| `conflict_points` | jsonb | No | Puntos de conflicto detectados (estructurales, normativos, funcionales) |
| `pros` | jsonb | No | Ventajas de esta opción |
| `cons` | jsonb | No | Desventajas de esta opción |
| `estimated_complexity` | text | No | `baja`, `media`, `alta` |
| `is_selected` | boolean | No | ¿Es la opción seleccionada por el arquitecto? Default: false |
| `selected_at` | timestamptz | No | Cuándo fue seleccionada |
| `created_at` | timestamptz | Sí | Fecha de creación |
| `updated_at` | timestamptz | Sí | Última modificación |

### Relaciones
- `design_options.project_id` → `projects.id` (N:1)
- Leído por: `agent_regulatory`, `agent_materials`, `agent_costs`, `agent_trades`, `agent_proposal`

### Notas
- Solo una opción puede tener `is_selected = true` por proyecto. Constraint parcial:

```sql
CREATE UNIQUE INDEX idx_one_selected_option 
ON design_options (project_id) WHERE is_selected = true;
```

---

## 5. ENTIDAD: `regulatory_tasks`

### Propósito
Output del Agente de Normativa / Tramitación. Cada registro es un trámite, permiso o gestión administrativa detectada como potencialmente necesaria para el proyecto.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `project_id` | uuid FK → projects | Sí | Proyecto asociado |
| `task_type` | text | Sí | Tipo: `licencia_obra`, `comunicacion_previa`, `permiso_comunidad`, `certificado_habitabilidad`, `cedula_urbanistica`, `informe_tecnico`, `otro` |
| `title` | text | Sí | Título descriptivo del trámite |
| `description` | text | No | Descripción detallada |
| `entity` | text | No | Entidad responsable (ayuntamiento, comunidad de propietarios, etc.) |
| `required_docs` | jsonb | No | Documentos necesarios para este trámite |
| `estimated_timeline` | text | No | Plazo estimado (ej: "2-4 semanas") |
| `estimated_cost` | numeric(10,2) | No | Coste estimado de la tasa o trámite |
| `priority` | text | No | `critico` (bloquea obra), `importante`, `recomendable`, `informativo` |
| `status` | text | Sí | `detected`, `confirmed`, `in_progress`, `completed`, `not_required` |
| `contact_info` | jsonb | No | Datos de contacto encontrados (teléfono, web, email) |
| `draft_message` | text | No | Borrador de email/WhatsApp/guion de llamada preparado por el agente |
| `notes` | text | No | Notas adicionales |
| `confirmed_by` | text | No | Quién confirmó si este trámite aplica realmente |
| `created_at` | timestamptz | Sí | Fecha de creación |
| `updated_at` | timestamptz | Sí | Última modificación |

### Relaciones
- `regulatory_tasks.project_id` → `projects.id` (N:1)
- Leído por: `agent_costs`, `agent_proposal`, `agent_planner`

### Notas
- El agente DETECTA trámites. No los confirma. El campo `status = detected` indica que es una sugerencia del agente. Solo pasa a `confirmed` tras revisión humana.
- `draft_message` es un borrador preparado para que el humano lo envíe (o no). El agente NO envía nada.

---

## 6. ENTIDAD: `documents`

### Propósito
Registro de todos los documentos del proyecto. Es el catálogo documental mantenido por el Agente Documental. No almacena el archivo en sí (eso va en Google Drive), sino la referencia, clasificación y estado.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `project_id` | uuid FK → projects | Sí | Proyecto asociado |
| `doc_type` | text | Sí | Tipo: `plano`, `foto`, `presupuesto`, `contrato`, `informe`, `nota`, `acta`, `certificado`, `factura`, `otro` |
| `title` | text | Sí | Nombre descriptivo del documento |
| `file_name` | text | No | Nombre del archivo original |
| `drive_path` | text | No | Ruta o URL en Google Drive |
| `drive_file_id` | text | No | ID del archivo en Google Drive (para operaciones API) |
| `version` | int | No | Versión del documento (1, 2, 3...) |
| `source` | text | No | Origen: `cliente`, `arquitecto`, `agente`, `oficio`, `ayuntamiento`, `otro` |
| `related_agent` | text | No | Qué agente generó o procesó este documento |
| `tags` | text[] | No | Etiquetas para búsqueda (ej: ['cocina', 'planta', 'demolicion']) |
| `status` | text | No | `active`, `superseded`, `archived` |
| `notes` | text | No | Observaciones |
| `created_at` | timestamptz | Sí | Fecha de creación |
| `updated_at` | timestamptz | Sí | Última modificación |

### Relaciones
- `documents.project_id` → `projects.id` (N:1)
- Transversal: potencialmente referenciado por cualquier otro agente.

### Notas
- El archivo físico vive en Google Drive. Esta tabla es solo el índice.
- `drive_path` sigue la estructura estándar: `/proyectos/{project_name}/planos/`, `/proyectos/{project_name}/fotos/`, etc.
- El agente documental detecta documentos faltantes comparando lo que hay con lo que debería haber según el tipo de proyecto.

---

## 7. ENTIDAD: `material_items`

### Propósito
Output del Agente de Materiales / Proveedores. Cada registro es un material, acabado o producto sugerido para el proyecto, con precios y alternativas.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `project_id` | uuid FK → projects | Sí | Proyecto asociado |
| `category` | text | Sí | Categoría: `pavimento`, `revestimiento`, `sanitarios`, `griferia`, `iluminacion`, `carpinteria`, `pintura`, `cocina`, `electrodomestico`, `otro` |
| `name` | text | Sí | Nombre del material o producto |
| `brand` | text | No | Marca |
| `model_ref` | text | No | Modelo o referencia del fabricante |
| `supplier` | text | No | Proveedor sugerido |
| `unit_price` | numeric(10,2) | No | Precio unitario estimado (€) |
| `unit` | text | No | Unidad de medida: `m2`, `ml`, `ud`, `m3`, `kg`, `l` |
| `quantity_estimated` | numeric(10,2) | No | Cantidad estimada necesaria |
| `total_estimated` | numeric(12,2) | No | Coste total estimado (unit_price × quantity) |
| `quality_tier` | text | No | Gama: `economica`, `media`, `alta`, `premium` |
| `is_alternative` | boolean | No | ¿Es una alternativa a otro material? Default: false |
| `alternative_to` | uuid FK → material_items | No | Si es alternativa, a qué material sustituye |
| `room_area` | text | No | Estancia donde aplica (ej: "baño principal", "cocina") |
| `availability_notes` | text | No | Notas de disponibilidad o plazos |
| `source_url` | text | No | URL de referencia o catálogo |
| `status` | text | No | `suggested`, `approved`, `rejected`, `ordered` |
| `notes` | text | No | Observaciones |
| `created_at` | timestamptz | Sí | Fecha de creación |
| `updated_at` | timestamptz | Sí | Última modificación |

### Relaciones
- `material_items.project_id` → `projects.id` (N:1)
- `material_items.alternative_to` → `material_items.id` (auto-referencia N:1)
- Leído por: `agent_costs`, `agent_trades`, `agent_proposal`

---

## 8. ENTIDAD: `cost_estimates`

### Propósito
Output del Agente de Costes. Estimación económica del proyecto. Puede tener múltiples versiones (iteraciones por ajustes). Incluye desglose por partidas y comparación contra presupuesto objetivo.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `project_id` | uuid FK → projects | Sí | Proyecto asociado |
| `version` | int | Sí | Versión de la estimación (1, 2, 3...) |
| `total_estimated` | numeric(12,2) | Sí | Coste total estimado (€) |
| `budget_target` | numeric(12,2) | No | Presupuesto objetivo (copiado de projects para referencia) |
| `deviation_pct` | numeric(5,2) | No | Desviación porcentual respecto al objetivo |
| `deviation_status` | text | No | `within_budget`, `slight_over` (<15%), `over_budget` (>15%), `critical_over` (>30%) |
| `breakdown` | jsonb | Sí | Desglose por partidas |
| `adjustments_suggested` | jsonb | No | Sugerencias de ajuste para encajar en presupuesto |
| `scenarios` | jsonb | No | Escenarios alternativos (económico, estándar, premium) |
| `assumptions` | jsonb | No | Supuestos usados para la estimación |
| `risk_notes` | text | No | Riesgos económicos detectados |
| `status` | text | Sí | `draft`, `reviewed`, `approved` |
| `created_at` | timestamptz | Sí | Fecha de creación |
| `updated_at` | timestamptz | Sí | Última modificación |

### Ejemplo de `breakdown` (jsonb)

```json
[
  {"partida": "Demoliciones y retirada", "importe": 3200.00, "notas": "Tabiquería cocina-salón + baño"},
  {"partida": "Albañilería", "importe": 8500.00, "notas": "Nuevas divisiones + remates"},
  {"partida": "Fontanería", "importe": 4200.00, "notas": "Reubicación baño completo"},
  {"partida": "Electricidad", "importe": 3800.00, "notas": "Nuevo cuadro + redistribución puntos"},
  {"partida": "Carpintería", "importe": 5100.00, "notas": "Puertas + armarios empotrados"},
  {"partida": "Revestimientos y pavimentos", "importe": 6200.00, "notas": "Porcelánico gama media"},
  {"partida": "Pintura", "importe": 2100.00, "notas": "Toda la vivienda"},
  {"partida": "Cocina (mobiliario)", "importe": 7500.00, "notas": "Cocina completa gama media"},
  {"partida": "Honorarios técnicos", "importe": 3500.00, "notas": "Proyecto + dirección obra"},
  {"partida": "Imprevistos (10%)", "importe": 4410.00, "notas": "Reserva estándar"}
]
```

### Relaciones
- `cost_estimates.project_id` → `projects.id` (N:1)
- Leído por: `agent_trades`, `agent_proposal`, `agent_planner`

---

## 9. ENTIDAD: `trade_requests`

### Propósito
Output del Agente de Oficios. Cada registro es una solicitud de presupuesto a un oficio concreto. Agrupa la información que el oficio necesita para presupuestar y el mensaje preparado para enviarle.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `project_id` | uuid FK → projects | Sí | Proyecto asociado |
| `trade_type` | text | Sí | Oficio: `albanileria`, `fontaneria`, `electricidad`, `carpinteria`, `carpinteria_metalica`, `cocina`, `armarios`, `ventanas`, `pintura`, `climatizacion`, `otro` |
| `scope_description` | text | Sí | Descripción del alcance de trabajo para el oficio |
| `scope_details` | jsonb | No | Desglose detallado de partidas para este oficio |
| `required_info` | jsonb | No | Información que se incluye en el paquete de consulta (medidas, fotos, planos) |
| `contact_name` | text | No | Nombre del profesional/empresa a contactar |
| `contact_phone` | text | No | Teléfono |
| `contact_email` | text | No | Email |
| `draft_message` | text | No | Mensaje preparado para enviar al oficio |
| `message_channel` | text | No | Canal propuesto: `email`, `whatsapp`, `phone` |
| `status` | text | Sí | `prepared`, `approved_to_send`, `sent`, `response_received`, `compared`, `selected`, `rejected` |
| `sent_at` | timestamptz | No | Cuándo se envió la solicitud |
| `response_deadline` | date | No | Fecha límite para recibir respuesta |
| `notes` | text | No | Observaciones |
| `created_at` | timestamptz | Sí | Fecha de creación |
| `updated_at` | timestamptz | Sí | Última modificación |

### Relaciones
- `trade_requests.project_id` → `projects.id` (N:1)
- `trade_requests` → `external_quotes` (1:N). Un trade_request puede tener múltiples presupuestos de respuesta.
- Leído por: `agent_proposal`, `agent_planner`

---

## 10. ENTIDAD: `external_quotes`

### Propósito
Presupuestos recibidos de oficios y proveedores en respuesta a las solicitudes. Permite comparación entre presupuestos del mismo oficio.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `trade_request_id` | uuid FK → trade_requests | Sí | Solicitud a la que responde |
| `project_id` | uuid FK → projects | Sí | Proyecto asociado (denormalizado para consultas rápidas) |
| `provider_name` | text | Sí | Nombre del profesional o empresa |
| `total_amount` | numeric(12,2) | No | Importe total presupuestado (€) |
| `breakdown` | jsonb | No | Desglose si el oficio lo proporciona |
| `includes` | text | No | Qué incluye el presupuesto |
| `excludes` | text | No | Qué NO incluye |
| `validity_days` | int | No | Validez del presupuesto en días |
| `estimated_duration` | text | No | Plazo de ejecución estimado por el oficio |
| `payment_terms` | text | No | Condiciones de pago |
| `received_at` | timestamptz | No | Cuándo se recibió |
| `source_document_id` | uuid FK → documents | No | Referencia al documento escaneado/adjunto si existe |
| `comparison_notes` | text | No | Notas de la comparativa generada por el agente |
| `status` | text | Sí | `received`, `reviewed`, `selected`, `rejected` |
| `created_at` | timestamptz | Sí | Fecha de creación |
| `updated_at` | timestamptz | Sí | Última modificación |

### Relaciones
- `external_quotes.trade_request_id` → `trade_requests.id` (N:1)
- `external_quotes.project_id` → `projects.id` (N:1)
- `external_quotes.source_document_id` → `documents.id` (N:1, opcional)
- Leído por: `agent_costs` (en iteraciones), `agent_proposal`

---

## 11. ENTIDAD: `proposals`

### Propósito
Output del Agente de Propuesta y Presupuesto. La propuesta comercial final que se presenta al cliente. Combina alcance, fases, precio, exclusiones y observaciones en un documento vendible.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `project_id` | uuid FK → projects | Sí | Proyecto asociado (relación 1:1 en MVP, con versionado) |
| `version` | int | Sí | Versión de la propuesta |
| `title` | text | Sí | Título de la propuesta |
| `executive_summary` | text | No | Resumen ejecutivo para el cliente |
| `scope_description` | text | Sí | Descripción del alcance |
| `phases` | jsonb | No | Fases de la intervención con descripción |
| `total_price` | numeric(12,2) | Sí | Precio total propuesto al cliente (€) |
| `price_breakdown` | jsonb | No | Desglose por partidas/fases |
| `exclusions` | jsonb | No | Lo que NO incluye la propuesta |
| `inclusions` | jsonb | No | Lo que SÍ incluye (para claridad) |
| `payment_conditions` | text | No | Condiciones de pago propuestas |
| `validity_days` | int | No | Validez de la propuesta en días |
| `estimated_duration` | text | No | Duración estimada de la obra |
| `warnings` | jsonb | No | Advertencias y condiciones especiales |
| `optional_items` | jsonb | No | Partidas opcionales con precio (ej: "Si quiere suelo radiante: +X€") |
| `document_id` | uuid FK → documents | No | Referencia al documento final generado |
| `status` | text | Sí | `draft`, `pending_review`, `approved_internal`, `sent_to_client`, `accepted`, `rejected`, `revision_requested` |
| `sent_at` | timestamptz | No | Cuándo se envió al cliente |
| `client_response_at` | timestamptz | No | Cuándo respondió el cliente |
| `created_at` | timestamptz | Sí | Fecha de creación |
| `updated_at` | timestamptz | Sí | Última modificación |

### Relaciones
- `proposals.project_id` → `projects.id` (N:1, 1:1 en práctica con versionado)
- `proposals.document_id` → `documents.id` (N:1, opcional)
- Leído por: `agent_planner`, `agent_memory`

---

## 12. ENTIDAD: `project_plans`

### Propósito
Output del Agente Planificador. Plan operativo del proyecto una vez aprobado. Incluye fases, tareas, dependencias, hitos y cronograma.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `project_id` | uuid FK → projects | Sí | Proyecto asociado (relación 1:1) |
| `version` | int | Sí | Versión del plan |
| `total_duration_days` | int | No | Duración total estimada en días laborables |
| `start_date` | date | No | Fecha de inicio prevista |
| `end_date` | date | No | Fecha de fin prevista |
| `phases` | jsonb | Sí | Fases con detalle |
| `milestones` | jsonb | No | Hitos principales |
| `dependencies` | jsonb | No | Dependencias entre tareas/fases |
| `blockers` | jsonb | No | Bloqueos previsibles |
| `critical_path` | jsonb | No | Tareas del camino crítico |
| `status` | text | Sí | `draft`, `approved`, `in_progress`, `completed` |
| `notes` | text | No | Observaciones generales |
| `created_at` | timestamptz | Sí | Fecha de creación |
| `updated_at` | timestamptz | Sí | Última modificación |

### Ejemplo de `phases` (jsonb)

```json
[
  {
    "phase": 1,
    "name": "Demoliciones y preparación",
    "duration_days": 5,
    "trades": ["albanileria"],
    "tasks": ["Demoler tabiquería cocina-salón", "Retirar sanitarios baño", "Limpieza"],
    "depends_on": null
  },
  {
    "phase": 2,
    "name": "Instalaciones",
    "duration_days": 10,
    "trades": ["fontaneria", "electricidad"],
    "tasks": ["Reubicación tomas agua", "Nuevo cuadro eléctrico", "Puntos de luz"],
    "depends_on": [1]
  },
  {
    "phase": 3,
    "name": "Albañilería y tabiquería",
    "duration_days": 7,
    "trades": ["albanileria"],
    "tasks": ["Nuevas divisiones", "Recrecidos", "Remates"],
    "depends_on": [2]
  }
]
```

### Relaciones
- `project_plans.project_id` → `projects.id` (1:1)
- Leído por: `agent_memory`

---

## 13. ENTIDAD: `approvals`

### Propósito
Registro de todas las solicitudes de aprobación humana generadas por el sistema. Trazabilidad completa de qué se pidió aprobar, quién lo aprobó, cuándo y con qué observaciones.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `project_id` | uuid FK → projects | Sí | Proyecto asociado |
| `approval_type` | text | Sí | Tipo: `briefing_review`, `design_review`, `external_contact`, `trade_request_send`, `proposal_review`, `proposal_send`, `project_close` |
| `requested_by` | text | Sí | Nombre del agente/workflow que lo solicita |
| `summary` | text | Sí | Resumen legible de lo que se pide aprobar |
| `details` | jsonb | No | Datos completos para revisión (lo que ve el humano al decidir) |
| `related_entity` | text | No | Tabla de la entidad relacionada (ej: "briefings", "trade_requests") |
| `related_entity_id` | uuid | No | ID de la entidad relacionada |
| `status` | text | Sí | `pending`, `approved`, `rejected`, `expired` |
| `decided_by` | text | No | Quién tomó la decisión |
| `decided_at` | timestamptz | No | Cuándo se decidió |
| `decision_notes` | text | No | Observaciones del aprobador |
| `webhook_token` | uuid | Sí | Token único para el enlace de aprobación |
| `expires_at` | timestamptz | No | Cuándo expira la solicitud |
| `created_at` | timestamptz | Sí | Fecha de creación |

### Constraint de token único

```sql
CREATE UNIQUE INDEX idx_approval_token ON approvals (webhook_token);
```

### Relaciones
- `approvals.project_id` → `projects.id` (N:1)
- Relación genérica vía `related_entity` + `related_entity_id` (polimorfismo simple sin FK formal; consultas manuales).

### Notas
- `webhook_token` es de un solo uso. Una vez respondido, el token se invalida (status pasa de pending a approved/rejected).
- `expires_at` se configura según el tipo de aprobación (24h para urgentes, 72h para normales). El workflow `cron_project_review` detecta las expiradas.

---

## 14. ENTIDAD: `activity_log`

### Propósito
Trazabilidad completa. Cada acción relevante del sistema se registra aquí: qué agente hizo qué, cuándo, con qué inputs y outputs. Es la auditoría del sistema.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `project_id` | uuid FK → projects | No | Proyecto asociado (null si es acción global) |
| `agent_name` | text | Sí | Agente que ejecutó la acción (ej: "agent_briefing", "main_orchestrator") |
| `action` | text | Sí | Acción realizada (ej: "briefing_generated", "approval_requested", "llm_call") |
| `phase_at_time` | text | No | Fase del proyecto en el momento de la acción |
| `input_summary` | text | No | Resumen de los inputs usados |
| `output_summary` | text | No | Resumen del output generado |
| `llm_model` | text | No | Modelo de LLM usado (si aplica) |
| `llm_tokens_in` | int | No | Tokens de input (si aplica) |
| `llm_tokens_out` | int | No | Tokens de output (si aplica) |
| `llm_cost_estimated` | numeric(8,4) | No | Coste estimado de la llamada al LLM (€) |
| `duration_ms` | int | No | Duración de la ejecución en milisegundos |
| `status` | text | Sí | `success`, `error`, `warning`, `skipped` |
| `error_message` | text | No | Mensaje de error si status = error |
| `execution_id` | text | No | ID de ejecución de n8n (para correlacionar con logs de n8n) |
| `created_at` | timestamptz | Sí | Timestamp de la acción |

### Relaciones
- `activity_log.project_id` → `projects.id` (N:1, nullable)
- No es leída por agentes: es para debugging, auditoría y analytics.

### Notas
- Esta tabla crece rápido. En el MVP no es problema (500MB da para miles de registros). En producción, aplicar retención: archivar logs de más de 6 meses en tabla `activity_log_archive` o exportar a archivo.
- Índice recomendado: `CREATE INDEX idx_activity_project ON activity_log (project_id, created_at DESC);`

---

## 15. ENTIDAD: `memory_cases`

### Propósito
Output del Agente de Memoria. Base de conocimiento acumulada del estudio. Cada registro es un caso cerrado con su resumen, decisiones, costes finales, lecciones aprendidas y patrones detectados. Permite que futuros proyectos se beneficien de la experiencia acumulada.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `project_id` | uuid FK → projects | Sí | Proyecto de origen (relación 1:1) |
| `project_type` | text | Sí | Tipo de proyecto (copiado para búsqueda rápida) |
| `location_zone` | text | No | Zona geográfica (barrio, municipio) |
| `property_type` | text | No | Tipo de inmueble |
| `area_m2` | numeric(8,2) | No | Superficie |
| `summary` | text | Sí | Resumen del caso en 5-10 líneas |
| `scope_summary` | text | No | Resumen del alcance real ejecutado |
| `decisions_made` | jsonb | No | Decisiones clave tomadas y por qué |
| `cost_estimated` | numeric(12,2) | No | Coste que se estimó inicialmente |
| `cost_final` | numeric(12,2) | No | Coste final real |
| `cost_deviation_pct` | numeric(5,2) | No | Desviación porcentual |
| `duration_estimated_days` | int | No | Duración estimada |
| `duration_actual_days` | int | No | Duración real |
| `trades_used` | jsonb | No | Oficios usados con valoración |
| `materials_notable` | jsonb | No | Materiales destacados (buenos o malos resultados) |
| `lessons_learned` | jsonb | No | Lecciones aprendidas |
| `problems_encountered` | jsonb | No | Problemas encontrados y cómo se resolvieron |
| `patterns` | jsonb | No | Patrones detectados (reutilizables) |
| `client_satisfaction` | text | No | `muy_satisfecho`, `satisfecho`, `neutral`, `insatisfecho` |
| `tags` | text[] | Sí | Etiquetas para búsqueda |
| `created_at` | timestamptz | Sí | Fecha de creación |

### Ejemplo de `trades_used` (jsonb)

```json
[
  {"trade": "albanileria", "provider": "Reformas López", "rating": 4, "notes": "Buen trabajo, puntual"},
  {"trade": "electricidad", "provider": "Elecma S.L.", "rating": 5, "notes": "Excelente. Resolver imprevistos rápido"},
  {"trade": "cocina", "provider": "Cocinas Pro", "rating": 3, "notes": "Retraso de 2 semanas en entrega"}
]
```

### Relaciones
- `memory_cases.project_id` → `projects.id` (1:1)
- Leído por: `agent_design` (buscar proyectos similares), `agent_costs` (referencias de costes), `agent_trades` (valoración de oficios)

### Notas
- **MVP:** búsqueda por `project_type` + `location_zone` + `tags` con SQL filtrado.
- **V2:** añadir columna `embedding vector(1536)` y crear función de búsqueda semántica con pgvector. No se implementa en MVP para no añadir complejidad de embeddings.

---

## 16. ENTIDAD: `agent_prompts`

### Propósito
Almacena los prompts de cada agente de forma versionada. Permite cambiar el comportamiento de un agente sin tocar el workflow de n8n: solo se actualiza el prompt en la BD. Cada agente lee su prompt actual antes de ejecutarse.

### Campos

| Campo | Tipo | Requerido | Propósito |
|---|---|---|---|
| `id` | uuid PK | Sí | Identificador único |
| `agent_name` | text | Sí | Nombre del agente (ej: "agent_briefing") |
| `prompt_type` | text | Sí | Tipo: `system`, `user_template`, `output_format` |
| `version` | int | Sí | Versión del prompt |
| `is_active` | boolean | Sí | ¿Es la versión activa? Default: false |
| `content` | text | Sí | Texto del prompt |
| `model_recommended` | text | No | Modelo de LLM recomendado para este prompt |
| `temperature` | numeric(3,2) | No | Temperatura recomendada |
| `notes` | text | No | Notas sobre cambios en esta versión |
| `created_at` | timestamptz | Sí | Fecha de creación |

### Constraint

```sql
-- Solo un prompt activo por agente y tipo
CREATE UNIQUE INDEX idx_active_prompt 
ON agent_prompts (agent_name, prompt_type) WHERE is_active = true;
```

### Relaciones
- Independiente. Referenciada por nombre de agente, no por FK.
- Leída por: todos los sub-workflows de agentes al inicio de su ejecución.

### Notas
- Esto permite A/B testing de prompts: activar una nueva versión, comparar resultados en `activity_log`, y decidir si mantener o revertir.
- El agente lee su prompt así: `SELECT content FROM agent_prompts WHERE agent_name = 'agent_briefing' AND prompt_type = 'system' AND is_active = true`

---

## 17. RESUMEN DE RELACIONES

```
clients
  └── 1:N → projects
                ├── 1:1 → briefings (con versionado)
                ├── 1:N → design_options (1-3 opciones)
                ├── 1:N → regulatory_tasks
                ├── 1:N → documents
                ├── 1:N → material_items
                │           └── N:1 → material_items (alternativas, auto-ref)
                ├── 1:N → cost_estimates (con versionado)
                ├── 1:N → trade_requests
                │           └── 1:N → external_quotes
                │                       └── N:1 → documents (adjunto opcional)
                ├── 1:1 → proposals (con versionado)
                │           └── N:1 → documents (doc generado)
                ├── 1:1 → project_plans (con versionado)
                ├── 1:N → approvals
                ├── 1:N → activity_log
                └── 1:1 → memory_cases

agent_prompts (independiente, sin FK a projects)
```

---

## 18. ÍNDICES RECOMENDADOS PARA EL MVP

```sql
-- Consultas frecuentes del orquestador
CREATE INDEX idx_projects_phase ON projects (current_phase) WHERE status = 'active';
CREATE INDEX idx_projects_status ON projects (status);

-- Búsqueda de aprobaciones pendientes
CREATE INDEX idx_approvals_pending ON approvals (project_id, status) WHERE status = 'pending';

-- Activity log por proyecto y fecha
CREATE INDEX idx_activity_project ON activity_log (project_id, created_at DESC);

-- Prompt activo por agente
CREATE UNIQUE INDEX idx_active_prompt ON agent_prompts (agent_name, prompt_type) WHERE is_active = true;

-- Una sola opción de diseño seleccionada por proyecto
CREATE UNIQUE INDEX idx_one_selected_option ON design_options (project_id) WHERE is_selected = true;

-- Token único de aprobación
CREATE UNIQUE INDEX idx_approval_token ON approvals (webhook_token);

-- Materiales por proyecto y categoría
CREATE INDEX idx_materials_project ON material_items (project_id, category);

-- Trade requests por proyecto y estado
CREATE INDEX idx_trades_project ON trade_requests (project_id, status);

-- Memory cases para búsqueda
CREATE INDEX idx_memory_type_zone ON memory_cases (project_type, location_zone);
CREATE INDEX idx_memory_tags ON memory_cases USING GIN (tags);
```

---

## 19. ESTIMACIÓN DE TAMAÑO EN BD

| Entidad | Registros por proyecto (estimado) | Bytes por registro (aprox) | Para 50 proyectos |
|---|---|---|---|
| clients | 1 | 500B | 25KB |
| projects | 1 | 1KB | 50KB |
| briefings | 1-2 | 3KB | 300KB |
| design_options | 1-3 | 2KB | 300KB |
| regulatory_tasks | 3-8 | 1.5KB | 600KB |
| documents | 10-30 | 500B | 750KB |
| material_items | 15-50 | 800B | 2MB |
| cost_estimates | 1-3 | 3KB | 450KB |
| trade_requests | 5-10 | 1.5KB | 750KB |
| external_quotes | 10-20 | 1.5KB | 1.5MB |
| proposals | 1-2 | 4KB | 400KB |
| project_plans | 1 | 3KB | 150KB |
| approvals | 5-10 | 1KB | 500KB |
| activity_log | 50-200 | 500B | 5MB |
| memory_cases | 1 | 3KB | 150KB |
| agent_prompts | 30 (fijo) | 2KB | 60KB |
| **TOTAL** | | | **~13MB** |

**Conclusión:** con 500MB del tier gratuito de Supabase, caben cómodamente más de 100 proyectos. El cuello de botella será `activity_log` si se loggea muy agresivamente, pero aun así el MVP tiene margen de sobra.

---

## 20. SCRIPT SQL DE CREACIÓN (MVP)

El script SQL completo para crear todas las tablas está preparado como entregable separado. Se ejecutará en Supabase (Dashboard → SQL Editor).

Incluye:
- Todas las tablas con sus campos y constraints
- Índices recomendados
- Función `update_updated_at()` trigger para mantener `updated_at` automáticamente
- Comentarios en cada tabla explicando su propósito

Se entregará al pasar al BLOQUE 3 o cuando lo solicites.

---

*Documento: BLOQUE 2 — Modelo de Datos Mínimo del MVP*
*BD: Supabase (PostgreSQL 15+ con pgvector disponible)*
*Siguiente: BLOQUE 3 — Mapa de workflows de n8n*
