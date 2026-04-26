# ArquitAI — Especificación canónica y roadmap estratégico

> Documento vivo. Punto de partida único para toda decisión de producto y arquitectura.
> Cada bloque sigue tres pautas: **Técnica** (cómo se implementa en n8n / stack), **Función** (qué hace exactamente), **Beneficio** (qué problema del arquitecto resuelve).

---

## 0. Qué es ArquitAI

Sistema multiagente para estudios de arquitectura técnica especializados en **reformas de vivienda en España**. Toma un proyecto ya captado (cliente existente) y lo procesa desde briefing hasta propuesta comercial, plan de obra y memoria organizacional, con el arquitecto como único decisor humano en los nodos críticos.

**Stack base:**
- n8n 2.12.x (self-hosted en EasyPanel) como orquestador
- Supabase / PostgreSQL 15+ como única fuente de verdad del estado del negocio
- Anthropic Claude / OpenAI GPT-4 como motor de razonamiento vía `util_llm_call`
- Google Drive / Docs / Sheets para almacenamiento documental
- Gmail OAuth2 para aprobaciones y notificaciones

**Principios inmutables:**
- Ningún agente contacta terceros sin aprobación humana.
- La decisión técnica, normativa, legal y económica final es siempre del arquitecto.
- El estado del proyecto vive en `projects.current_phase` en Supabase. n8n es stateless.
- Un solo agente por oficio (no micro-agentes).
- Arquitectura multi-tenant planificada para V2 — MVP es single-arquitecto (Damián).

---

## 1. Núcleo MVP construido (estado: 2026-04-24)

### 1.1 Máquina de estados — `main_orchestrator`

**Técnica.** Workflow n8n (ID `EF5lPbSNlmA3Upt1`, 82 nodos). Webhook POST `/webhook/orchestrator` con `{project_id, action: "advance"}`. Carga proyecto, verifica activo + no pendiente de aprobación, rutea por `current_phase` a un `executeWorkflow` del agente correspondiente, evalúa resultado y actualiza fase en DB.

**Función.** Avanza una fase por disparo. Lee `projects.current_phase`, ejecuta exactamente un agente, escribe la fase siguiente. Si el agente falla, registra warning y no avanza.

**Beneficio.** El arquitecto dispara el pipeline y olvida: cada fase se procesa sin intervención salvo en los tres puntos de aprobación bloqueante. No hay estado oculto en memoria — cualquier sesión recupera el proyecto desde DB.

**Fases:** `intake → briefing_done → design_done → analysis_done → costs_done → trades_done → proposal_done → approved → planning_done → completed → archived`. `approved` es manual (el arquitecto cambia la fase cuando el cliente acepta).

---

### 1.2 Agentes de negocio (11)

| # | Agente | n8n ID | Fase input → output | Bloqueante |
|---|---|---|---|---|
| 1 | agent_briefing | `uq3GQWSdmoIV4ZdR` | intake → briefing_done | ✅ Wait |
| 2 | agent_design | `sMGf7e8CSnsBQa1q` | briefing_done → design_done | ✅ Wait |
| 3 | agent_regulatory | `QbRMmQs0oyVHplgE` | design_done → analysis_done | — |
| 4 | agent_materials | `SOJW7SgCrJebLRP8` | analysis_done | — |
| 5 | agent_documents | `E5uOVocm8GwNH278` | design_done / costs_done | — |
| 6 | agent_costs | `FhF8zelE1KehUD4Z` | analysis_done → costs_done | — |
| 7 | agent_trades | `NHTZkeLUL7qUQPLG` | costs_done → trades_done | — |
| 8 | agent_proposal | `Mqx8S6nR6exbRY86` | trades_done → proposal_done | ✅ Wait |
| 9 | agent_planner | `lSUfNw61YfbERI8n` | approved → planning_done | — |
| 10 | agent_memory | `gLxmy7M0UmC7Yzye` | planning_done | — |
| 11 | agent_normativa_refresh | `0Cyeaa85uLS7c8EE` | manual / scheduled | — |
| 12 | agent_safety_plan | `yRaR3V0j61R1g1jZ` | bajo demanda (post-trades_done) | — |
| 13 | agent_accessibility | `s7ctmUsITOWK7cRT` | bajo demanda (post-design_done) | — |

#### 1.2.1 `agent_briefing`
- **Técnica.** Carga project + client, prompt del agente desde `agent_prompts`, `util_llm_call`, parse con fallback, detect scope creep (hash djb2 sobre rooms_affected + constraints + budget), Draft/Commit en tabla `briefings`, email de aprobación, Wait webhook, update según decisión, `Write Intelligence` + `Update Project Hash`.
- **Función.** Transforma texto libre del cliente en briefing estructurado: `client_needs`, `objectives`, `constraints`, `rooms_affected`, `missing_info`, `open_questions`, `style_preferences`.
- **Beneficio.** Evita que información del cliente se pierda en WhatsApp/email/papel. Detecta automáticamente cuando el cliente cambia el alcance respecto a una versión anterior (`scope_creep_detected: true`) — problema real que hace saltar plazos y presupuesto.

#### 1.2.2 `agent_design`
- **Técnica.** Lee briefing aprobado, genera opciones de diseño vía LLM, guarda en `design_options` con Draft/Commit, email de aprobación con opciones, Wait, persiste `is_selected` en la elegida.
- **Función.** Propone 2-3 opciones de redistribución con `intervention_logic`, `rooms_layout`, `technical_notes`, `conflict_points`, `pros/cons`, `estimated_complexity`.
- **Beneficio.** El arquitecto parte de opciones estructuradas que ya consideran compromisos (estructura, instalaciones, luz natural) en lugar de hoja en blanco.

#### 1.2.3 `agent_regulatory`
- **Técnica.** Lee opción de diseño aprobada, fetcha normativa viva vía `util_normativa_fetch` (Jina AI Reader sobre CTE, PGOU, ordenanzas municipales), prompt estratificado en 3 capas (nacional / autonómica / municipal) usando `location_province` → CCAA_MAP, parse con `normativa_confidence` y `citation_source`, INSERT en `regulatory_tasks` con `normativa_fetched_at = NOW()`.
- **Función.** Lista trámites requeridos, documentación necesaria, entidad competente, plazo estimado, coste y nivel de confianza de cada afirmación normativa.
- **Beneficio.** Cierra tres agujeros reales del oficio: (a) hallucination de normativa por el LLM, marcada con confidence y URL de cita; (b) estratificación (CTE vs autonómico vs municipal); (c) trazabilidad del momento exacto en que se consultó cada fuente.

#### 1.2.4 `agent_materials`
- **Técnica.** Load proyecto + design_option aprobado + `supplier_catalog` del arquitecto (vacío por defecto, cada arquitecto añade los suyos). Prompt con catálogo, parse, INSERT en `material_items`.
- **Función.** Propone materiales por categoría (pavimento, sanitarios, cocina, carpintería, grifería) con marca, modelo, calidad y precio estimado.
- **Beneficio.** El arquitecto deja de empezar cada proyecto desde cero: sus proveedores preferidos se usan por defecto y quedan trazados por proyecto.
- **Mejora planificada:** `util_price_search` + Leroy Merlin vía Jina Reader para precios reales en vez de estimaciones del LLM.

#### 1.2.5 `agent_documents`
- **Técnica.** Determinista, sin LLM. Construye estructura de carpetas en Drive vía `util_file_organizer`, genera Google Docs con templates y datos del proyecto.
- **Función.** En design_done: memoria de proyecto + planos base. En costs_done: propuesta comercial draft + anexos.
- **Beneficio.** Los docs standard se generan idénticos en todos los proyectos. El arquitecto invierte tiempo solo en el contenido técnico singular.

#### 1.2.6 `agent_costs`
- **Técnica.** Load design + breakdown de trades intención + prompt con contexto presupuestario. LLM genera `breakdown[]` con partidas, importes y notas. INSERT en `cost_estimates` con `total_estimated`, `deviation_pct` vs `budget_target`, `deviation_status`.
- **Función.** Desglose económico por partidas con comparativa automática al presupuesto objetivo del cliente.
- **Beneficio.** Evita el "presupuesto servilleta" — cada partida queda justificada y la desviación respecto al objetivo del cliente es explícita antes de presentar la propuesta.
- **Mejora planificada:** tabla `price_references` con ~30 partidas CYPE pre-pobladas + validación `price_warning: true` si la partida se desvía >30% del rango CYPE.

#### 1.2.7 `agent_trades`
- **Técnica.** Lee costs + design, agrupa trabajo por especialidad, inserta filas en `trade_requests` con `status: 'prepared'` — sin enviar nada a los gremios.
- **Función.** Prepara el encargo por especialidad (albañilería, fontanería, electricidad, carpintería, etc.) con `scope_description` listo para enviar.
- **Beneficio.** El arquitecto revisa encargos estructurados antes de contactar gremios. Los envíos siempre requieren aprobación humana — ningún email sale sin confirmación.

#### 1.2.8 `agent_proposal`
- **Técnica.** Preflight cross-check de 4 prerequisitos (briefing + design + costs + trades). Si falta algo → `status: 'error'`. Si todo OK → LLM redacta propuesta comercial, save en `proposals` con `status: 'pending_review'`, email de aprobación al arquitecto, Wait webhook, persiste decisión.
- **Función.** Propuesta comercial consolidada: alcance, desglose, plazos, condiciones, opciones. Es el documento que llega al cliente tras la validación del arquitecto.
- **Beneficio.** Cierra el problema #9 — validación cruzada antes de comprometerse con el cliente. Evita enviar propuestas inconsistentes (presupuesto que no encaja con diseño o con gremios).

#### 1.2.9 `agent_planner`
- **Técnica.** Preflight de 4 prerequisitos (IF `typeVersion 2.2` con `operation: "true"`), LLM genera plan con fases ordenadas, `dependencies[]`, `duration_weeks`, milestones y `critical_path`. INSERT en `project_plans` con `total_duration_days` y `phases/milestones/critical_path` como jsonb.
- **Función.** Plan de obra: secuencia técnica (demolición → obra civil → instalaciones → tabiquería → acabados → equipamiento), hitos de control y camino crítico.
- **Beneficio.** Convierte "la obra dura 3 meses" en una planificación con dependencias reales — permite al arquitecto comunicar plazos creíbles y detectar retrasos en cuanto ocurren.

#### 1.2.10 `agent_memory`
- **Técnica.** Load de todo el proyecto (briefing, design, costs, trades, plan, materiales, project_intelligence). LLM extrae `summary`, `scope_summary`, `decisions_made[]`, `lessons_learned[]` categorizadas, `patterns[]`, `tags[]`. INSERT en `memory_cases`.
- **Función.** Destila un proyecto completado en conocimiento reutilizable, buscable por `project_type + location_zone + property_type + tags`.
- **Beneficio.** Los aprendizajes de cada obra dejan de vivir solo en la cabeza del arquitecto. Futuros proyectos similares cargan `memory_cases` como contexto automáticamente → mejores estimaciones de plazo, presupuesto y riesgos.

#### 1.2.11 `agent_safety_plan`
- **Técnica.** Workflow `yRaR3V0j61R1g1jZ` (14 nodos). Lee proyecto completo (briefing + design + trades + plan), llama a `util_llm_call` con prompt enriquecido (RD 1627/1997 + riesgos típicos por fase + EPIs con norma EN), parsea JSON, INSERT en tabla `safety_plans` (jsonb completo + google_doc_url), crea Google Doc con título `EBSS - {project_name}`, inserta contenido formateado.
- **Función.** Genera EBSS o PSS según supuestos del art. 4 RD 1627/1997, con identificación automática del tipo de documento. Riesgos por fase, EPIs específicos por gremio (con norma UNE-EN), protecciones colectivas, concurrencia de actividades, protocolo emergencia. Recomendaciones específicas al arquitecto (evaluación amianto pre-2002, REBT, DB-HR, etc.).
- **Beneficio.** Cumplimiento RD 1627/1997 sin copiar-pegar genérico. 3-5h ahorradas por proyecto. El documento es coherente con el plan de obra y los gremios reales del proyecto, no genérico.
- **Requisito operativo.** Google Docs API habilitada en el proyecto GCP del usuario. Si la API no está activa, contenido se guarda en `safety_plans.content_json` pero el Doc en Drive queda vacío (continueOnFail). Resuelto el 2026-04-25 activando la API.
- **Detalle técnico.** El insertado de contenido en el Doc se hace con HTTP Request directo a `docs.googleapis.com/v1/documents/{id}:batchUpdate` (insertText con `index: 1`) en lugar del nodo Google Docs de n8n, que daba "Bad Request" por incompatibilidad de schema interno.

#### 1.2.12 `agent_accessibility`
- **Técnica.** Workflow `s7ctmUsITOWK7cRT` (11 nodos). Lee briefing + design_option seleccionado + datos del proyecto. Llama a `util_llm_call` con prompt enriquecido (DB-SUA 9 + Orden VIV/561/2010 + parámetros por estancia: anchos, alturas, resbaladicidad, mecanismos). Parsea JSON, INSERT en `accessibility_audits` con compliance_issues + recommendations + commercial_argumentation. Write Intelligence en `project_intelligence` para que otros agentes consulten.
- **Función.** Detecta automáticamente si DB-SUA 9 aplica obligatoriamente al proyecto y, en cualquier caso, audita parámetros relevantes (anchos puerta ≥80cm, pasillo ≥100cm, solado baño clase 2, espacio maniobra Ø120cm, altura mecanismos 80-120cm, vidrio templado/laminar en mampara). Genera lista de issues con severidad + opciones de corrección + argumentación comercial en lenguaje cliente.
- **Beneficio.** (a) Detectar incumplimientos ANTES de ejecutar carpinterías evita rehacer puertas y baños. (b) Argumentación comercial lista para que el arquitecto venda mejoras de accesibilidad como buenas prácticas (revaloriza inmueble, futuro-proof). (c) En proyectos de cambio de uso (local→vivienda, turístico) detección automática de aplicabilidad obligatoria.
- **Tabla**: `accessibility_audits` (migración 005) con `applies_to_project`, `overall_compliance`, `compliance_issues[]`, `recommendations[]`, `commercial_argumentation`.
- **Test E2E 2026-04-25**: proyecto `1dc2b176` — devolvió `applies_to_project: false` (correcto, piso individual privado), 5 recomendaciones (3 "comercial" + 2 "recomendado") + commercial_argumentation usable directamente con el cliente.

#### 1.2.13 `agent_normativa_refresh`
- **Técnica.** Loop por cada fuente en `normativa_sources`. `util_normativa_fetch` → LLM parse → hash djb2 del contenido → compara con `content_hash` previo → detecta cambios → actualiza `normativa_knowledge` → si hay cambios, marca `regulatory_tasks.status = 'requires_review'` en proyectos activos + email de alerta.
- **Función.** Cache warmer que detecta cuándo una fuente oficial (CTE, PGOU, ordenanza) ha cambiado desde la última lectura.
- **Beneficio.** La normativa no es estática — este agente evita que un trámite se gestione con una versión obsoleta y se lo comunica al arquitecto con la lista exacta de proyectos afectados.

---

### 1.3 Utilidades compartidas

| Utilidad | n8n ID | Función | Beneficio |
|---|---|---|---|
| `util_llm_call` | `JoKqGZ8pDzhJohV2` | Wrapper centralizado de Anthropic / OpenAI con `workflowInputs.autoMapInputData` | Cambiar proveedor o modelo en un solo sitio |
| `util_notification` | `ks2CqrtJCxLJTPdV` | Envío de emails vía Gmail OAuth2 con plantillas | Notificaciones coherentes en todos los agentes |
| `util_file_organizer` | `QFEaO5gJEC7c0wvf` | Estructura de carpetas de proyecto en Drive | Organización idéntica en todos los proyectos |
| `util_consultation` | `bjKNchMYN2wXKO0k` | Cola de consultas no bloqueantes (`consultation_queue`) | El arquitecto responde a su ritmo — los agentes no bloquean |
| `util_architect_presence` | `1WLpSzgcitGJoaoZ` | Toggle online/offline del arquitecto | Las consultas acumuladas se envían en un email al desconectar |
| `util_normativa_fetch` | `4a03tQ7Q5nmtBpnI` | Fetch live de fuentes oficiales vía Jina AI Reader | Citas verificables en cada trámite regulatorio |
| `util_price_search` | `PsKCThwfby9t9Zfz` | Búsqueda de precios en web (Leroy Merlin) | Precios reales en material_items (post-MVP) |
| `util_generate_embedding` | `xZaguYuuTG0mXSf2` | Wrapper a OpenAI text-embedding-3-small (1536 dim) | Memoria semántica entre proyectos |
| `util_search_similar_cases` | `U9U5GPfuWi7DI4TW` | Similarity search (pgvector cosine) sobre memory_cases | agent_briefing inyecta casos similares automáticamente |
| `error_handler` | `qfQWaGSpyjgdeFt5` | Captura de errores globales | Visibilidad de fallos en producción |

---

### 1.4 Crons

| Cron | n8n ID | Periodicidad | Función | Beneficio |
|---|---|---|---|---|
| `cron_project_review` | `AX05W4baMEfJokWN` | 6 h | Detecta proyectos huérfanos (sin avanzar > umbral por fase: intake=3d, costs/trades/proposal_done=5d, resto=7d, planning_done=14d) | Ningún proyecto se queda olvidado en una fase intermedia |
| `cron_consultation_batch` | `4vyizezPgg3kr192` | 4 h | Re-notifica consultas pendientes si el arquitecto lleva >2 h offline | Seguridad contra olvidos del propio arquitecto |
| `cron_post_phase_audits` | `UyfJNFuf17w2BmFU` | 30 min | Auto-trigger `agent_accessibility` para proyectos en fase ≥ design_done sin auditoría < 30 días, y `agent_safety_plan` para proyectos en fase ≥ approved sin EBSS < 60 días | Cumplimiento normativo automático sin intervención del arquitecto |

---

### 1.5 Modelo de datos — 16 tablas centrales

`projects`, `clients`, `briefings`, `design_options`, `regulatory_tasks`, `normativa_knowledge`, `normativa_sources`, `material_items`, `supplier_catalog`, `cost_estimates`, `price_references`, `trades`, `trade_requests`, `proposals`, `project_plans`, `memory_cases`, más `agent_executions`, `agent_prompts`, `project_intelligence`, `activity_log`, `architect_status`, `consultation_queue`.

**Patrones transversales:**
- **Draft/Commit** con `execution_id` + `exec_status` en tablas de salida → un fallo parcial nunca deja estado inconsistente.
- **Intelligence compartida** en `project_intelligence` (project_id, agent_name, key, value jsonb) → los agentes dejan de trabajar en silos.
- **Scope creep detection** con hash djb2 en `projects.briefing_hash`.
- **Citas normativas** con `normativa_confidence` + `citation_source` + `normativa_fetched_at` en cada trámite.

---

## 2. Roadmap cercano — ya planificado, parcialmente implementado

### 2.1 `util_price_search` + mejora `agent_materials` — ✅ infraestructura lista (2026-04-24)
- **Técnica.** Workflow `PsKCThwfby9t9Zfz` activo con 6 nodos: recibe `{material_name, category, quality_tier}`, intenta Leroy Merlin vía Jina Reader, hace lookup en `supplier_catalog` por category + ILIKE sobre item_name/brand, y mergea resultados priorizando catálogo del arquitecto. `agent_materials` ya está cableado con `Search Material Price` en loop para 5 categorías principales.
- **Función.** Devuelve `{min_price, avg_price, max_price, source: 'catalog'|'web_search'|'not_found', source_url, catalog_matches, web_prices_found}`. Cuando el arquitecto llena `supplier_catalog` con sus proveedores, los precios del catálogo tienen prioridad sobre la web.
- **Beneficio.** Propuestas económicas con precios verificables. Test 2026-04-24: con 3 items de catálogo, devolvió correctamente min=12.50€/max=42€/avg=24.48€ en 37 s.
- **Limitación conocida.** Leroy Merlin, BricoDepot, Bauhaus bloquean con 403 el scraping de Jina Reader free. Fuentes viables:
  1. **Supplier catalog del arquitecto** (fuente primaria recomendada) — el arquitecto llena `supplier_catalog` con sus proveedores de confianza.
  2. **Jina Reader tier premium con API key** (~$20/mes) — atraviesa la mayoría de protecciones anti-bot.
  3. **ScraperAPI / Scrapingbee** (~$50/mes) — proxies residenciales para sitios muy protegidos.
  4. **Webs pequeñas locales** (suministros regionales) — tienden a no bloquear scraping.

### 2.2 `price_references` + validación `agent_costs` — ✅ tabla creada y seeded
- **Técnica.** Tabla `price_references` con índices en `partida` y `category`. 38 partidas CYPE seed-poblado cubriendo 9 categorías (demolicion, albanileria, acabados, electricidad, fontaneria, climatizacion, carpinteria, cocina, otros). Migración en [schemas/migrations/003_prices.sql](schemas/migrations/003_prices.sql). Schema base actualizado en [mvp_schema.sql](schemas/mvp_schema.sql).
- **Función.** Tabla lista para consulta: `SELECT * FROM price_references WHERE category = 'acabados' ORDER BY avg_price`. Falta cablear `agent_costs` con un nodo `Load Price References` + `Validate Breakdown` que cruce cada partida del LLM y marque `price_warning: true` si la desviación supera el 30 %.
- **Beneficio.** El arquitecto detecta instantáneamente partidas infravaloradas (riesgo de desbordarse) o sobrevaloradas (riesgo de perder el contrato).
- **Pendiente.** Modificar `agent_costs` para leer `price_references` y añadir validación por partida. Estimado 1 hora.

### 2.3 LightRAG para normativa semántica
- **Técnica.** Framework RAG con grafos de conocimiento sobre PostgreSQL. Indexación semántica de CTE, documentos básicos, PGOU, normativa autonómica.
- **Función.** Consultas tipo "¿qué dice el CTE sobre REI-60 en separación con local comercial?" con citas exactas de artículo/párrafo.
- **Beneficio.** Reemplaza el fetch-cada-vez actual por recuperación semántica real. Cierra el problema #1 (hallucination de normativa) con profundidad.

### 2.4 `agent_3d_design` + ecosistema 3D
- **Técnica.** Agente con razonamiento espacial conectado a SketchUp o Blender vía MCP/API. RAG especializado en ergonomía/proporciones. Colaboración en tiempo real con `agent_regulatory` — consulta cumplimiento mientras diseña.
- **Función.** Genera geometría 3D desde la opción de diseño aprobada, buscando referencias visuales en web para alimentar el contexto.
- **Beneficio.** El arquitecto recibe un modelo 3D inicial coherente con briefing + normativa + preferencias, listo para refinar en su software habitual.

### 2.5 Chat sidebar + directives system
- **Técnica.** UI web con comunicación bidireccional arquitecto ↔ agentes en tiempo real. Tabla `architect_directives` con preferencias ("siempre granito en encimera", "evitar PVC en carpintería exterior"). Cada agente consulta las directrices antes de decidir; si colisionan con normativa → `consultation_reason: "directive_conflict"` → email inmediato.
- **Función.** Arquitecto conversa con los agentes como con un equipo — interviene sin tener que editar JSON o SQL.
- **Beneficio.** Captura el "juicio profesional" del arquitecto en reglas reutilizables que se aplican solas en proyectos futuros.

### 2.6 Arquitectura multi-tenant (V2)
- **Técnica.** Onboarding por arquitecto: swap completo de credenciales en n8n + seed de `trades`, `price_references`, `agent_prompts`. `tenant_id` en todas las tablas. No hardcodear emails ni IDs en lógica — solo en credenciales.
- **Función.** ArquitAI como producto SaaS, cada estudio con su instancia lógica aislada.
- **Beneficio.** Escalado económico más allá de un solo arquitecto; posibilidad de `memory_cases` compartidos anonimizados (ver 3.10).

---

## 3. Nuevas oportunidades — lagunas del oficio

### 3.1 ~~Seguimiento de obra en tiempo real~~ — ✅ MVP CONSTRUIDO (2026-04-25)
- **Construido (fase 1)**: tabla `site_reports` (migración 011) + workflow `agent_site_monitor` (`DPy3FBugAbWP10BD`). Endpoint `POST /webhook/site-report` recibe `{project_id, photo_url|photo_urls[], observations?, expected_phase?}` con auth. Llama a OpenAI vision (`gpt-4o`) con la imagen + plan + design seleccionado. Devuelve detected_phase, progress_pct, deviations[], issues_detected[]. Si flagged (severity high o ≥3 issues) → email HTML automático a Damián. ~$0.005-0.012 por reporte.
- **Pendiente (fase 2)**: Gmail trigger para auto-procesar emails con asunto `[obra <project>]`; WhatsApp via Evolution API; cron semanal de resumen agregado por proyecto; comparación temporal entre reportes de la misma fase.

### 3.2 Coordinación automatizada con gremios — `agent_trade_comms`
- **Laguna real.** `agent_trades` prepara el encargo, pero el envío, re-cotizaciones, respuestas y recordatorios son llamadas y WhatsApps manuales. Horas a la semana.
- **Construido (fase 1, email MVP, 2026-04-25)**: tabla `trade_quotes` (20 cols, migración 013). Workflows `trade_quote_request` (`C8LmBilsqMTGNFut`, envía email al gremio con webhook_token único + reply_url), `trade_quote_reply` (`NmZApRC3Oj7nkRIS`, sin auth pero validado por token, el gremio responde via formulario). Email automático a Damián al recibir respuesta. Documentado en `knowledge/agent_trade_comms.md`.
- **Pendiente (fase 2)**: cron `expired` para solicitudes sin respuesta > N días; re-envío automático; aceptación que genere `trade_request`; canal WhatsApp via Evolution API; OCR de presupuestos PDF adjuntos.

### 3.3 ~~Gestión de licencias y trámites municipales~~ — ✅ MVP CONSTRUIDO (2026-04-25)
- **Construido (fase 1)**: Tabla `permit_applications` + `permit_status_history`. Workflows `permit_register` (`4d4Js8Y5fuZI4W9Q`), `permit_update_status` (`QGiZjzrCeRcxWjqj`), `cron_permit_review` (`0LK6VrMq5lHOFJaL`, diario 09:00). Hook automático: `regulatory_tasks` confirmadas con task_type elegible auto-crean permit. Email HTML diario con tabla por prioridad (overdue / due_soon / stale_check / normal). Documentación en `knowledge/agent_permit_tracker.md`.
- **Pendiente (fase 2)**: Scraping/consulta automática a sedes electrónicas municipales (cada ayuntamiento es distinto — empezar por Madrid). Integración Autofirma/FNMT para presentar subsanaciones.

### 3.4 ~~Portal cliente + chatbot dedicado~~ — ✅ MVP API CONSTRUIDO (2026-04-26)
- **Construido (fase 1, API)**: tabla `client_conversations` (16 cols) + extensión `client_access_tokens.purpose` con `'client_ask'` (migración 025). Workflow `client_ask` (`LEcfyzK2EHa8PIZ5`): `POST /webhook/client-ask {token, question}` (sin auth header — el token es el control). Carga contexto del proyecto (fase, briefing, design, costes, aftercare activo) y llama LLM con prompt blindado: solo responde sobre el proyecto, escala al arquitecto si requiere decisión profesional (cambios alcance/precio/normativa/calidades). Si escala: respuesta cordial al cliente + email automático a Damián con contexto. Anti-prompt-injection sin escalar. Coste ~$0.001/pregunta con gpt-4o-mini. `client_token_create` actualizado para aceptar el nuevo purpose. Documentado en `knowledge/agent_client_concierge.md`.
- **Pendiente (fase 2)**: portal HTML público (frontend) que sirva el chat en lugar de solo API; memoria conversacional multi-turn; feedback del cliente; rate limiting por token; multi-idioma; hook con aftercare si pregunta sobre incidencia post-entrega.

### 3.5 ~~Control financiero de obra~~ — ✅ MVP CONSTRUIDO (2026-04-25)
- **Construido (fase 1)**: tablas `invoices` + `certifications` (migración 012). 4 workflows: `agent_financial_tracker` (`LEspjLl6VEHPclPG`, OCR de facturas con Vision), `cron_financial_review` (`eg57HYIXCfcTbj7F`, lunes 08:00, email tabla coloreada con desviación crítica/desvío/OK), `certification_register` (`eJhIqyn6AxnNmpeS`, registra certificaciones parciales calculando importe desde cost_estimate × percentage), `certification_payment` (`UDrKZWsbKDPXVSBX`, suma pagos parciales y marca paid/partially_paid). Documentado en `knowledge/agent_financial_tracker.md`.
- **Pendiente (fase 2)**: aprobación de facturas por email con webhook_token (mismo patrón que `agent_briefing`); hook desde `agent_costs` que pre-genere plantilla de hitos de certificación; OCR de extractos bancarios para reconciliar pagos automáticamente; alerta separada cuando margen actual < 0.

### 3.6 ~~Postventa y garantías~~ — ✅ MVP CONSTRUIDO (2026-04-25)
- **Construido (fase 1)**: `aftercare_incidents` (30 cols) + `projects.handover_date` (migración 013). Workflows `aftercare_submit` (`GkcU8G1y3gFOeZp9`, Vision clasifica category/trade/severity/loe_period/under_warranty desde foto+texto), `aftercare_assign_resolve` (`xdkQuIdOwLZw68sK`, dos webhooks en uno), `cron_aftercare_review` (`hcXJyJB8hqevVxW2`, diario 09:30 con urgency_score). Documentado en `knowledge/agent_aftercare.md`.
- **Pendiente (fase 2)**: endpoint público para clientes (link mágico por proyecto sin API key); auto-asignación según mapa trade→contacto preferente; SLA breach detection con escalado; comparación visual evidencia inicial vs final con Vision.

### 3.7 ~~Plan de seguridad y salud~~ — ✅ CONSTRUIDO (2026-04-25)
**Movido a sección 1.2 como `agent_safety_plan` operativo.**

### 3.8 Control de calidad in-situ — `agent_qc_checklists`
- **Laguna real.** Las visitas de obra se basan en la memoria del técnico. Se olvidan comprobaciones (niveles, plomadas, pruebas de estanqueidad, replanteos) que se pagan caras si aparecen después.
- **Técnica.** Checklists generadas por fase del plan de obra: para cada fase activa, la app móvil muestra puntos de control específicos con campos de foto + pass/fail. Tabla `qc_checks` con evidencia. Integrable con `agent_site_monitor` para alimentar el análisis visual.
- **Función.** Convierte cada visita a obra en una inspección estructurada con trazabilidad.
- **Beneficio.** Menos vicios ocultos, defensa documentada ante reclamaciones, trazabilidad para el seguro de RC profesional.

### 3.9 ~~`agent_memory_v2`~~ — ✅ CONSTRUIDO (2026-04-25)
**Movido a sección 1.3 — pgvector + similarity search integrado en `agent_memory` (genera embedding al guardar case) y `agent_briefing` (busca casos similares al iniciar). Ver `knowledge/memoria/sistema_memoria_v2.md`.**

### 3.10 ~~Simulación energética y huella de carbono~~ — ✅ MVP CONSTRUIDO (2026-04-26)
- **Construido (fase 1)**: tabla `energy_assessments` (28 cols, jsonb breakdown CO2 + recomendaciones) en migración 021. Workflow `agent_energy_assessor` (`63XFqhlsg0d1cXav`) con prompt experto CTE DB-HE0/HE1 + Anejo B (zonas climáticas A3-E1). Endpoints: `POST /webhook/trigger-energy-assessor` + executeWorkflowTrigger. Calcula demanda kWh/m²·año (calefacción + refrigeración), transmitancia envolvente, emisiones CO2, calificación A-G, cumple_he0/he1 + recomendaciones priorizadas. Tabla embebida `CO2_FACTORS` por categoría material para huella embebida (kg CO2eq). Coste ~$0.01/eval con gpt-4o. Documentado en `knowledge/agent_energy_assessor.md`.
- **Pendiente (fase 2)**: hook con agent_design / agent_materials para auto-disparo cuando cambia diseño/materiales; comparativa antes/después entre versiones; export CE3X .ctex; mover CO2_FACTORS a tabla `co2_factors_db`; integración con LightRAG normativa CTE para citas exactas.

### 3.11 ~~`agent_accessibility`~~ — ✅ CONSTRUIDO (2026-04-25)
**Movido a sección 1.2.12 como agente operativo.**

### 3.12 Integración BIM profesional — `agent_bim_sync`
- **Laguna real.** Muchos estudios trabajan en Revit o ArchiCAD, no SketchUp. El modelo BIM contiene mucha información que ArquitAI podría aprovechar (y viceversa).
- **Técnica.** Integración IFC (estándar abierto) + específica Revit (vía Dynamo o addin con API REST). Sincroniza: carpintería → `material_items`, mediciones → `cost_estimates.breakdown`, fases de Revit → `project_plans.phases`.
- **Función.** Mantiene ArquitAI y el modelo BIM como gemelos digitales bidireccionales.
- **Beneficio.** Un cambio en el modelo BIM actualiza mediciones y presupuesto automáticamente. Fin de la dualidad "modelo de cálculo" vs "modelo de presupuesto".

### 3.13 ~~Firma electrónica y gestión de contratos~~ — ✅ MVP CONSTRUIDO (2026-04-26)
- **Construido (fase 1)**: tabla `contracts` (23 cols + touch trigger signed_at/sent_at) en migración 022. 9 plantillas inline embebidas: `encargo_profesional`, `contrato_cliente`, `contrato_gremio`, `acta_replanteo`, `acta_recepcion_provisional/definitiva`, `modificado_obra`, `renuncia_garantia`, `otros`. Workflow `agent_contracts` (`Abwnfh4BtHPU9lHg`): `POST /webhook/contract-generate` con `{project_id, contract_type, parties, scope, amount_eur, expires_days}` → genera Google Doc parametrizado + email a Damián para revisar. Workflow `contract_mark_signed` (`QK640K7iJ9dPJATR`): `POST /webhook/contract-signed` cierra ciclo de firma manual con timestamps automáticos. Documentado en `knowledge/agent_contracts.md`.
- **Pendiente (fase 2)**: integración DocuSign/FNMT/Autofirma (firma electrónica con hash); plantillas configurables en BD (`contract_templates`); generación PDF automática; `cron_contract_followup` con alertas de unsigned > 7d; hook agent_proposal aprobada → auto-genera encargo; hook qc_recepcion_provisional complete → auto-genera acta_recepcion_provisional.

### 3.14 Ciberseguridad y protección de datos
- **Laguna real.** Un estudio maneja datos personales de clientes + planos (propiedad intelectual) + precios de gremios (confidencial comercial). La protección suele ser "Drive con contraseña fuerte y ya".
- **Componentes:**
  - **GDPR compliance agent.** Inventario automático de datos personales en todas las tablas (`clients.*`, `briefings.client_needs`), registro de consentimiento, derecho al olvido ejecutable (anonimización por `client_id`).
  - **Control de acceso multi-rol.** Roles arquitecto / cliente / gremio / colaborador con RLS (Row-Level Security) en Supabase. Cada uno ve solo lo suyo.
  - **Cifrado en reposo** de campos sensibles (`clients.phone`, `trade_requests.prices` durante fase de decisión) con `pgp_sym_encrypt` de PostgreSQL.
  - **Auditoría de accesos.** Tabla `access_log` con quién leyó qué y cuándo. Alerta si alguien consulta N proyectos fuera de patrón.
  - **Backups automáticos.** Cron diario a S3 con retención 30 días + snapshot semanal con retención 1 año. Validación trimestral de restauración.
  - **Firmado de outbound emails.** DKIM + SPF + DMARC estrictos sobre el dominio del estudio para que gremios y clientes confíen en que los emails son legítimos.
  - **Secrets rotation.** Script mensual que rota `MCP_API_KEY` y revisa credenciales expiradas en n8n.
  - **Penetration test anual** sobre la instancia pública de n8n.
- **Beneficio.** Un incidente (filtración de datos de clientes, suplantación por email a un gremio para redirigir un pago, pérdida de proyecto por ransomware) puede cerrar un estudio. Protegerlo desde el diseño vale infinitamente menos que remediarlo.

### 3.15 ~~Detección de anomalías económicas~~ — ✅ MVP CONSTRUIDO (2026-04-25)
- **Construido (fase 1)**: tabla `anomalies_detected` con UNIQUE constraint para idempotencia (migración 015). Workflows `cron_anomaly_detect` (`RHrP8BowouYVCKjz`, diario 06:00) con 8 heurísticas SQL en CTEs encadenados (factura > 2× mediana del gremio, OCR low confidence, IVA inusual, presupuesto >40%, aftercare/permits stale, site_report regression, quote sin respuesta 14d) y `anomaly_review` (`lk6KnCGUdwWlKD7i`) para marcar reviewed/accepted/dismissed/escalated. Email diario con tabla coloreada por severity. Documentado en `knowledge/agent_anomaly_detector.md`.
- **Pendiente (fase 2)**: más heurísticas (SLA por gremio, gaps temporales, correlación cost/site_reports); calibración automática de umbrales según false-positive rate; LLM contextual para anomalías high/critical; auto-acción en algunas (re-enviar quote tras no-reply); dashboard.

### 3.16 ~~Domótica y smart home~~ — ✅ MVP CONSTRUIDO (2026-04-26)
- **Construido (fase 1)**: tabla `home_automation_proposals` (21 cols, jsonb devices + preinstall_requirements) en migración 024. Workflow `agent_home_automation` (`6f25BcR8LwNX2HQH`) con prompt experto en HA/KNX/Matter/Zigbee/wifi_mixed. Endpoints: `POST /webhook/trigger-home-automation` con `{project_id, level, ecosystem_pref}`. Niveles: básico/medio/avanzado/premium. Devuelve dispositivos por estancia + lista de preinstalación crítica EN OBRA + presupuesto desglosado (devices vs install). E2E: Madrid 72m² nivel medio → home_assistant, 1051€, 6 devices, 4 preinstall. Coste ~$0.01/eval. Documentado en `knowledge/agent_home_automation.md`.
- **Pendiente (fase 2)**: hook con agent_briefing (auto-disparo si menciona "smart"); hook con agent_costs (añadir partidas si accepted); catálogo BD de dispositivos (`home_automation_catalog`); plantilla de pliego firmable (Google Doc).

### 3.17 Realidad aumentada para cliente — `agent_ar_preview`
- **Laguna real.** El cliente aprueba opciones de diseño sobre planos 2D o renders estáticos — no entiende espacialmente hasta que ve la obra terminada, y a veces rechaza decisiones que ya están en ejecución.
- **Técnica.** Export del modelo de `agent_3d_design` a formato USDZ (iOS ARKit) / glTF (Android ARCore). App nativa o web con WebXR. El cliente apunta el móvil al espacio y ve la redistribución superpuesta.
- **Función.** Visualización espacial inmersiva de las opciones de diseño en el propio espacio real.
- **Beneficio.** Aprobaciones más firmes; menos cambios tardíos; percepción de estudio profesional y tecnológico.

### 3.18 ~~Patología y diagnóstico estructural con visión~~ — ✅ MVP CONSTRUIDO (2026-04-25)
- **Construido (fase 1)**: tabla `pathology_findings` (29 cols, 24 tipos de patología enumerados con foco España: aluminosis, humedad capilaridad/filtración/condensación, amianto/plomo/radón sospechosos, REBT pre-2002, etc.) en migración 014. Workflow `agent_pathology` (`I34LYGuiWTQ8WJCa`) con prompt experto en patología española. Inserta una fila por finding detectada, auto-email a Damián si severity high/critical o affects_safety. Documentado en `knowledge/agent_pathology.md` con queries útiles, hook con `agent_briefing` listo (no aplicado).
- **Pendiente (fase 2)**: hook con `agent_briefing` para que las patologías alimenten constraints automáticos (SQL listo en docs); hook con `agent_costs` para sumar `estimated_intervention_cost` como partida; `pathology_confirm/repair` workflows; cron review de findings sin actualizar > 30d; RAG semántico sobre catálogos técnicos de patología.

### 3.19 Interoperabilidad con software del sector — `util_interop`
- **BC3 export ✅ MVP CONSTRUIDO (2026-04-26)**: workflow `util_interop_bc3` (`WJUcvxmUQU0wR42l`). `POST /webhook/export-bc3` con `{project_id, version?}` → genera fichero `.bc3` formato FIEBDC-3/2007 (`~V`/`~C`/`~T`/`~D`) desde `cost_estimates.breakdown` y lo sube a Drive (carpeta presupuestos). Sanitiza delimitadores. Compatible con CYPE/Presto/TCQ. Documentado en `knowledge/util_interop_bc3.md`.
- **Pendiente (fase 2)**: import BC3 inverso (cambios en CYPE → refresca cost_estimates); soporte IFC para BIM; soporte GAEB internacional; descomposición auxiliar (mano de obra + materiales por partida); códigos jerárquicos (01.02.005); auto-export al cerrar `cost_estimates.status='approved'`.

### 3.20 ~~Coordinación con colaboradores externos~~ — ✅ MVP CONSTRUIDO (2026-04-26)
- **Construido (fase 1)**: tablas `collaborators` (catálogo: name, email, specialty, collegiate_no, hourly_rate_eur) + `collab_assignments` (project_id + collaborator_id + role + scope + deliverables + fee + deadline, ciclo invited→accepted→in_progress→delivered→approved→closed con timestamps automáticos por trigger). Migración 023. **3 workflows**: `collab_register` (`0FTkQZ7DmwUH7wif`, alta de colaborador), `collab_assign` (`8BFQs3rWSfWp7nTJ`, asigna entregable + email automático al colaborador con CC a Damián), `collab_update_status` (`1iZQkV6uzkRDqpfF`, actualiza status con notif a Damián con badge). Documentado en `knowledge/agent_collab_coordinator.md`.
- **Pendiente (fase 2)**: `cron_collab_review` (alertas deadline vencido o delivered>7d sin approved); RLS multi-tenant cuando sea multi-estudio; portal colaborador (link mágico para aceptar/rechazar/entregar sin email); hook agent_pathology → propone collab habitual de la especialidad; auto-invoice tras `approved`.

### 3.21 Compliance audit + certificate generator — ✅ MVP CONSTRUIDO (2026-04-26)
- **Construido (fase 1)**:
  - `agent_compliance_audit` (`RzLYzuMiDWBPpo6y`): `POST /webhook/audit-project {project_id, send_email?}` → JSON con scorecard (grade A-D, score /100) + issues por severidad. **21 checks** filtrados por fase: briefing, design, costs, materials, regulatory, permits, proposal, contratos (encargo/obra/replanteo/recepción), safety_plan, accessibility, energy, QC blocked, aftercare urgentes, pathology, GDPR consent + requests pendientes. Email opcional con tabla coloreada de issues + acciones recomendadas. E2E: proyecto en briefing_done → score 40 grade D, 2 critical (design, GDPR), 1 warning.
  - `agent_certificate_generator` (`OqOHU6Uc6FkVWPEu`): `POST /webhook/certificate-generate` → genera 7 tipos: CFO (Certificado Final de Obra LOE), certificado_habitabilidad (cédula autonómica), certificado_estructural (CTE DB-SE), certificado_instalacion_electrica (BIE/REBT), certificado_instalacion_termica (RITE), informe_idoneidad, otros. Migración 028 con tablas `certificates` y `certificate_templates`. Patrón idéntico a `agent_contracts`. Crea Google Doc + email a Damián.
  - `cron_qc_handover_to_acta` (`QNp8QK9x7XFehSs6`, diario 11:00): cuando QC `recepcion_provisional` cierra como `complete` y aún no hay contract `acta_recepcion_provisional` activo, email a Damián con tabla y comando curl pre-construido. Cierra el ciclo QC→acta→CFO.
- **Pendiente (fase 2)**: cron compliance_audit semanal por proyecto activo; calibración del scoring con feedback real; integración del scorecard en el dashboard JSON; hook compliance fail crítico → notificación inmediata.

---

## 4. Priorización sugerida

**Criterios:**
- **Impacto diario** en el trabajo del arquitecto (alto / medio / bajo).
- **Esfuerzo** de implementación (S / M / L / XL).
- **Dependencias** con otros bloques ya construidos.

| Orden | Bloque | Impacto | Esfuerzo | Justificación |
|---|---|---|---|---|
| 1 | Credencial LLM corregida + pipeline E2E con respuestas reales | Crítico | S | Sin esto el sistema funciona pero los outputs son fallbacks |
| 2 | 2.1 price_search + 2.2 price_references | Alto | M | Convierte las propuestas en algo comercialmente verificable |
| 3 | 3.14 Ciberseguridad (RLS + backups + audit log) | Alto | M | Precondición para pasar a multi-tenant y para confianza profesional |
| 4 | 3.7 agent_safety_plan | Alto | S | Ahorro de horas por proyecto, cumplimiento obligatorio |
| 5 | 3.3 agent_permit_tracker | Alto | M | Cuello de botella histórico del oficio |
| 6 | 2.5 Chat sidebar + directives | Alto | L | Activa el aprendizaje continuo entre proyectos |
| 7 | 3.1 agent_site_monitor | Alto | M | Cierra el loop plan → ejecución |
| 8 | 3.2 agent_trade_comms | Alto | M | Horas ahorradas por proyecto |
| 9 | 3.9 agent_memory_v2 | Medio | S | Explota los memory_cases que ya se están guardando |
| 10 | 2.3 LightRAG normativa | Medio | L | Mejora cualitativa sobre el fetch actual |
| 11 | 3.11 agent_accessibility | Medio | S | Bajo coste, alto valor legal |
| 12 | 3.5 agent_financial_tracker | Medio | M | Depende de flujo de certificaciones del estudio |
| 13 | 2.4 agent_3d_design | Alto | XL | Requiere MCP 3D + RAG espacial — bloque propio |
| 14 | 3.6 agent_aftercare | Medio | M | Valor tardío pero imprescindible en LOE |
| 15 | 3.13 agent_contracts + firma | Medio | M | Integración jurídica |
| 16 | 3.8 agent_qc_checklists | Medio | M | Necesita app móvil — depende de UI |
| 17 | 3.4 agent_client_concierge | Medio | L | Requiere portal web |
| 18 | 3.10 agent_energy_assessor | Medio | L | Vale la pena si el estudio hace muchos CEE |
| 19 | 3.19 util_interop (BC3 / IFC) | Alto | L | Multiplica adopción si se vende como SaaS |
| 20 | 3.12 agent_bim_sync | Alto | XL | Muy complejo, pero transformador |
| 21 | 3.16 agent_home_automation | Bajo-Medio | M | Nicho creciente |
| 22 | 3.18 agent_pathology | Medio | M | Depende de Claude Vision calidad |
| 23 | 3.15 agent_anomaly_detector | Bajo | S | Mejor cuando haya histórico suficiente |
| 24 | 3.20 agent_collab_coordinator | Bajo | M | Solo necesario en estudios con equipo |
| 25 | 3.17 AR preview | Bajo | XL | Nice-to-have tras 3D base |
| 26 | 2.6 Multi-tenant V2 | Estratégico | XL | Solo cuando haya producto probado con un estudio |

---

## 5. Reglas de evolución

1. **Ninguna nueva funcionalidad sin tabla ni sin update del schema.** El estado siempre en DB.
2. **Ningún agente nuevo sin `execution_id` + `exec_status` en su tabla de salida** (patrón Draft/Commit).
3. **Ningún agente nuevo sin `Write Intelligence`** — alimenta la memoria compartida entre agentes.
4. **Ninguna acción hacia terceros sin aprobación humana.** Ni emails a gremios, ni envíos al cliente, ni presentación de trámites.
5. **Ningún dato personal sin consentimiento registrado** (precondición 3.14 GDPR agent).
6. **Todo nodo Postgres con parámetros `$N`** lleva `options.queryReplacement` — nunca `additionalFields`.
7. **Todo IF node con typeVersion 2.2** usa `operation: "true"/"false"` con `singleValue: true`, nunca `operation: "equal"` con `rightValue: true`.
8. **Todo ExecuteWorkflow interno** usa `workflowInputs.mappingMode: "autoMapInputData"` — nunca `source: "parameter"` con solo `workflowId`.
9. **Toda normativa persistida** lleva `normativa_confidence`, `citation_source` y `normativa_fetched_at`.
10. **Todo cambio destructivo en DB** pasa por migración versionada. Nada de `DROP TABLE` en caliente.

---

## 6. Glosario de identificadores

- **Instancia n8n:** `https://n8n-n8n.zzeluw.easypanel.host`
- **Supabase:** Session Pooler puerto 5432 (no 6543 — fue bug bloqueante)
- **Webhook orchestrator:** `POST /webhook/orchestrator` con `{project_id, action: "advance"}`
- **Webhook presence:** `GET /webhook/architect-presence?status=online|offline`
- **Webhook aprobaciones:** URLs efímeras devueltas por `$resumeWebhookUrl` del Wait node (no rutas estáticas)
- **Credencial LLM:** `gE1jXO133xEHS5JJ` — `OPENAI-PRIMER-FLUJO-ARQUITECTO` (Header Auth)
- **Credencial Postgres:** `cfxNZdzy0NB3xkYC` — `Postgres account`
- **Credencial Gmail:** `cIma8ntTjZvIfU3H` — `damian2botella`

---

## 7. Cómo usar este documento

- **Para empezar cualquier conversación sobre ArquitAI:** leer sección 0 + el bloque relevante.
- **Para proponer una feature nueva:** añadirla a la sección 3 con las tres pautas (Técnica / Función / Beneficio) y asignarla una posición en la tabla de priorización.
- **Para marcar una feature como construida:** moverla de sección 3 a sección 1 y actualizar `memory/project_state.md`.
- **Para cualquier cambio de arquitectura de fondo:** actualizar la sección 5 (reglas de evolución).

Este archivo es la fuente de verdad sobre "qué es ArquitAI" y "hacia dónde va". Todo lo demás (CLAUDE.md, handoff_v2.md, project_state en memoria) es derivado.
