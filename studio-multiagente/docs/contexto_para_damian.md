# Contexto para Damián — Cosas que tú puedes desarrollar en ArquitAI

Este archivo consolida todo lo que hemos hablado para que puedas **desarrollar, ampliar y aportar** cada sección a tu ritmo. No es un plan de ejecución (eso está en `ArquitAI.md`). Es tu sitio para pensar, escribir y decidir sin depender de Claude en tiempo real.

Cuando tengas una sección lista, me la pasas y yo la integro al sistema (prompts, workflows, knowledge base).

---

## Índice

1. [Las 20 oportunidades identificadas — detalle + prerequisitos + tu opinión](#1-las-20-oportunidades)
2. [Taxonomía "bufete de arquitectos" — 10 especializaciones](#2-taxonomía-bufete-de-arquitectos)
3. [Estructura de conocimiento (`knowledge/`) — qué metes tú, qué genero yo](#3-estructura-knowledge)
4. [Lo que YO sé de arquitectura vs. lo que NECESITO de ti](#4-lo-que-sé-vs-lo-que-necesito)
5. [Preguntas abiertas para que tú decidas](#5-preguntas-abiertas)
6. [Cómo usar este archivo](#6-cómo-usar-este-archivo)

---

## 1. Las 20 oportunidades

Cada una sigue el mismo esqueleto. Puedes añadir al final de cada oportunidad tus **notas personales** (columna "Tu opinión") — rechazarla, priorizarla, modificarla, fusionarla con otra, etc.

### 1.1 `agent_site_monitor` — Seguimiento de obra en tiempo real

| Campo | Valor |
|---|---|
| **Pain-point real** | Los retrasos en obra se descubren en la siguiente visita (a veces con semanas de diferencia). |
| **Qué haría** | El jefe de obra manda fotos + mensaje por WhatsApp/Telegram. Claude Vision analiza foto vs fase programada del `project_plan`. Escribe en `site_reports` con `progress_pct`, `deviations[]`, `issues_detected[]`. |
| **Beneficio** | Detectar desviaciones en 24h. Evidencia fotográfica automática para reclamaciones. |
| **Prerequisitos técnicos** | `project_plan` implementado (✅ ya existe), webhook para WhatsApp (Evolution API), Claude Vision en util_llm_call. |
| **Esfuerzo estimado** | M (3-5 días) |
| **Tu opinión** |  |

### 1.2 `agent_trade_comms` — Coordinación automatizada con gremios

| Campo | Valor |
|---|---|
| **Pain-point real** | Horas semanales en llamadas, WhatsApps y emails con gremios para presupuestos y ajustes. |
| **Qué haría** | Enviar encargos vía WhatsApp/email con botones estructurados. Parser de respuestas → `trade_quotes`. Re-envío automático si no hay respuesta en plazo. |
| **Beneficio** | Comparativo de gremios listo sin coordinar conversaciones paralelas. |
| **Prerequisitos** | `trade_requests` ya existe (✅). Falta `trade_quotes`, integración Evolution API, templates de mensaje. |
| **Esfuerzo** | M-L (5-8 días) |
| **Tu opinión** |  |

### 1.3 `agent_permit_tracker` — Gestión de licencias municipales

| Campo | Valor |
|---|---|
| **Pain-point real** | Seguimiento manual de expedientes en sedes electrónicas (cada ayuntamiento con su portal). Requerimientos pasan desapercibidos días. |
| **Qué haría** | Cron diario que scrapea o consulta (si existe API) las sedes electrónicas, detecta cambios de estado, notifica. Integración con firma digital (Autofirma/FNMT). |
| **Beneficio** | Ninguna gestión administrativa se queda sin ver. La obra puede empezar antes. |
| **Prerequisitos** | Tabla `permit_applications`. Cada sede municipal es distinta — hay que escribir un scraper por ayuntamiento. |
| **Esfuerzo** | L-XL (semanas, depende de cuántos ayuntamientos cubrir) |
| **Tu opinión** |  |

### 1.4 `agent_client_concierge` — Chatbot dedicado al cliente

| Campo | Valor |
|---|---|
| **Pain-point real** | Durante obra, el cliente tiene dudas constantes (plazo, extras, cambios menores). Cada pregunta interrumpe al arquitecto. |
| **Qué haría** | Portal web con chat que responde usando los datos DEL proyecto. Escala al arquitecto solo cuando la pregunta requiere decisión profesional. |
| **Beneficio** | El arquitecto atiende solo lo que merece atención profesional. Cliente siente seguimiento 24/7. |
| **Prerequisitos** | Portal web (frontend), autenticación por link mágico, acceso con RLS por project_id. |
| **Esfuerzo** | XL (2-3 semanas con UI) |
| **Tu opinión** |  |

### 1.5 `agent_financial_tracker` — Control financiero de obra

| Campo | Valor |
|---|---|
| **Pain-point real** | `agent_costs` estima pero no controla. Certificaciones, facturas reales, extras se pierden en Excel. |
| **Qué haría** | OCR de facturas (Claude Vision), tabla `certifications`, reconcilia presupuesto ↔ certificación ↔ pago. Alerta desviación >X%. |
| **Beneficio** | Desviación económica en tiempo real, no al final. Anticipación de certificaciones al cliente. |
| **Prerequisitos** | Tabla `certifications`, flujo de subida de facturas, Claude Vision. |
| **Esfuerzo** | M (4-6 días) |
| **Tu opinión** |  |

### 1.6 `agent_aftercare` — Postventa y garantías LOE

| Campo | Valor |
|---|---|
| **Pain-point real** | LOE obliga a 1/3/10 años de garantía. Las incidencias post-entrega se gestionan mal y generan fricción. |
| **Qué haría** | Endpoint de incidencias (cliente envía foto). Clasificación LLM por `category` (acabado/habitabilidad/estructura) + `responsible_trade`. Enruta al gremio responsable. |
| **Beneficio** | Cumple LOE sin pérdidas administrativas. Traza defensa ante reclamaciones. |
| **Prerequisitos** | Tabla `aftercare_incidents` con SLA por tipo, re-uso `agent_trade_comms`. |
| **Esfuerzo** | M (4-5 días) |
| **Tu opinión** |  |

### 1.7 `agent_safety_plan` — EBSS/PSS automático

| Campo | Valor |
|---|---|
| **Pain-point real** | RD 1627/1997 obliga a EBSS/PSS por proyecto. Copiar-pegar plantillas genera documentos que el inspector detecta como copia-pega. |
| **Qué haría** | LLM lee briefing + design + trades + plan. Genera EBSS/PSS adaptado: riesgos por fase, EPIs por gremio, protecciones, coordinación simultáneas. Output a Google Doc. |
| **Beneficio** | 3-5h ahorradas por proyecto. Cumplimiento real. |
| **Prerequisitos** | Google Docs API (ya credencial ✅), templates base. |
| **Esfuerzo** | S (2-3 días) — **alto ROI** |
| **Tu opinión** |  |

### 1.8 `agent_qc_checklists` — Control de calidad in-situ

| Campo | Valor |
|---|---|
| **Pain-point real** | Visitas de obra basadas en memoria. Se olvidan comprobaciones (niveles, estanqueidad, replanteos) que salen caras después. |
| **Qué haría** | Checklists generadas por fase del plan. App móvil con puntos de control + foto + pass/fail. Tabla `qc_checks` con evidencia. |
| **Beneficio** | Menos vicios ocultos. Defensa ante reclamaciones. Trazabilidad para RC profesional. |
| **Prerequisitos** | App móvil (frontend), integrable con `agent_site_monitor`. |
| **Esfuerzo** | L (semanas, necesita app) |
| **Tu opinión** |  |

### 1.9 `agent_memory_v2` — Análisis predictivo entre proyectos

| Campo | Valor |
|---|---|
| **Pain-point real** | `memory_cases` almacena lecciones pero no las usa estadísticamente. |
| **Qué haría** | Embeddings sobre `memory_cases.summary + tags`. Nuevo proyecto → similarity search → predicciones duración/coste/riesgos. |
| **Beneficio** | Propuestas con respaldo estadístico propio, no intuición. |
| **Prerequisitos** | `memory_cases` ya poblado (✅), necesita embeddings (OpenAI ada o Claude). |
| **Esfuerzo** | S-M (3-4 días) |
| **Tu opinión** |  |

### 1.10 `agent_energy_assessor` — Simulación energética y huella de carbono

| Campo | Valor |
|---|---|
| **Pain-point real** | CEE se hace con software desconectado (CE3X, CYPETherm) AL FINAL del proyecto. |
| **Qué haría** | Lee design + materiales + ubicación. Calcula demanda aprox (CTE HE0/HE1) + huella (BEDEC). Exporta a CE3X o informe simplificado. |
| **Beneficio** | Decisiones de aislamiento/ventanas informadas al momento. Evita rework de CEE. |
| **Prerequisitos** | BEDEC data, fórmulas CTE-HE. |
| **Esfuerzo** | L (semanas, cálculo complejo) |
| **Tu opinión** |  |

### 1.11 `agent_accessibility` — Validación DB-SUA

| Campo | Valor |
|---|---|
| **Pain-point real** | DB-SUA del CTE tiene decenas de parámetros (anchos, radios, alturas) que nadie valida sistemáticamente contra el diseño. |
| **Qué haría** | Recibe rooms_layout + dimensiones + tipo reforma. Verifica DB-SUA 1/2/9 aplicable. Output: `compliance_issues[]` con referencia + sugerencia de corrección. |
| **Beneficio** | Detectar incumplimientos ANTES de ejecutar carpinterías. |
| **Prerequisitos** | DB-SUA parametrizado, dimensiones en rooms_layout. |
| **Esfuerzo** | S-M (4-5 días) — **alto valor legal bajo coste** |
| **Tu opinión** |  |

### 1.12 `agent_bim_sync` — Integración BIM profesional

| Campo | Valor |
|---|---|
| **Pain-point real** | Estudios trabajan en Revit/ArchiCAD. El modelo BIM tiene info aprovechable y viceversa. |
| **Qué haría** | IFC (estándar abierto) + Revit (Dynamo o addin). Sincroniza: carpintería → `material_items`, mediciones → `cost_estimates`, fases Revit → `project_plans`. |
| **Beneficio** | Cambio en BIM actualiza mediciones y presupuesto. Elimina dualidad. |
| **Prerequisitos** | Parser IFC (librería disponible), addin Revit (si usas Revit). |
| **Esfuerzo** | XL (semanas-meses). Transformador pero complejo. |
| **Tu opinión** |  |

### 1.13 `agent_contracts` — Firma electrónica y gestión de contratos

| Campo | Valor |
|---|---|
| **Pain-point real** | 3-6 docs por proyecto necesitan firma (encargo, contrato cliente, contratos gremios, actas). Se imprimen y escanean. |
| **Qué haría** | Integración con FNMT/Autofirma/DocuSign. Genera desde plantilla → envía para firma → callback → `documents` con `signed_at`, `hash`. |
| **Beneficio** | Valor jurídico verificable. Auditoría temporal exacta. |
| **Prerequisitos** | Plantillas de contratos, integración con sistema de firma. |
| **Esfuerzo** | M (5-7 días) |
| **Tu opinión** |  |

### 1.14 Ciberseguridad y GDPR

| Campo | Valor |
|---|---|
| **Pain-point real** | Estudio maneja datos personales + planos (IP) + precios gremios (comercial confidencial). Protección típica: "Drive con contraseña". |
| **Qué haría** | Paquete multi-componente: RLS Supabase, cifrado campos sensibles, audit log, backups automáticos, DKIM/SPF/DMARC, secrets rotation, pen test anual, GDPR compliance agent. |
| **Beneficio** | Un incidente puede cerrar un estudio. Proteger desde el diseño vale mucho menos que remediar. |
| **Prerequisitos** | Revisión arquitectura actual, implementación RLS, S3/backup service. |
| **Esfuerzo** | M-L (1-2 semanas). **Precondición para multi-tenant V2.** |
| **Tu opinión** |  |

### 1.15 `agent_anomaly_detector` — Detección de anomalías económicas

| Campo | Valor |
|---|---|
| **Pain-point real** | Gremio con precios sistemáticamente altos, partida que crece entre certificaciones, material que aparece en presupuesto pero no en diseño — invisibles al ojo humano en 10 proyectos simultáneos. |
| **Qué haría** | Compara cada proyecto vs estadísticos de `memory_cases` + `price_references`. Detecta outliers (desv. estándar por categoría). Alertas cuando gremio sube >20% sin justificación. |
| **Beneficio** | Margen protegido. Fraude detectable. |
| **Prerequisitos** | Histórico de proyectos suficiente, tablas de referencia pobladas (✅ price_references lista). |
| **Esfuerzo** | S (2-3 días, mejor con histórico mayor) |
| **Tu opinión** |  |

### 1.16 `agent_home_automation` — Domótica y smart home

| Campo | Valor |
|---|---|
| **Pain-point real** | Cada vez más reformas piden domótica (HA, KNX, Matter). El arquitecto no domina el sistema → deriva a integrador sin planificación. |
| **Qué haría** | KB de ecosistemas + dispositivos. Recibe preferencias cliente → topología + dispositivos + preinstalación (cajas, conductos, mecanismos). |
| **Beneficio** | Servicio diferenciador sin ser experto. Preinstalación desde el inicio (añadir después es 2x caro). |
| **Prerequisitos** | KB de dispositivos (hay que construirla o conectar a catálogos). |
| **Esfuerzo** | M (5-7 días). **Nicho creciente.** |
| **Tu opinión** |  |

### 1.17 `agent_ar_preview` — Realidad aumentada para cliente

| Campo | Valor |
|---|---|
| **Pain-point real** | Cliente aprueba sobre planos 2D/renders. No entiende espacialmente hasta ver la obra → rechaza decisiones en ejecución. |
| **Qué haría** | Export modelo 3D (`agent_3d_design`) a USDZ/glTF. App nativa o WebXR. Cliente apunta móvil y ve redistribución superpuesta. |
| **Beneficio** | Aprobaciones firmes. Menos cambios tardíos. Percepción de estudio tecnológico. |
| **Prerequisitos** | `agent_3d_design` primero, app móvil AR. |
| **Esfuerzo** | XL (semanas, post-3D) |
| **Tu opinión** |  |

### 1.18 `agent_pathology` — Diagnóstico estructural con visión

| Campo | Valor |
|---|---|
| **Pain-point real** | Cada reforma empieza con visita. Fisuras, humedades, deformaciones quedan descritos en memoria sin estructurar. |
| **Qué haría** | Subida de fotos → Claude Vision clasifica: fisura estructural vs no, tipología humedad, ataque biótico, corrosión. Tabla `pathologies` con severity, suggested_intervention, normativa_afectada. Estructural → bloquea avance a diseño hasta validación técnica. |
| **Beneficio** | Ninguna patología crítica pasa. Informe visual al cliente → justifica presupuestos y plazos. |
| **Prerequisitos** | Claude Vision, tabla `pathologies`, KB de tipologías. |
| **Esfuerzo** | M (4-5 días) |
| **Tu opinión** |  |

### 1.19 `util_interop` — BC3 / IFC / GAEB

| Campo | Valor |
|---|---|
| **Pain-point real** | CYPE, Presto, TCQ, Navisworks son día a día. ArquitAI hoy los ignora. |
| **Qué haría** | Export/import: BC3 (FIEBDC) para presupuestos CYPE/Presto, IFC para BIM, GAEB para clientes internacionales. |
| **Beneficio** | ArquitAI deja de ser silo. Adopción facilitada (usas ArquitAI como orquestador, sigues en CYPE/Revit cuando conviene). |
| **Prerequisitos** | Parsers BC3 (existen libs), IFC (ifcopenshell). |
| **Esfuerzo** | L (semanas, formatos complejos) |
| **Tu opinión** |  |

### 1.20 `agent_collab_coordinator` — Colaboradores externos

| Campo | Valor |
|---|---|
| **Pain-point real** | Proyectos complejos requieren colaboradores puntuales (estructuras, instalaciones, paisajismo). Coordinación por emails dispersos. |
| **Qué haría** | Perfil de colaborador con rol limitado (RLS). Asignación de entregables con fechas. Notificaciones con contexto resumido. Aprobación del arquitecto antes de incorporar. |
| **Beneficio** | Escalar el estudio sin perder control ni trazabilidad. |
| **Prerequisitos** | RLS (ver 1.14), tabla `collaborators`, roles. |
| **Esfuerzo** | M (5-7 días) |
| **Tu opinión** |  |

---

### Priorización que propongo (puedes cambiar este orden)

| # | Agente | Justificación |
|---|---|---|
| 1 | **1.7 agent_safety_plan** | Bajo esfuerzo, ahorro medible inmediato, cumplimiento obligatorio |
| 2 | **1.11 agent_accessibility** | Bajo esfuerzo, alto valor legal |
| 3 | **1.14 Ciberseguridad** | Precondición para multi-tenant V2 |
| 4 | **1.3 agent_permit_tracker** | Cuello de botella histórico del oficio |
| 5 | **1.2 agent_trade_comms** | Horas/proyecto ahorradas |
| 6 | **1.1 agent_site_monitor** | Cierra loop plan → ejecución |
| 7 | **1.9 agent_memory_v2** | Explota datos que ya se están guardando |
| 8 | **1.18 agent_pathology** | Clave para fase inicial del proyecto |
| 9 | Resto según orden de tu tabla en ArquitAI.md sec 4 | |

---

## 2. Taxonomía bufete de arquitectos

Cada "especialista" es un agente con `prompt_system` específico + archivos de `knowledge/` específicos. Propuesta:

| Especialista | Agente(s) ya existente(s) | Futuros agentes | Knowledge necesaria |
|---|---|---|---|
| **Arquitecto técnico generalista** | agent_briefing, agent_design | | CTE general, LOE, criterios técnicos |
| **Jurista / trámites** | agent_regulatory | agent_permit_tracker (1.3) | Normativa estatal/autonómica/municipal, ordenanzas |
| **Aparejador / mediciones** | agent_costs | agent_financial_tracker (1.5) | CYPE, BEDEC, FIEBDC, honorarios profesionales |
| **Jefe de obra** | agent_planner | agent_site_monitor (1.1), agent_qc_checklists (1.8) | Secuencias constructivas, control ejecución, RD 1627/1997 |
| **Coordinador seguridad y salud** | — | agent_safety_plan (1.7) | RD 1627/1997, ergonomía, EPIs |
| **Ingeniero instalaciones** | — | `agent_installations` (nuevo) | REBT, RITE, CTE HS, DB-HE instalaciones |
| **Ingeniero estructural** | — | `agent_structural` (nuevo) + agent_pathology (1.18) | DB-SE, cálculo, patologías |
| **Especialista eficiencia energética** | — | agent_energy_assessor (1.10) | CTE HE completo, CEE, huella carbono BEDEC |
| **Diseñador / decorador** | agent_materials | `agent_interior_design` (nuevo) | Materiales, colores, ergonomía, tendencias |
| **BIM manager** | agent_documents | agent_bim_sync (1.12) | Revit/ArchiCAD/IFC, estándares AECO |

### Tu opinión / ajustes a la taxonomía

- ¿Añadirías alguna especialización?
- ¿Fusionarías algunas?
- ¿Separarías algún agente existente?

---

## 3. Estructura `knowledge/`

Propongo esta estructura de carpeta. Cada archivo es un `.md` que tú rellenas progresivamente. Los agentes leen los archivos relevantes como contexto en sus prompts.

```
studio-multiagente/
└── knowledge/
    ├── README.md                          ← índice maestro (yo lo mantengo)
    ├── normativa/
    │   ├── cte/                           ← PDFs oficiales (los bajas tú)
    │   │   ├── DB-SE.pdf
    │   │   ├── DB-SUA.pdf
    │   │   ├── DB-HE.pdf
    │   │   ├── DB-SI.pdf
    │   │   ├── DB-HR.pdf
    │   │   └── DB-HS.pdf
    │   ├── cte_indice.md                  ← resumen navegable yo creo
    │   ├── loe.md                         ← Ley Ordenación Edificación
    │   ├── autonomica/
    │   │   └── madrid/                    ← decreto habitabilidad CAM, etc.
    │   └── municipal/
    │       └── madrid/                    ← PGOU, ordenanzas
    ├── materiales/
    │   ├── catalogos_proveedores.md       ← tus proveedores de confianza
    │   ├── bedec_huella_carbono.md        ← huella CO2 por tipología
    │   ├── compatibilidades.md            ← qué materiales se usan juntos
    │   └── tu_preferencias.md             ← tus preferencias (granito > X, PVC evitar)
    ├── construccion/
    │   ├── detalles_constructivos.md      ← fachada ventilada, cubierta invertida...
    │   ├── patologias.md                  ← clasificación + intervención
    │   ├── fases_de_obra.md               ← secuencia técnica estándar
    │   └── plazos_tipicos.md              ← cuánto tarda cada fase
    ├── instalaciones/
    │   ├── electrica_REBT.md
    │   ├── fontaneria_CTE_HS.md
    │   ├── climatizacion_RITE.md
    │   └── domotica_KNX_Matter.md
    ├── accesibilidad/
    │   ├── DB-SUA_checklist.md            ← parámetros verificables
    │   └── normativa_autonomica.md
    ├── economico/
    │   ├── honorarios_profesionales.md    ← tarifas COAM, normativa
    │   └── impuestos_y_tasas.md           ← IVA, ITP, licencias
    ├── proyectos_reales/                  ← casos tuyos anonimizados
    │   ├── proyecto_01_reforma_embajadores/
    │   │   ├── briefing.md
    │   │   ├── decisiones_criticas.md
    │   │   └── lessons.md
    │   └── ...
    └── tu_forma_de_trabajar/
        ├── criterios_seleccion_gremios.md ← cómo eliges gremios
        ├── checklist_visita_previa.md     ← qué miras en una visita
        ├── preferencias_materiales.md     ← tus "siempre/nunca"
        └── faq_clientes.md                ← preguntas típicas y tus respuestas
```

### División de trabajo: tú vs yo

| Archivo | Quién lo rellena | Tiempo estimado |
|---|---|---|
| `normativa/cte/*.pdf` | **Tú** (bajas de codigotecnico.org) | 10 min |
| `normativa/cte_indice.md` | **Yo** (resumen navegable) | 1 sesión |
| `normativa/loe.md` | **Yo** (resumen LOE con artículos clave) | 30 min |
| `normativa/autonomica/madrid/*` | **Tú** (decretos específicos que uses) | 1h al mes según necesites |
| `normativa/municipal/madrid/*` | **Tú** (PGOU Madrid, ordenanzas) | Según necesidad |
| `materiales/catalogos_proveedores.md` | **Tú** (tus proveedores habituales) | 1-2h |
| `materiales/bedec_huella_carbono.md` | **Yo** (scrape de BEDEC público) | 1 sesión |
| `materiales/compatibilidades.md` | **Yo** (conocimiento general) + **tú** (tus reglas) | 1 sesión + 30 min tuyos |
| `materiales/tus_preferencias.md` | **Tú** (irreemplazable) | 1-2h |
| `construccion/detalles_constructivos.md` | **Yo** (base) + **tú** (afinas) | 1 sesión |
| `construccion/patologias.md` | **Yo** (base) + **tú** (casos que hayas visto) | 1 sesión + tu review |
| `construccion/fases_de_obra.md` | **Yo** (estándar) | 1 sesión |
| `construccion/plazos_tipicos.md` | **Tú** (datos reales de tus obras) | Según tengas datos |
| `instalaciones/*` | **Yo** (base REBT/RITE/CTE HS) + **tú** (tu experiencia) | 1 sesión por archivo |
| `accesibilidad/DB-SUA_checklist.md` | **Yo** (parámetros del CTE) | 1 sesión |
| `economico/*` | **Yo** (base) + **tú** (honorarios COAM actualizados) | 1 sesión + 30 min tuyos |
| `proyectos_reales/*` | **Tú** (tus proyectos anonimizados) | 2-4h por proyecto inicial |
| `tu_forma_de_trabajar/*` | **Tú** (irreemplazable — es tu voz) | 3-5h total |

### Lo imprescindible para arrancar Fase B (conocimiento)

Si solo tienes 1 tarde, prioriza:

1. `tu_forma_de_trabajar/checklist_visita_previa.md` — qué miras cuando entras a un piso la primera vez.
2. `tu_forma_de_trabajar/preferencias_materiales.md` — 10 reglas de "siempre / nunca".
3. `materiales/catalogos_proveedores.md` — tus 5-10 proveedores con contacto.
4. 1 proyecto real anonimizado en `proyectos_reales/` — estructura cualquiera.

Con eso yo puedo empezar a personalizar prompts. El resto se va llenando a medida que lo necesitemos.

---

## 4. Lo que sé vs lo que necesito

### Lo que YO traigo de training (sin acceso a internet)

**Base arquitectónica sólida:**
- CTE estructura y propósito de cada documento básico.
- LOE principios y responsabilidades.
- Tipologías constructivas españolas (reforma integral, rehabilitación, ampliación, nueva planta).
- Principios de ergonomía (medidas estándar, alturas, separaciones).
- Cálculo básico estructural (conceptos, no detallista).
- Instalaciones base (esquemas, principios).
- Patología: clasificación tipo, métodos de intervención generales.
- Conocimiento de software del sector (qué hace cada uno).
- Ley de Ordenación de la Edificación.
- Criterios generales de DB-SUA, DB-HE, DB-SI.

**Procesos de negocio:**
- Ciclo de proyecto arquitectónico (encargo → proyecto básico → proyecto ejecución → licencia → obra → entrega).
- Roles profesionales: arquitecto técnico, arquitecto superior, aparejador, jefe de obra, promotor.
- Trámites típicos: licencia de obras, DAS (Declaración Responsable), licencia de primera ocupación.

**Programación:**
- n8n al nivel de la documentación actual.
- SQL PostgreSQL, esquemas, migraciones.
- Integraciones API (REST, OAuth).
- LLMs (OpenAI, Anthropic) a nivel de prompt engineering y cost optimization.

### Lo que NO puedo saber sin ayuda

**Normativa específica actualizada:**
- Texto literal del CTE vigente (los DB se modifican por RD periódicamente).
- Normativa autonómica específica (habitabilidad, accesibilidad, urbanismo).
- PGOUs y ordenanzas municipales concretas.

**Precios reales actualizados:**
- CYPE / BEDEC cifras exactas 2026 (tengo base ya poblada pero puede estar desactualizada).
- Tarifas específicas de los gremios de tu zona.

**Tu experiencia profesional:**
- Tu criterio específico (por qué eliges X sobre Y).
- Tus proveedores y gremios de confianza.
- Errores que hayas cometido y cómo los corriges.
- Incidencias típicas que tú ves pero no están documentadas.
- Tu checklist personal de visita.

**Datos del territorio:**
- Datos climáticos precisos por zona (para cálculos energéticos).
- Orientación solar precisa (para diseño pasivo).
- Comportamiento del mercado inmobiliario local.

### Mi propuesta de búsqueda online cuando la necesite

Cuando lance una tarea que requiera info pública actualizada, puedo buscar en:
- codigotecnico.org (sede oficial CTE)
- boe.es (normativa publicada)
- csc-escola.cat / coam.org / cscae.com (colegios profesionales)
- itec.cat/bedec (BEDEC — algunas tablas son públicas)
- ideca.es / idena-navarra / visor.ayto-aragón (PGOUs públicos)
- meteo.gob.es (datos climáticos oficiales)

Pero esto es **reactivo** (cuando haga falta), no una inmersión inicial. El contexto permanente lo construimos con `knowledge/`.

---

## 5. Preguntas abiertas

Decide a tu ritmo. Tu respuesta afecta a cómo construimos lo siguiente:

1. **¿Prefieres un agente genérico con mucha knowledge, o varios agentes especializados con knowledge propia?**
   (Mi voto: varios especializados — escala mejor, más mantenible, permite que un arquitecto no-generalista use solo los relevantes.)

2. **¿Quieres que los agentes no-bloqueantes** (regulatory, materials, costs) **sean auto-aprobados**, o que todos requieran tu check?
   (Mi voto: auto-aprobados con flag `review_required` en casos específicos — ej. `normativa_confidence: 'low'`.)

3. **¿Qué estudios o arquitectos cercanos te inspiran profesionalmente?** Saber esto me permite orientar el "estilo profesional" del sistema (conservador vs. innovador, pragmático vs. idealista).

4. **¿Cuál es el proyecto arquetípico** para ti? Si ArquitAI solo hiciera bien UN tipo de proyecto al principio, ¿cuál sería?
   (Mi apuesta: reforma integral piso en Madrid 60-90m² para familia joven. Simple, frecuente, alto valor. Una vez pulido se extiende.)

5. **¿Quieres poder pausar un proyecto a mitad de pipeline?** Hoy se procesa intake → planning en orden fijo. Útil si a veces el cliente desaparece 3 semanas.
   (Yo añadiría un estado `paused` en `projects.status` y un timer de auto-reactivación configurable.)

6. **¿Cuánto de tu know-how es transferible** (otros arquitectos lo usarían igual) **vs. específico tuyo**? Esto afecta a cuánto invertimos en knowledge genérica vs. tu personalización.

---

## 6. Cómo usar este archivo

- **Cuando tengas tiempo**: rellena las columnas "Tu opinión" de las 20 oportunidades.
- **Cuando quieras priorizar**: reordena la tabla de priorización en sección 1.
- **Cuando empieces a aportar knowledge**: crea los archivos bajo `knowledge/` siguiendo la estructura de sección 3.
- **Cuando quieras ajustar la taxonomía**: edita la sección 2.
- **Cuando tengas respuestas**: escríbelas en la sección 5.

Cuando quieras que yo integre algo de lo que desarrolles, me dices "toma la oportunidad 1.7, implementémosla" o "he puesto mi preferencia de materiales, úsala en agent_materials".

No hay prisa. Este documento te sirve para **desarrollar el producto a tu ritmo**. Yo actúo sobre lo que apruebes.
