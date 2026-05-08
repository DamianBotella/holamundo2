# ArquitAI — Briefing técnico-estratégico para análisis de mercado

**Documento de contexto v1.0 — 2026-05-04**
**Destinatario:** instancia de Claude que ha investigado en profundidad el mercado de software para estudios de arquitectura técnica y reformas en España.
**Objetivo:** Que comprendas exactamente qué es ArquitAI hoy, qué queremos que sea, y dónde están las decisiones abiertas — para que tu investigación de mercado pueda contrastarse con decisiones de producto reales y no con suposiciones.

---

## 0. Una frase

ArquitAI es un sistema multiagente para estudios de arquitectura técnica que automatiza el flujo completo de un proyecto de reforma de vivienda — desde briefing del cliente hasta plan de obra y memoria reutilizable — con el arquitecto como **único decisor humano** en los nodos críticos (briefing, diseño, propuesta, gremios, ejecución).

No es un ERP, no es un CRM, no es un BIM y no es un marketplace. Es la **capa de orquestación inteligente** que conecta el oficio del arquitecto con su stack actual (Drive, Gmail, su software de modelado, sus gremios).

---

## 1. Quién está detrás

- **Damián Martínez** — arquitecto técnico, fundador y único usuario actual del MVP. Estudio en Madrid.
- **Stack mental:** trabaja con Drive + Gmail + WhatsApp para clientes y gremios. Su modelo 3D lo hace en SketchUp/Revit puntualmente. Su software estructural existente (CYPE, Presto) sigue siendo válido — ArquitAI **no lo sustituye, lo orquesta alrededor**.
- **Hipótesis de mercado:** un arquitecto técnico independiente o estudio pequeño (1-5 personas) en España gestionando 5-30 reformas/año, donde el cuello de botella es el **trabajo administrativo y de coordinación**, no el diseño en sí.

---

## 2. El problema concreto que ArquitAI resuelve

Un proyecto de reforma típico tiene ~12 fases secuenciales, cada una con outputs que alimentan a la siguiente:

```
intake → briefing → diseño → análisis normativo → materiales →
costes → gremios → propuesta → aprobación cliente →
plan de obra → ejecución → memoria reutilizable
```

En un estudio sin ArquitAI:

- **Briefing** vive en notas mentales + WhatsApp. El "scope creep" (cliente que cambia el alcance a mitad) no se detecta hasta que ya es tarde.
- **Normativa** se consulta a memoria humana o a versiones obsoletas de PDFs. **Hallucination de normativa por LLMs genéricos es uno de los gaps reales del sector**: ChatGPT inventa artículos del CTE.
- **Estimaciones de coste** se hacen con benchmarks personales del arquitecto — sin trazabilidad CYPE → riesgo "presupuesto servilleta".
- **Gremios** se contactan por WhatsApp. Re-cotizaciones, recordatorios, comparativas son trabajo manual repetitivo.
- **Propuestas comerciales** dependen de coherencia cruzada (briefing + diseño + costes + gremios) que se hace mentalmente — propuestas inconsistentes = renegociación.
- **Plan de obra** se hace en Excel/Project. No queda enlazado al diseño aprobado.
- **Postventa y LOE** (10 años de garantía decenal): incidencias del cliente, reparto de responsabilidades entre gremios. Suele vivir en email + WhatsApp sin trazabilidad.
- **Aprendizaje entre proyectos** = cero. Cada reforma es un proyecto en blanco.

ArquitAI ataca **toda esa capa de coordinación**, manteniendo al arquitecto como decisor pero quitándole el trabajo administrativo de rastrear, recordar y consolidar.

---

## 3. Estado actual — qué está construido y funcionando

### 3.1 Infraestructura

| Componente | Stack | Estado |
|---|---|---|
| **Orquestador** | n8n 2.12.x self-hosted en EasyPanel | ✅ Producción |
| **Base de datos** | Supabase / PostgreSQL 15+ | ✅ Producción, ~30 tablas |
| **LLM** | OpenAI GPT-4o (config para Anthropic Claude paralelo) | ✅ Producción |
| **Almacenamiento** | Google Drive + Docs + Sheets | ✅ Producción |
| **Email** | Gmail OAuth2 | ✅ Producción |
| **Auth** | Supabase Auth con JWT custom claims (tenant_id, role, full_name) | ✅ Producción (X4 cerrado 2026-05-04) |
| **API REST** | n8n webhooks `/api/v1/*` con verificación JWT | ✅ Producción (X5 cerrado 2026-05-04) |
| **Multi-tenant** | RLS (Row-Level Security) en Postgres por `tenant_id` | ✅ Producción (X3 cerrado 2026-05-03) |
| **UI** | React 19 + Vite 5 + TS + Tailwind ("Foxhole") | ⏳ Scaffolding listo, conexión al backend en progreso |

### 3.2 Agentes en producción (13)

Todos como workflows de n8n. Cada uno con:
- Patrón **Draft/Commit** (`execution_id` + `exec_status`) para no dejar estado inconsistente.
- **Write Intelligence** a `project_intelligence` para que otros agentes consulten.
- Webhook de aprobación del arquitecto cuando aplica.

| # | Agente | Función | Bloqueante |
|---|---|---|---|
| 1 | `agent_briefing` | Texto libre → briefing estructurado. Detecta scope creep con hash djb2. | ✅ Wait |
| 2 | `agent_design` | Genera 2-3 opciones de redistribución con compatibilidades reales. | ✅ Wait |
| 3 | `agent_regulatory` | Lista trámites + entidad + plazo + coste por opción aprobada, con `normativa_confidence` + `citation_source` (anti-hallucination). | — |
| 4 | `agent_materials` | Materiales por categoría con prioridad: catálogo del arquitecto > web. | — |
| 5 | `agent_documents` | Determinista (sin LLM). Estructura Drive + Google Docs templates. | — |
| 6 | `agent_costs` | Desglose económico por partidas + comparativa contra `budget_target`. | — |
| 7 | `agent_trades` | Prepara encargos por especialidad (sin enviar nada). | — |
| 8 | `agent_proposal` | Preflight 4 prerequisitos + propuesta comercial consolidada. | ✅ Wait |
| 9 | `agent_planner` | Plan de obra con dependencias + camino crítico + milestones. | — |
| 10 | `agent_memory` | Destila proyecto cerrado en `memory_cases` reutilizables (pgvector). | — |
| 11 | `agent_safety_plan` | EBSS/PSS conforme RD 1627/1997 con riesgos por fase y EPIs por gremio. | — |
| 12 | `agent_accessibility` | Auditor DB-SUA 9 + Orden VIV/561/2010 con argumentación comercial. | — |
| 13 | `agent_normativa_refresh` | Cron que detecta cambios en CTE/PGOU/ordenanzas con hash de contenido. | — |

### 3.3 Agentes auxiliares (oportunidades del oficio cubiertas, todos MVP construidos)

Estos cubren **lagunas reales del oficio** detectadas durante el desarrollo:

| Agente | Cubre |
|---|---|
| `agent_site_monitor` | Seguimiento de obra con Vision sobre fotos/videos del jefe de obra. Detecta fase real, % progreso, deviations vs plan. |
| `agent_trade_comms` | Cotizaciones a gremios por email con webhook_token. El gremio responde via formulario sin login. |
| `agent_permit_tracker` | Tracking de licencias municipales con cron diario y alertas. |
| `agent_client_concierge` | Chatbot dedicado al cliente con escalado al arquitecto (anti-prompt-injection). |
| `agent_financial_tracker` | OCR Vision sobre facturas + certificaciones. Aprobación con webhook. |
| `agent_aftercare` | Gestión de incidencias post-entrega con Vision (categoría, gremio, severidad, periodo LOE). |
| `agent_qc_checklists` | Checklists de calidad por fase con form HTML móvil-first para visita a obra. |
| `agent_energy_assessor` | Demanda kWh/m²·año + emisiones CO2 + calificación A-G (CTE DB-HE0/HE1). |
| `agent_contracts` | Generación parametrizada de 9 tipos de contrato (encargo, obra, gremio, actas, modificados...). |
| `agent_anomaly_detector` | 8 heurísticas SQL para detectar anomalías económicas (factura > 2× mediana del gremio, etc.). |
| `agent_home_automation` | Propuesta domótica con preinstalación crítica EN OBRA (KNX/Matter/Zigbee). |
| `agent_pathology` | Vision sobre fotos del inmueble pre-reforma. Detecta 24 patologías típicas (aluminosis, humedades, amianto sospechoso, REBT pre-2002). |
| `util_interop_bc3` | Export FIEBDC-3/2007 (.bc3) compatible con CYPE/Presto/TCQ. |
| `agent_collab_coordinator` | Coordinación de colaboradores externos (calculistas, decoradores). |
| `agent_compliance_audit` | Scorecard A-D con 21 checks por fase del proyecto. Cron semanal + dashboard HTML. |
| `agent_certificate_generator` | 7 tipos: CFO, habitabilidad, estructural, BIE/REBT, RITE, idoneidad. |

### 3.4 Modelo de datos

~30 tablas en Postgres. Núcleo:

- **Estado del proyecto:** `projects` (con `current_phase` que gobierna el orquestador), `clients`, `briefings`, `design_options`, `regulatory_tasks`, `cost_estimates`, `proposals`, `project_plans`, `memory_cases`.
- **Operativo:** `agent_executions`, `agent_prompts`, `project_intelligence`, `activity_log`, `consultation_queue`, `architect_status`.
- **Specialized:** `safety_plans`, `accessibility_audits`, `site_reports`, `trade_quotes`, `permit_applications`, `invoices`, `certifications`, `aftercare_incidents`, `qc_checks`, `energy_assessments`, `contracts`, `anomalies_detected`, `home_automation_proposals`, `pathology_findings`, `collaborators`, `collab_assignments`, `client_conversations`.
- **Multi-tenant:** `tenants`, `user_profiles`, `client_access_tokens`, `system_config` (con `tenant_id` en TODAS las tablas + RLS policies).
- **Memoria semántica:** `memory_cases` con embeddings pgvector 1536-dim (text-embedding-3-small).

### 3.5 Lo recién terminado (X1–X5, marzo–mayo 2026)

| Hito | Qué cierra | Estado |
|---|---|---|
| **X1** | Multi-tenant schema (tenant_id en todas las tablas) | ✅ |
| **X2** | Onboarding de tenants nuevos (seeding de gremios, prompts, prices) | ✅ |
| **X3** | RLS Postgres + bypass `super_admin` para crones | ✅ (47 crones blindados) |
| **X4** | Supabase Auth con JWT custom claims (Auth Hook → tenant_id, role, full_name) | ✅ |
| **X5** | API REST `/api/v1/*` (6 endpoints: me, projects, project-detail, project-timeline, alerts/global, metrics/dashboard) verificada E2E con JWT real, 6/6 OK | ✅ (2026-05-04) |
| **X6** | UI Foxhole conectada al backend real (sin mock) | ⏳ En progreso |

**Bug relevante encontrado en X5** y workaround:
- n8n self-hosted (instancia EasyPanel) **no registra correctamente webhooks con `:id` en path** (devuelve 404 incluso con workflow activo). Tras descartar conflicto de prefix y probar paths completamente distintos, se decidió usar query string `?id=<UUID>` en `project-detail` y `project-timeline`. Documentado en memoria del proyecto para futuras decisiones de routing.

---

## 4. Principios inmutables (reglas del producto que NO cambiamos)

1. **Ningún agente contacta con terceros sin aprobación humana explícita.** Ni emails a gremios, ni envíos al cliente, ni presentación de trámites a sede electrónica. Todo lo que sale del estudio pasa por un Wait node con webhook de aprobación.
2. **La decisión técnica, normativa, legal y económica final es siempre del arquitecto.** El sistema propone, el arquitecto valida.
3. **El estado del proyecto vive en `projects.current_phase` en Supabase. n8n es stateless.** Cualquier sesión recupera el proyecto desde la BD. No hay estado oculto.
4. **Un solo agente por oficio.** Hay UN agente para todos los gremios (albañilería, fontanería, electricidad...), no micro-agentes por gremio. Mismo principio para licencias, materiales, etc.
5. **Toda normativa persistida** lleva `normativa_confidence` + `citation_source` + `normativa_fetched_at`. No hay normativa "huérfana" sin trazabilidad.
6. **Todo cambio destructivo en BD** pasa por migración versionada. Nada de `DROP TABLE` en caliente.
7. **Patrón Draft/Commit** en todos los agentes con tabla de salida — un fallo parcial nunca deja estado inconsistente.

---

## 5. Decisiones arquitectónicas explícitas (contraste con alternativas)

| Decisión tomada | Alternativa rechazada | Razón |
|---|---|---|
| n8n como orquestador | Servicio backend custom (FastAPI/Express) | Velocidad de iteración, visibilidad gráfica del flujo, integraciones built-in (Drive/Gmail/OAuth) |
| Supabase + RLS | Backend custom con auth propia | Auth + DB + RLS + storage en una sola capa; multi-tenant casi gratis |
| GPT-4o (vía OpenAI API) | Anthropic Claude exclusivo | Coste/tokens más bajo en el MVP. `util_llm_call` ya está preparado para rutear entre proveedores. Plan: medir calidad con Claude en agentes críticos (briefing, regulatory, proposal). |
| Path REST con `?id=` en lugar de `/:id` | URLs REST canónicas | Bug confirmado de n8n self-hosted. Workaround pragmático para no bloquear UI. Migrable a `/:id` si se cambia la infra. |
| Decode JWT inline > sub-workflow `util_jwt_verify` | Validación de firma con Supabase /auth/v1/user | El sub-workflow tenía bugs en producción. La firma se valida indirectamente vía RLS Postgres usando `tenant_id` del JWT. |
| Estado en `projects.current_phase` | Estado distribuido entre agentes | Un único punto de verdad; n8n stateless permite restart sin pérdida. |
| Memoria semántica con pgvector | Pinecone / Weaviate | No queremos dependencia externa adicional. pgvector es suficiente para escala MVP. |

---

## 6. Lo que tenemos en roadmap pero NO construido

| # | Bloque | Estimación | Por qué importa |
|---|---|---|---|
| 1 | **Chat sidebar + directives system** | L | Activa el "aprendizaje continuo" — el arquitecto define reglas reutilizables ("siempre granito en encimera", "evitar PVC en exterior") y los agentes las consultan. |
| 2 | **`agent_3d_design`** | XL | Razonamiento espacial conectado a SketchUp/Blender vía MCP. Genera modelo 3D inicial coherente con briefing + normativa. |
| 3 | **LightRAG normativa** | L | Reemplaza `util_normativa_fetch` (fetch-cada-vez) por recuperación semántica real con grafos de conocimiento. |
| 4 | **`util_interop` IFC** | L | BC3 ya existe. Falta IFC para BIM bidireccional. |
| 5 | **`agent_bim_sync`** | XL | Sincronización Revit ↔ ArquitAI como gemelos digitales. |
| 6 | **AR preview cliente** | XL | Visualización inmersiva de opciones de diseño. Depende de `agent_3d_design`. |
| 7 | **Cibersec Bloque 2** | M | Backups automáticos + audit log + secrets rotation. (Bloque 1 — RLS + GDPR — ya construido.) |

---

## 7. Mercado y posicionamiento (donde tu investigación nos va a ser útil)

ArquitAI compite (o complementa) con:

### 7.1 Software estructural existente
- **CYPE / Presto / TCQ** — generan mediciones, presupuestos y exports BC3. ArquitAI consume sus outputs (vía BC3 import futuro) pero NO los reemplaza.
- **Revit / ArchiCAD / SketchUp** — modelado BIM. ArquitAI los orquesta (`agent_3d_design` futuro), no los sustituye.

### 7.2 Gestión de proyectos y obra
- **Procore, BuildPass, Autodesk Construction Cloud** — orientados a constructoras grandes. Damián los considera **demasiado pesados para el estudio pequeño/mediano**. ArquitAI quiere ser "Procore para microestudios": potente pero sin la curva de adopción.
- **Bitrix24, monday.com, ClickUp** — herramientas genéricas adaptadas. Carecen de inteligencia de dominio (CTE, LOE, partidas CYPE).

### 7.3 Específicos del sector español
- **Software de despacho de arquitectura** (Tucan, ArchiOffice, etc.) — orientados a contabilidad y facturación, no a ejecución de proyecto.
- **PrestoSoft, Arquímedes** — facturación + presupuestos. Sin agentes ni memoria.

### 7.4 ChatGPT / Claude / IA genérica
- El arquitecto promedio ya usa ChatGPT para redactar emails, resumir normativa, generar pliegos. Pero:
  - Hallucination de normativa.
  - Sin memoria entre conversaciones.
  - Sin trazabilidad ni Draft/Commit.
  - Sin integración con Drive/Gmail/Postgres.

**Hipótesis ArquitAI:** la diferenciación no está en "tener un agente más listo", sino en **el sistema completo**: orquestación + estado consistente + integraciones + memoria entre proyectos + cumplimiento normativo verificable.

### 7.5 Preguntas abiertas para tu análisis de mercado

Estas son las preguntas en las que tu investigación de mercado nos puede aportar:

1. **TAM/SAM/SOM España.** Cuántos arquitectos técnicos colegiados gestionan reformas de vivienda. Cuántos tienen estudio propio (vs colegiado en grandes empresas). Cuántos podrían pagar 50–500€/mes por una herramienta como ArquitAI.
2. **Competidores reales en España.** ¿Hay productos similares que estamos pasando por alto? ¿Alguien está construyendo "Procore para microestudios" en clave europea/española?
3. **Pricing benchmark.** ¿Qué pagan los estudios pequeños hoy por software (CYPE Suite, Bitrix, ChatGPT Plus, Microsoft 365)? Cuál es el techo razonable.
4. **Canales de adquisición.** ¿Por dónde llegan estos arquitectos a software nuevo? Colegio profesional, ferias, LinkedIn, recomendación entre estudios, partner técnico.
5. **Riesgos regulatorios.** ¿Hay limitaciones legales para que un sistema automatizado emita documentos firmables (CFO, habitabilidad)? ¿Cómo se distingue "asistente del arquitecto" vs "ejercicio profesional automatizado"?
6. **Ecosistema CCAA.** Cada CCAA tiene normativa autonómica + ordenanzas municipales. ¿Es escalable el modelo de carga manual o necesitamos partner por CCAA?
7. **Competencia AI-native.** ¿Hay startups americanas/europeas (Series A) que estén construyendo agentes para construcción que vayan a entrar en España?
8. **Posicionamiento.** "Multi-agente para arquitectos técnicos especializados en reforma residencial" es muy específico. ¿Es el nicho correcto para empezar, o conviene posicionar más amplio (toda la edificación residencial)?
9. **Adoption barriers.** ¿Cuál es la fricción real para un arquitecto de 50 años acostumbrado a CYPE + Excel + Drive? Más allá de la curva de aprendizaje, ¿qué bloquearía una migración?
10. **Partner strategy.** ¿Tendría sentido alianza con CYPE Ingenieros, Colegio de Arquitectos Técnicos, o algún proveedor del sector?

---

## 8. Cómo dialogar con nosotros sobre el producto

- **Sé concreto en tus recomendaciones.** "Construir feature X" mejor que "deberíais explorar el área Y".
- **Conecta con los principios inmutables (sec 4).** Si una recomendación los contradice, dilo explícitamente — quizá tengamos que revisarlos, pero no a ciegas.
- **Distingue:** (a) lo que hoy es MVP y necesita pulido vs (b) features ausentes vs (c) decisiones estratégicas a tomar.
- **Si encuentras competidores, dame:** nombre, web, modelo de negocio aproximado, qué hacen mejor que nosotros, qué hacen peor.
- **Si propones cambios de posicionamiento:** indica qué público se gana y qué público se pierde.
- **No me digas que pivote sin razones cuantitativas.** Damián lleva trabajando ArquitAI ~6 meses. Pivotar es caro.

El documento maestro técnico está en `studio-multiagente/ArquitAI.md` (395 líneas). Si necesitas profundidad técnica de cualquier sección, está ahí. Este briefing es el resumen ejecutivo para alinear contexto antes del diálogo estratégico.

---

## 9. Apéndice — identificadores y URLs

- **Instancia n8n:** `https://n8n-n8n.zzeluw.easypanel.host`
- **API base actual:** `https://n8n-n8n.zzeluw.easypanel.host/webhook/api/v1`
- **Supabase project:** `xfeatkzordgnztigplwd.supabase.co`
- **Tenant principal (single tenant MVP):** `Estudio Damian Martinez` (`bbf3f07e-206c-4a4a-affe-592ae3d6c4c9`)
- **Total workflows en producción:** 70+ (agentes + utils + crones + APIs)
- **Total tablas activas:** ~30 con RLS aplicada
- **Total migraciones SQL aplicadas:** 50+ (la última: `052_api_views.sql` que crea las 7 views consumidas por la API REST)

---

**Fin del briefing.** Si necesitas ampliación de cualquier sección, ArquitAI.md (raíz del repo) es la fuente canónica completa.
