# BLOQUE 5 — Plan de Construcción por Fases

## Sistema Multiagente para Estudio de Arquitectura Técnica y Reformas

**Referencia**: Bloques 1-4 completados (arquitectura, modelo de datos, 17 workflows, prompts)

---

## 0. CRITERIOS DE PRIORIZACIÓN

Cada decisión de "qué va en MVP" vs "qué va después" se basa en estos criterios:

1. **¿Aporta valor operativo inmediato?** El arquitecto ahorra tiempo o errores desde el día 1.
2. **¿Es necesario para que el siguiente paso funcione?** Dependencia técnica.
3. **¿Se puede hacer manualmente mientras tanto?** Si sí, puede esperar.
4. **¿Cuánto esfuerzo cuesta?** Relación valor/esfuerzo.
5. **¿Introduce riesgo técnico alto?** Si sí, mejor probarlo aislado primero.

---

## FASE 1: MVP — "El Motor Operativo"

### Objetivo
Un sistema funcional que tome un proyecto ya captado y lo lleve desde la información inicial hasta una propuesta comercial lista para revisar, pasando por briefing, opciones de distribución, detección de normativa, materiales, costes y oficios. El arquitecto interactúa mediante emails de aprobación y formularios del Wait node. No hay interfaz visual propia.

### Duración estimada: 6-8 semanas

### Criterio de "MVP listo"
El sistema puede procesar un proyecto real de principio a fin con intervención humana solo en los puntos de aprobación definidos. El arquitecto recibe emails, aprueba/rechaza, y el sistema avanza.

---

### SEMANA 1: Infraestructura base

#### Qué construir

| Componente | Detalle | Esfuerzo |
|---|---|---|
| Supabase: crear proyecto | Instancia PostgreSQL, configurar acceso | 1h |
| Ejecutar `mvp_schema.sql` | Las 16 tablas con índices y triggers | 30min |
| Cargar prompts iniciales | Insertar en `agent_prompts` los 10 system prompts | 1h |
| n8n: instalar self-hosted | Docker Compose con PostgreSQL como BD de n8n | 2-3h |
| n8n: configurar dominio + HTTPS | Necesario para que los webhooks y Wait nodes funcionen | 2-3h |
| n8n: crear credenciales | Postgres (Supabase), Gmail, Google Drive, LLM API (Header Auth) | 1h |
| Google Drive: crear carpeta raíz | `/proyectos/` como raíz del sistema | 15min |
| Workflow: `error_handler` | Captura errores globales desde el día 1 | 1-2h |

#### Riesgos de esta semana

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Dominio/HTTPS mal configurado | Media | Alto (webhooks y Wait no funcionan sin HTTPS) | Usar Cloudflare Tunnel como alternativa rápida si el DNS tarda |
| Credencial del LLM rechazada | Baja | Medio | Probar con una llamada manual desde HTTP Request antes de seguir |
| Supabase free tier pausado por inactividad | Media | Bajo (solo en las primeras semanas) | Hacer al menos un query cada 5 días, o pasar a Pro ($25/mes) desde el inicio |

#### Dependencias
- Cuenta de Supabase creada
- Dominio con DNS apuntando al servidor de n8n (o Cloudflare Tunnel)
- API key del LLM (Anthropic o OpenAI)
- Cuenta de Gmail para notificaciones (o dominio propio con SMTP)
- Cuenta de Google con Google Drive API habilitada

#### Entregable
Infraestructura funcionando: n8n accesible por HTTPS, conectado a Supabase y Google Drive, con credenciales configuradas y error_handler activo.

---

### SEMANA 2: Workflows auxiliares + primer agente

#### Qué construir

| Componente | Detalle | Esfuerzo |
|---|---|---|
| Workflow: `util_llm_call` | Wrapper centralizado para llamadas LLM con retry y logging | 3-4h |
| Workflow: `util_notification` | Envío de emails de notificación y aprobación | 2-3h |
| Workflow: `util_file_organizer` | Crear estructura de carpetas en Drive | 2-3h |
| Workflow: `init_new_project` | Punto de entrada: crear proyecto en BD + Drive + disparar orquestador | 3-4h |
| Workflow: `agent_briefing` | Primer agente completo con LLM + aprobación + Wait | 4-6h |
| Workflow: `main_orchestrator` (v1) | Versión mínima: solo maneja fase intake → briefing_done | 3-4h |
| **Publicar** todos los workflows | Draft → test → Publish | 1-2h |

#### Cómo testear
1. Llamar al webhook de `init_new_project` con datos de un proyecto real (o simulado).
2. Verificar que se crea el registro en `projects` y `clients`.
3. Verificar que se crea la carpeta en Google Drive.
4. Verificar que el orquestador dispara `agent_briefing`.
5. Verificar que el LLM genera un briefing JSON válido.
6. Verificar que se recibe el email de aprobación.
7. Aprobar vía el formulario del Wait node.
8. Verificar que `briefings.status` pasa a `approved` y `projects.current_phase` pasa a `briefing_done`.
9. Verificar que `activity_log` tiene todos los registros.

#### Riesgos de esta semana

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| LLM no devuelve JSON válido | Alta (primera iteración) | Medio | Iterar prompt. Añadir retry con instrucción reforzada. Probar con 3-5 proyectos reales |
| Wait node no despierta tras aprobación | Media | Alto | Verificar que WEBHOOK_URL está bien configurado en n8n. Sub-workflows deben estar Published |
| Gmail bloquea envíos | Baja | Medio | Usar cuenta con App Password. Si persiste, usar SMTP externo (Resend, SendGrid) |
| Datos de prueba insuficientes | Media | Bajo | Preparar 3 proyectos simulados con datos realistas ANTES de empezar |

#### Entregable
Flujo completo: crear proyecto → generar briefing → recibir email → aprobar → fase avanza. El primer ciclo del sistema funciona de extremo a extremo.

---

### SEMANA 3: Diseño + normativa + materiales + documental

#### Qué construir

| Componente | Detalle | Esfuerzo |
|---|---|---|
| Workflow: `agent_design` | Opciones de redistribución con selección por formulario | 4-6h |
| Workflow: `agent_regulatory` | Detección de trámites con aprobación condicional | 4-5h |
| Workflow: `agent_materials` | Búsqueda de materiales y precios | 3-4h |
| Workflow: `agent_documents` | Clasificación documental (sin LLM, reglas) | 2-3h |
| Ampliar `main_orchestrator` | Añadir ramas para briefing_done → design_done → analysis_done | 2-3h |
| **Publicar** todo | Test + Publish | 1-2h |

#### Cómo testear
1. Con el proyecto de la semana anterior (ya en fase briefing_done), disparar el orquestador.
2. Verificar que `agent_design` genera 2-3 opciones.
3. Seleccionar una opción via el formulario.
4. Verificar que `agent_regulatory` detecta trámites coherentes con la localización y tipo de obra.
5. Verificar que `agent_materials` genera materiales con precios y alternativas.
6. Verificar transiciones de fase en `projects`.

#### Riesgos de esta semana

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| agent_design genera opciones demasiado similares | Media | Medio | Iterar prompt. Reforzar instrucción de diferenciación. Probar con Claude Opus si Sonnet no da suficiente variedad |
| agent_regulatory inventa normativa | Alta | Alto | El prompt ya tiene múltiples capas de cautela. Revisar SIEMPRE manualmente las primeras 5-10 ejecuciones. Nunca confiar sin verificación humana |
| agent_materials con precios muy alejados del mercado | Media | Medio | Comparar output con precios reales de 2-3 proveedores conocidos. Ajustar prompt si la desviación es > 30% |
| Google Drive API rate limits | Baja | Bajo | agent_documents solo lista y registra; no hace operaciones masivas |

#### Entregable
Flujo: briefing aprobado → opciones de diseño → selección → normativa detectada → materiales sugeridos. El proyecto llega a fase `analysis_done`.

---

### SEMANA 4: Costes + oficios + propuesta

#### Qué construir

| Componente | Detalle | Esfuerzo |
|---|---|---|
| Workflow: `agent_costs` | Estimación económica con desglose y escenarios | 4-6h |
| Workflow: `agent_trades` (modo prepare) | Detección de oficios + paquetes de consulta | 4-6h |
| Workflow: `agent_proposal` | Propuesta comercial con doble aprobación | 5-7h |
| Ampliar `main_orchestrator` | Ramas analysis_done → costs_done → trades_done → proposal_done | 2-3h |
| **Publicar** todo | Test + Publish | 1-2h |

#### Cómo testear
1. Continuar con el proyecto de prueba desde `analysis_done`.
2. Verificar que `agent_costs` genera desglose cuyo total cuadra con la suma de partidas.
3. Verificar que `agent_costs` detecta correctamente si hay sobrecoste vs. presupuesto objetivo.
4. Verificar que `agent_trades` genera paquetes de consulta coherentes con las partidas del presupuesto.
5. Aprobar el envío de solicitudes a oficios (sin enviar realmente — solo verificar el flujo de aprobación).
6. Verificar que `agent_proposal` genera una propuesta completa cuyo total coincide con el cost_estimate.
7. Verificar la doble aprobación: review interno → confirmación de envío.

#### Riesgos de esta semana

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| agent_costs suma mal las partidas | Media | Alto (el precio que ve el cliente sería incorrecto) | Code node SIEMPRE recalcula y corrige. Nunca fiar el total al LLM |
| agent_proposal genera total distinto al cost_estimate | Media | Alto | Code node fuerza el total del cost_estimate. El LLM solo redacta, no decide el precio |
| Doble Wait en agent_proposal (review + send) | Media | Medio (complejidad) | Testear exhaustivamente. Si da problemas, separar en dos sub-workflows |
| agent_trades genera demasiados oficios | Baja | Bajo | Comparar con partidas del cost_estimate. Si hay oficios sin partida, descartar |

#### Entregable
Flujo completo hasta propuesta: costes estimados → oficios preparados → propuesta comercial lista para enviar al cliente. El proyecto llega a fase `proposal_done`.

---

### SEMANA 5: Planificación + memoria + cierre + cron

#### Qué construir

| Componente | Detalle | Esfuerzo |
|---|---|---|
| Workflow: `agent_planner` | Plan operativo con fases y cronograma | 3-4h |
| Workflow: `agent_memory` | Cierre y escritura en memoria del estudio | 3-4h |
| Workflow: `agent_trades` (modo compare) | Comparativa de presupuestos recibidos | 3-4h |
| Workflow: `cron_project_review` | Revisión periódica de proyectos activos | 2-3h |
| Completar `main_orchestrator` | Todas las fases restantes: approved → planning_done → completed | 2-3h |
| Flujo manual de "cliente acepta" | Webhook en orquestador para marcar proposal_done → approved | 1h |
| **Publicar** todo y test end-to-end | Proyecto completo de inicio a fin | 3-4h |

#### Test end-to-end (CRÍTICO)
Ejecutar un proyecto simulado de principio a fin:
1. `init_new_project` → crea proyecto
2. `agent_briefing` → genera briefing → aprobar
3. `agent_design` → genera opciones → seleccionar una
4. `agent_regulatory` → detecta trámites
5. `agent_materials` → sugiere materiales
6. `agent_costs` → estima costes
7. `agent_trades` → prepara paquetes → aprobar envío
8. `agent_proposal` → genera propuesta → aprobar → enviar
9. Marcar "cliente acepta" manualmente
10. `agent_planner` → genera plan
11. `agent_memory` → cierra y guarda en memoria
12. Proyecto pasa a `completed`

Verificar en cada paso: `activity_log` completo, `approvals` con trazabilidad, `projects.current_phase` correcto.

#### Riesgos de esta semana

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El flujo completo tarda demasiado por los Wait nodes | Media | Bajo (es esperado) | Para testing, usar timeouts cortos (5 min) en los Wait. En producción, 72h |
| agent_memory genera lecciones genéricas | Media | Bajo (se mejora iterando) | Revisar las primeras 3-5 memorias y ajustar prompt |
| cron_project_review genera demasiadas alertas | Baja | Bajo | Ajustar umbrales (inactividad > 5 días, no > 1 día) |

#### Entregable
**MVP COMPLETO**. El sistema procesa un proyecto de inicio a fin. Todos los 17 workflows funcionan. El arquitecto recibe emails, aprueba, y el proyecto avanza por todas las fases hasta cierre y memoria.

---

### SEMANA 6 (buffer): Estabilización y primeros proyectos reales

#### Qué hacer

| Tarea | Detalle |
|---|---|
| Ejecutar 2-3 proyectos reales | Con proyectos en curso o recientes del estudio |
| Iterar prompts | Ajustar según la calidad de outputs reales |
| Corregir bugs | Los habrá. Especialmente en parsing de JSON y transiciones de fase |
| Documentar workarounds | Lo que no funciona bien, cómo se soluciona manualmente |
| Backup de workflows | Exportar JSON de todos los workflows como backup |
| Medir tiempos | Cuánto tarda cada agente, cuánto cuesta en LLM por proyecto |
| Recoger feedback del arquitecto | ¿Qué es útil? ¿Qué sobra? ¿Qué falta? |

---

### QUÉ QUEDA FUERA DEL MVP (deliberadamente)

| Funcionalidad | Por qué no está en MVP | Cuándo entra |
|---|---|---|
| Ejecución paralela de normativa + materiales | Añade complejidad de Merge node; el beneficio es menor en MVP | V2 |
| Envío automático de emails/WhatsApp a oficios | Riesgo alto sin supervisión; en MVP el envío es manual | V2 |
| Interfaz web propia (panel de control) | El MVP funciona con emails + formularios Wait. Suficiente para validar | V2 |
| Búsqueda semántica en memoria (embeddings) | Requiere pgvector + pipeline de embeddings. La búsqueda por tags es suficiente | V2 |
| Clasificación documental con LLM | Reglas simples son suficientes para el MVP | V2 |
| Entrada de presupuestos de oficios en el sistema | En MVP se registran manualmente en Supabase. Automatizable después | V2 |
| Generación de documentos PDF/DOCX de propuesta | El agente genera JSON. El formato final se hace manualmente o con template | V2 |
| Multi-usuario / roles | En MVP hay un solo usuario (el arquitecto). Roles en V3 | V3 |
| Interfaz pixel/Habbo gamificada | Idea de producto futuro, NO prioridad técnica | V3+ |
| CRM de captación | Fuera del scope completamente. Los clientes ya están captados | Nunca (scope diferente) |
| Integración con software de planos (AutoCAD, etc.) | Complejidad altísima, valor incierto | V3+ (evaluar) |

---

## FASE 2: V2 — "El Estudio Conectado"

### Objetivo
Automatizar las interacciones externas supervisadas (email a oficios, entrada de presupuestos), añadir una interfaz web mínima para el arquitecto, implementar búsqueda semántica en memoria, y mejorar la calidad de outputs con datos reales acumulados.

### Duración estimada: 6-8 semanas (post-MVP estabilizado)

### Prerrequisito
MVP funcionando con al menos 5 proyectos procesados. Feedback del arquitecto recogido. Prompts estabilizados.

---

### V2.1: Comunicación externa supervisada (semanas 1-2)

#### Qué construir

| Componente | Detalle |
|---|---|
| Envío de email a oficios (tras aprobación) | Nodo Gmail dentro de `agent_trades`. Tras aprobación, el sistema envía los draft_messages por email automáticamente. El arquitecto ya aprobó el contenido. |
| Recepción de presupuestos por email | Nuevo workflow `inbound_quote_processor`: Gmail Trigger que detecta respuestas de oficios, extrae datos, y los registra en `external_quotes`. Usa LLM para parsear presupuestos no estructurados. |
| WhatsApp Business API (opcional) | Alternativa al email para oficios que prefieren WhatsApp. HTTP Request a la API de WhatsApp Business. Requiere cuenta verificada. |
| Webhook para entrada manual de quotes | Formulario web simple (Wait node con Form) para que el arquitecto registre presupuestos recibidos por teléfono o en persona. |

#### Riesgos V2.1

| Riesgo | Mitigación |
|---|---|
| Email enviado a oficio incorrecto | El sistema solo envía tras aprobación explícita con preview del mensaje completo |
| Respuesta de oficio no parseable | LLM parsea lo que puede; lo que no, se marca como "requiere entrada manual" |
| WhatsApp Business API costosa | Empezar solo con email. WhatsApp es opcional y solo si el volumen lo justifica |

---

### V2.2: Interfaz web mínima (semanas 3-4)

#### Qué construir

| Componente | Detalle |
|---|---|
| Panel de proyectos | App web mínima (React o Svelte) que lee de Supabase via API REST. Muestra lista de proyectos con estado, fase actual, aprobaciones pendientes. |
| Detalle de proyecto | Vista de un proyecto con toda su información: briefing, opciones de diseño, costes, propuesta, plan. Solo lectura. |
| Panel de aprobaciones | Lista de aprobaciones pendientes con botones de aprobar/rechazar integrados. Reemplaza los emails para las aprobaciones más frecuentes. |
| Dashboard de actividad | Vista de `activity_log` filtrada por proyecto. Muestra qué hizo cada agente, cuándo, resultado. |

**Stack sugerido**: Supabase como backend (API REST automática + Auth) + frontend estático desplegado en Vercel/Netlify. Sin backend custom.

**Alternativa low-code**: usar las tablas de Supabase directamente con el Table Editor de Supabase Dashboard como panel provisional. Funcional pero feo.

#### Riesgos V2.2

| Riesgo | Mitigación |
|---|---|
| El panel web consume demasiado tiempo de desarrollo | Empezar con la alternativa low-code (Supabase Dashboard). Solo construir UI custom si el arquitecto lo necesita realmente |
| Auth / seguridad | Supabase Auth con email+password. Row Level Security (RLS) para que solo el usuario autorizado vea sus proyectos |

---

### V2.3: Memoria semántica con embeddings (semanas 5-6)

#### Qué construir

| Componente | Detalle |
|---|---|
| Activar pgvector en Supabase | `CREATE EXTENSION vector;` + añadir columna `embedding vector(1536)` a `memory_cases` |
| Pipeline de embeddings | Nuevo workflow `util_generate_embedding`: recibe texto, llama a la API de embeddings (OpenAI text-embedding-3-small o similar), devuelve vector. |
| Escritura de embeddings | `agent_memory` genera embedding del summary + scope al cerrar proyecto. |
| Búsqueda semántica | `agent_design` y `agent_costs` buscan proyectos similares por cosine similarity en vez de solo por tags. Función SQL: `SELECT * FROM memory_cases ORDER BY embedding <=> $query_embedding LIMIT 5` |

#### Riesgos V2.3

| Riesgo | Mitigación |
|---|---|
| Pocos casos en memoria (< 10) | La búsqueda semántica no aporta mucho con pocos datos. Solo activar cuando haya > 10 proyectos cerrados |
| Coste de embeddings | text-embedding-3-small es muy barato (~$0.02 por 1M tokens). Impacto negligible |

---

### V2.4: Mejoras de calidad (semanas 7-8)

#### Qué construir

| Componente | Detalle |
|---|---|
| Ejecución paralela de normativa + materiales | Dos Execute Sub-workflow en paralelo + nodo Merge (Wait for Both) en el orquestador |
| Generación de PDF de propuesta | Workflow que toma el JSON de `proposals` y genera un PDF profesional con template (usando n8n Code node con librería PDF o servicio externo tipo DocuGenerate) |
| Clasificación documental con LLM | `agent_documents` usa LLM para analizar el contenido de PDFs y clasificar automáticamente |
| A/B testing de prompts | Sistema para activar prompt v2 en un agente, comparar resultados con v1 en `activity_log`, y decidir cuál queda |
| Alertas en Slack (opcional) | Añadir nodo Slack en `util_notification` como canal alternativo al email |

---

### QUÉ QUEDA FUERA DE V2

| Funcionalidad | Cuándo |
|---|---|
| Multi-usuario / roles / permisos | V3 |
| Interfaz gamificada (pixel/Habbo) | V3+ |
| Integración con software de planos | V3+ (evaluar) |
| API pública para terceros | V3 |
| App móvil | V3+ |
| Automatización de trámites con ayuntamiento | Probablemente nunca (cada ayuntamiento tiene su sistema) |

---

## FASE 3: V3 — "La Plataforma del Estudio"

### Objetivo
Transformar el sistema en una plataforma multi-usuario con roles, API, interfaz avanzada, y capacidad de escalar a múltiples arquitectos o estudios. Explorar la interfaz gamificada como diferencial de producto.

### Duración estimada: 3-6 meses (post-V2 estabilizada)

### Prerrequisito
V2 funcionando con al menos 20 proyectos procesados. Panel web funcional. Feedback acumulado.

---

### V3.1: Multi-usuario y roles

| Componente | Detalle |
|---|---|
| Auth con Supabase | Login con email+password, magic links, o Google OAuth |
| Roles | `admin` (ve todo, configura), `architect` (gestiona proyectos), `assistant` (solo lectura + algunas acciones) |
| Row Level Security | Cada usuario solo ve sus proyectos. RLS policies en Supabase |
| Tabla `users` | id, email, role, name, preferences |
| Asignación de proyectos | Campo `assigned_to` en `projects` que referencia al arquitecto responsable |
| Notificaciones por usuario | Cada usuario recibe solo las notificaciones de sus proyectos |

---

### V3.2: API del sistema

| Componente | Detalle |
|---|---|
| API REST documentada | Endpoints para crear proyecto, consultar estado, listar aprobaciones, registrar presupuestos. Usando las API REST auto-generadas de Supabase + funciones Edge para lógica custom |
| Webhooks de salida | Notificar a sistemas externos cuando un proyecto cambia de fase |
| Rate limiting | Protección contra abuso |

---

### V3.3: Interfaz avanzada

| Componente | Detalle |
|---|---|
| Dashboard completo | Métricas: proyectos activos, coste medio, desviación media, oficios más usados, tiempo medio por fase |
| Timeline de proyecto | Vista tipo Gantt del plan generado por `agent_planner` |
| Comparador de presupuestos | UI dedicada para comparar quotes de oficios lado a lado |
| Editor de propuesta | Editar la propuesta generada antes de enviar al cliente, sin tener que ir a la BD |

---

### V3.4: Interfaz gamificada (exploración)

| Componente | Detalle |
|---|---|
| Concepto pixel art | Representar el estudio como una oficina pixel (estilo Habbo). Cada agente es un "personaje" en la oficina. Los proyectos son "expedientes" que se mueven entre escritorios. |
| Valor real | Visualización intuitiva del estado del proyecto. El arquitecto ve de un vistazo qué agente está trabajando, qué está pausado, qué necesita atención. |
| Implementación | React + Phaser.js o PixiJS para el rendering isométrico. Datos de Supabase en tiempo real (Realtime subscriptions). |
| Riesgo | Alto esfuerzo de diseño visual + desarrollo frontend. Puede ser un diferencial de producto o un capricho sin ROI. Evaluar con un prototipo mínimo antes de invertir. |

---

### V3.5: Mejoras de IA

| Componente | Detalle |
|---|---|
| Agentes con herramientas web (MCP) | `agent_regulatory` usa MCP Client node para consultar webs de ayuntamientos. `agent_materials` consulta catálogos online. Solo tras verificar fiabilidad. |
| Agente de revisión cruzada | Nuevo agente que revisa la coherencia entre outputs de todos los agentes (¿los materiales del presupuesto coinciden con los de la propuesta? ¿Los oficios cubren todas las partidas?) |
| Fine-tuning de prompts automático | Usando los datos de `activity_log` + feedback humano para ajustar prompts automáticamente. Requiere evaluación con métricas definidas. |
| Multimodal | Agentes que procesan fotos de la vivienda (planos escaneados, estado actual) para extraer información automáticamente. Posible con Claude Vision o GPT-4V. |

---

## MAPA DE DEPENDENCIAS ENTRE FASES

```
MVP
├── Semana 1: Infraestructura
│   └── (sin dependencias previas)
├── Semana 2: Auxiliares + Briefing
│   └── depende de: Semana 1
├── Semana 3: Diseño + Normativa + Materiales
│   └── depende de: Semana 2 (util_llm_call, init_new_project)
├── Semana 4: Costes + Oficios + Propuesta
│   └── depende de: Semana 3 (datos de diseño y materiales)
├── Semana 5: Plan + Memoria + Cierre
│   └── depende de: Semana 4 (propuesta aprobada)
└── Semana 6: Estabilización
    └── depende de: Semanas 1-5

V2
├── V2.1: Comunicación externa
│   └── depende de: MVP estable + agent_trades funcionando
├── V2.2: Panel web
│   └── depende de: MVP estable (consume datos de BD)
├── V2.3: Memoria semántica
│   └── depende de: > 10 proyectos cerrados en memory_cases
└── V2.4: Mejoras de calidad
    └── depende de: V2.1 + V2.2 estables

V3
├── V3.1: Multi-usuario
│   └── depende de: V2.2 (panel web como base)
├── V3.2: API
│   └── depende de: V3.1 (auth y roles)
├── V3.3: Interfaz avanzada
│   └── depende de: V3.1 + V3.2
├── V3.4: Interfaz gamificada
│   └── depende de: V3.3 (como capa visual sobre datos existentes)
└── V3.5: Mejoras IA
    └── depende de: V2.3 + V2.4 + volumen de datos
```

---

## RESUMEN EJECUTIVO: TIMELINE

```
MES 1-2:    MVP construido y testeado con proyectos simulados
MES 2-3:    MVP en producción con proyectos reales, estabilización
MES 3-5:    V2 (comunicación, panel web, embeddings)
MES 6-8:    V2 estabilizada, acumulando datos
MES 8-12:   V3 (multi-usuario, API, interfaz avanzada)
MES 12+:    V3+ (gamificación, multimodal, MCP)
```

---

## PRESUPUESTO DE INFRAESTRUCTURA ESTIMADO

### MVP (meses 1-3)

| Componente | Coste mensual |
|---|---|
| VPS para n8n (4GB RAM, 2 vCPU) | 15-25€ |
| Supabase Free Tier | 0€ |
| Google Workspace (Drive + Gmail) | Ya existente (0€ adicional) |
| LLM API (Anthropic/OpenAI) | 5-15€ (50 proyectos/año ≈ 100€/año) |
| Dominio + DNS | 1€/mes |
| **TOTAL MVP** | **~20-40€/mes** |

### V2 (meses 4-8)

| Componente | Coste mensual adicional |
|---|---|
| Supabase Pro (si se excede free tier) | +25€ |
| Vercel/Netlify (panel web) | 0€ (free tier) |
| Embeddings API | +2-5€ |
| **TOTAL V2** | **~50-70€/mes** |

### V3 (meses 9+)

| Componente | Coste mensual adicional |
|---|---|
| VPS más potente (si hay multi-usuario) | +20-40€ |
| Supabase Team (si hay equipo) | +599€ (o mantener Pro) |
| Herramientas de diseño (si interfaz gamificada) | Variable |
| **TOTAL V3** | **~100-700€/mes** (según escala) |

---

## RIESGOS GLOBALES DEL PROYECTO

| Riesgo | Probabilidad | Impacto | Fase | Mitigación |
|---|---|---|---|---|
| **Calidad de outputs del LLM insuficiente** | Media | Alto | MVP | Iterar prompts con proyectos reales. Tener siempre el humano como revisor final. No confiar ciegamente. |
| **El arquitecto no adopta el sistema** | Media | Crítico | MVP | Involucrar al arquitecto desde la semana 2. Que vea valor inmediato. Si no lo usa, el sistema muere. |
| **Coste de LLM se dispara** | Baja | Medio | V2+ | Monitorizar con activity_log (tokens + coste). Usar modelos baratos para tareas simples. |
| **n8n tiene bugs o limitaciones** | Media | Medio | Todo | Pinear versión (2.12.x). No actualizar inmediatamente. Tener backup de workflows. |
| **Supabase free tier insuficiente** | Baja (MVP) | Bajo | V2 | Pasar a Pro ($25/mes) cuando se acerque al límite. |
| **Datos sensibles de clientes** | - | Alto | Todo | No almacenar datos fiscales/bancarios. Supabase con RLS. Backups regulares. RGPD: el cliente puede pedir eliminación. |
| **El sistema genera recomendaciones erróneas** | Media | Alto | Todo | TODA decisión técnica, normativa y económica final es HUMANA. El sistema prepara y sugiere, nunca decide. |
| **Dependencia de un solo proveedor de LLM** | Baja | Medio | V2+ | util_llm_call está parametrizado por modelo. Cambiar de Anthropic a OpenAI (o viceversa) solo requiere cambiar el modelo y ajustar el payload en un workflow. |

---

*Documento: BLOQUE 5 — Plan de Construcción por Fases*
*MVP: 6-8 semanas | V2: +6-8 semanas | V3: +3-6 meses*
*Siguiente: BLOQUE 6 — Primer workflow a construir (paso a paso)*
