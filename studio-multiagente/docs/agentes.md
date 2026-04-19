# BLOQUE 4 — Detalle de Implementación por Agente

## Sistema Multiagente para Estudio de Arquitectura Técnica y Reformas

**n8n: 2.12.x | LLM: Anthropic Claude / OpenAI GPT-4 vía HTTP Request**
**Agentes: 11 + 1 orquestador**

---

## CONVENCIONES

- **Prompt completo**: cada agente tiene un system prompt y un user_template. Los prompts están en el archivo complementario `bloque4_prompts.md`.
- **Modelo recomendado**: se indica por agente. "Sonnet" = Claude Sonnet (barato, rápido, suficiente para tareas estructuradas). "Opus/GPT-4" = modelos potentes para razonamiento complejo.
- **Temperatura**: 0.2-0.3 para tareas estructuradas, 0.5-0.6 para tareas creativas (diseño, propuesta).
- **Formato de output del LLM**: todos los agentes piden respuesta en JSON. El Code node parsea y valida.

---

## AGENTE 0: ORQUESTADOR (`main_orchestrator`)

### Misión
Gobernar el flujo completo de cada proyecto. Leer el estado actual, decidir qué agente ejecutar, invocar el sub-workflow, evaluar el resultado, actualizar la fase y decidir el siguiente paso. No razona con LLM: su lógica es determinista (Switch/If).

### Input esperado
```json
{
  "project_id": "uuid",
  "action": "advance | retry | force_phase | client_accepted",
  "force_phase": "optional: phase name if action=force_phase"
}
```

### Output esperado
```json
{
  "project_id": "uuid",
  "previous_phase": "intake",
  "new_phase": "briefing_done",
  "agent_executed": "agent_briefing",
  "result_status": "complete | pending | error | timeout",
  "message": "Briefing generado y aprobado"
}
```

### Herramientas que usa (nodos n8n)
| Nodo | Función |
|---|---|
| Webhook | Recibir peticiones de avance |
| Schedule Trigger | Revisión periódica |
| Postgres (×3-4) | Leer estado, actualizar fase, log |
| Switch | Enrutar por fase |
| If (×2-3) | Evaluar condiciones (activo, aprobaciones pendientes, resultado) |
| Execute Sub-workflow (×1 por ciclo) | Llamar al agente correspondiente |
| Code (×1-2) | Evaluar resultado del agente |
| Edit Fields | Preparar output |

### Qué datos consulta
- `projects` (current_phase, status, budget_target)
- `approvals` (count de pendientes)

### Qué datos escribe
- `projects.current_phase` (UPDATE)
- `projects.status` (UPDATE si se completa)
- `activity_log` (INSERT)

### Cuándo se ejecuta
- Cuando `init_new_project` lo dispara vía webhook
- Cuando una aprobación humana se completa y el agente retorna al orquestador
- Cada 4-8 horas vía Schedule Trigger (para proyectos que puedan avanzar automáticamente)
- Manualmente vía webhook (el arquitecto fuerza un avance)

### Quién lo invoca
- `init_new_project` (vía HTTP Request al webhook)
- Auto-invocación indirecta: cuando un sub-workflow con Wait completa, el flujo vuelve al orquestador automáticamente
- Schedule Trigger (auto)

### Qué aprobación necesita
Ninguna. El orquestador no necesita aprobación propia. Las aprobaciones las gestionan los agentes internamente.

### Errores comunes y control

| Error | Causa | Control |
|---|---|---|
| Proyecto no encontrado | project_id inválido | If node: si query retorna vacío → return error |
| Fase desconocida | current_phase corrupta | Switch default branch → log error + notificar |
| Sub-workflow falla | Error en el agente | El agente retorna {status: "error"}. El orquestador no cambia la fase y logea el error |
| Loop infinito | Agente retorna "retry" indefinidamente | Counter en activity_log: si el mismo agente se ejecutó >3 veces en la misma fase → bloquear proyecto y alertar |
| Aprobaciones huérfanas | Wait expiró sin respuesta | cron_project_review detecta y expira |

---

## AGENTE 1: BRIEFING (`agent_briefing`)

### Misión
Convertir toda la información inicial disponible (notas, datos del cliente, descripción del proyecto, fotos referenciadas) en una ficha de proyecto estructurada, limpia y útil para los agentes posteriores. Detectar información faltante y formular preguntas abiertas.

### Prompt del agente
Ver archivo `bloque4_prompts.md`, sección "AGENT_BRIEFING".

**Modelo recomendado**: Claude Sonnet (o GPT-4o-mini). Tarea de extracción y estructuración, no requiere razonamiento complejo.
**Temperatura**: 0.2

### Input esperado
```json
{
  "project_id": "uuid",
  "action": "generate | revise",
  "revision_notes": "optional: notas del arquitecto si action=revise"
}
```

Datos leídos de BD:
- `projects.*` + `clients.*` (JOIN)
- `briefings` (versión anterior si existe, para iteración)
- `agent_prompts` (prompt activo)

### Output esperado (del LLM, parseado por Code node)
```json
{
  "summary": "Reforma integral de piso de 85m² en Eixample, Barcelona...",
  "client_needs": [
    {"need": "Abrir cocina al salón", "priority": "alta", "notes": "Quiere barra/isla"},
    {"need": "Segundo baño completo", "priority": "alta", "notes": "Zona pasillo actual"}
  ],
  "objectives": ["Ganar amplitud visual", "Modernizar instalaciones", "Crear segundo baño"],
  "constraints": [
    {"type": "structural", "description": "Pilar entre cocina y salón (verificar si es de carga)"},
    {"type": "budget", "description": "Presupuesto objetivo 60.000€ flexible hasta 70.000€"},
    {"type": "time", "description": "Quiere entrar antes de septiembre"}
  ],
  "style_preferences": {"style": "nórdico-mediterráneo", "colors": "blancos, madera clara", "references": "Le gustan las cocinas abiertas tipo loft"},
  "rooms_affected": [
    {"room": "cocina", "intervention": "Demolición tabique, nueva cocina completa"},
    {"room": "salón", "intervention": "Integración con cocina, nuevo pavimento"},
    {"room": "pasillo", "intervention": "Reducir para crear segundo baño"},
    {"room": "baño 2", "intervention": "Creación completa desde cero"}
  ],
  "missing_info": ["Plano acotado actual", "Fotos del estado actual", "Nota simple del registro"],
  "open_questions": ["¿El tabique entre cocina y salón es de carga?", "¿La comunidad requiere autorización para obras?"]
}
```

Output final del workflow (devuelto al orquestador):
```json
{
  "status": "complete | revision_needed | timeout | error",
  "briefing_id": "uuid",
  "phase": "briefing_done"
}
```

### Herramientas que usa
| Nodo | Función |
|---|---|
| Execute Sub-workflow Trigger | Recibir input |
| Postgres (×3) | Leer proyecto+cliente, leer briefing anterior, leer prompt |
| Code (×2) | Preparar prompt, parsear respuesta |
| Execute Sub-workflow: util_llm_call | Llamar al LLM |
| If | Validar respuesta |
| Postgres (×2) | Guardar briefing, crear approval |
| Execute Sub-workflow: util_notification | Notificar |
| Wait (Form) | Esperar aprobación |
| Switch | Procesar decisión |
| Postgres (×2) | Actualizar briefing y approval |

### Cuándo se ejecuta
- Fase `intake`: primera ejecución para generar el briefing
- Si el arquitecto rechaza y pide revisión: segunda ejecución con `action: "revise"`

### Quién lo invoca
`main_orchestrator` vía Execute Sub-workflow

### Qué aprobación necesita
**Sí — `briefing_review`**. El arquitecto debe validar que el briefing refleja correctamente las necesidades del cliente antes de avanzar. Wait node con formulario:
- Decisión: Aprobar / Pedir revisión
- Notas del arquitecto (texto libre)
- Timeout: 72h

### Errores comunes y control

| Error | Causa | Control |
|---|---|---|
| LLM devuelve texto libre en vez de JSON | Prompt mal formulado o modelo poco capaz | El Code node intenta parsear; si falla, retry con prompt reforzado: "Responde SOLO con JSON válido" |
| `client_needs` vacío | Muy poca información de entrada | Detectar en Code node; si needs.length === 0, marcar en missing_info y devolver con status "incomplete" |
| Briefing demasiado genérico | Datos del proyecto insuficientes | El agente debe listar todo en `missing_info`. El arquitecto al aprobar puede añadir datos y pedir revisión |
| Wait timeout (72h) | Arquitecto no responde | Approval se marca como expired. cron_project_review envía recordatorio |
| Versiones acumuladas sin aprobar | Múltiples iteraciones rechazadas | Si version > 3, alertar: puede haber un problema de calidad del prompt o datos insuficientes |

---

## AGENTE 2: DISTRIBUCIÓN / ANTEPROYECTO (`agent_design`)

### Misión
Proponer 2-3 opciones de redistribución espacial o intervención basadas en el briefing aprobado. Cada opción debe incluir lógica de intervención, pros/contras, complejidad estimada y puntos de conflicto. Consultar la memoria del estudio para usar proyectos similares como referencia.

### Prompt del agente
Ver `bloque4_prompts.md`, sección "AGENT_DESIGN".

**Modelo recomendado**: Claude Opus o GPT-4 (razonamiento espacial complejo, necesita modelo potente).
**Temperatura**: 0.5 (algo de creatividad en las opciones)

### Input esperado
```json
{
  "project_id": "uuid",
  "action": "generate_options | revise"
}
```

Datos de BD: `projects`, `briefings` (aprobado), `memory_cases` (3 similares), `agent_prompts`

### Output esperado (del LLM)
```json
{
  "options": [
    {
      "option_number": 1,
      "title": "Opción A: Cocina abierta con isla central",
      "description": "Se elimina el tabique completo entre cocina y salón...",
      "intervention_logic": "1) Verificar que tabique no es de carga. 2) Demoler. 3) Reubicar instalaciones...",
      "rooms_layout": [
        {"room": "cocina-salón", "area_approx_m2": 35, "notes": "Espacio unificado"},
        {"room": "baño 2", "area_approx_m2": 4.5, "notes": "Ganado del pasillo"}
      ],
      "technical_notes": ["Verificar bajantes en zona nuevo baño", "Posible viga vista si tabique es de carga parcial"],
      "conflict_points": ["Si el tabique es de carga, requiere refuerzo estructural (+coste)"],
      "pros": ["Máxima amplitud", "Cocina social", "Buena ventilación cruzada"],
      "cons": ["Mayor coste de demolición", "Olores de cocina en salón", "Menor privacidad"],
      "estimated_complexity": "media"
    },
    {
      "option_number": 2,
      "title": "Opción B: Cocina semiabierta con cristalera",
      "description": "Se sustituye el tabique por una cristalera corredera...",
      "intervention_logic": "...",
      "rooms_layout": [],
      "technical_notes": [],
      "conflict_points": [],
      "pros": [],
      "cons": [],
      "estimated_complexity": "baja"
    }
  ]
}
```

### Herramientas que usa
Igual estructura que agent_briefing + consulta a `memory_cases`. Wait con formulario para selección de opción (dropdown con las opciones generadas + campo de notas).

### Cuándo se ejecuta
- Fase `briefing_done`

### Quién lo invoca
`main_orchestrator`

### Qué aprobación necesita
**Sí — `design_review`**. El arquitecto selecciona una opción o pide nuevas opciones. Formulario Wait:
- Opción seleccionada (dropdown)
- Notas técnicas del arquitecto
- Acción: Aprobar opción / Pedir nuevas opciones / Pausar

### Errores comunes y control

| Error | Causa | Control |
|---|---|---|
| Solo genera 1 opción | Modelo interpreta mal el prompt | Validar options.length >= 2; si no, retry con instrucción reforzada |
| Opciones demasiado similares | Falta variedad en el prompt | Prompt incluye instrucción explícita: "Las opciones deben ser significativamente diferentes entre sí" |
| Ignora restricciones del briefing | Contexto demasiado largo, modelo pierde detalle | Prompt user_template resalta restricciones en sección separada con "RESTRICCIONES CRÍTICAS:" |
| Propuestas técnicamente inviables | Modelo no es arquitecto | El prompt incluye disclaimers y el approval permite al arquitecto rechazar con notas explicando el problema |
| Memoria devuelve casos irrelevantes | Búsqueda por tipo/zona demasiado genérica | Si no hay casos similares, el agente funciona sin ellos. La memoria es un bonus, no una dependencia |

---

## AGENTE 3: NORMATIVA / TRAMITACIÓN (`agent_regulatory`)

### Misión
Detectar trámites, permisos, licencias y gestiones administrativas potencialmente necesarios según el tipo de intervención, la localización y la propuesta de distribución. Preparar checklist documental, borradores de consulta y pasos a seguir. No confirma nada: detecta y sugiere.

### Prompt del agente
Ver `bloque4_prompts.md`, sección "AGENT_REGULATORY".

**Modelo recomendado**: Claude Sonnet o GPT-4o. Necesita conocimiento normativo general español, pero las decisiones finales son humanas.
**Temperatura**: 0.2 (máxima precisión, mínima invención)

### Input esperado
```json
{
  "project_id": "uuid"
}
```

Datos de BD: `projects` (localización), `design_options` (seleccionada), `briefings`, `agent_prompts`

### Output esperado (del LLM)
```json
{
  "tasks": [
    {
      "task_type": "comunicacion_previa",
      "title": "Comunicación previa de obras al Ayuntamiento de Barcelona",
      "description": "Para reforma interior sin afectación estructural, el Ayuntamiento de Barcelona requiere comunicación previa (no licencia de obra mayor).",
      "entity": "Ajuntament de Barcelona - Districte de l'Eixample",
      "required_docs": ["Plano de estado actual", "Plano de reforma", "Presupuesto de ejecución material", "Documento de identidad", "Justificante de pago de la tasa"],
      "estimated_timeline": "Tramitación inmediata (acuse de recibo). Se puede iniciar obra tras presentar.",
      "estimated_cost": 500.00,
      "priority": "critico",
      "contact_info": {"web": "https://ajuntament.barcelona.cat", "phone": "010", "email": ""},
      "draft_message": "Buen día, me pongo en contacto para consultar los requisitos actualizados para una comunicación previa de obras en un piso del Eixample (reforma interior sin afectación estructural, ~85m²). ¿Podrían confirmarme la documentación necesaria y la tasa vigente? Gracias."
    },
    {
      "task_type": "permiso_comunidad",
      "title": "Autorización de la comunidad de propietarios",
      "description": "Al realizar obras que afectan elementos comunes o generan ruido/molestias, es recomendable notificar a la comunidad y obtener autorización si se afectan elementos comunes.",
      "entity": "Comunidad de Propietarios / Administrador de fincas",
      "required_docs": ["Carta de notificación con descripción de obras y plazo"],
      "estimated_timeline": "Variable. Puede requerir aprobación en junta.",
      "estimated_cost": 0,
      "priority": "importante",
      "contact_info": {},
      "draft_message": ""
    }
  ],
  "general_notes": "Al tratarse de una reforma interior sin afectación estructural aparente, en principio basta con comunicación previa. Si finalmente el tabique es de carga y se requiere intervención estructural, sería necesaria licencia de obra mayor con proyecto técnico visado.",
  "conditional_warnings": ["Si se confirma que el tabique es de carga → necesaria licencia de obra mayor", "Si el inmueble tiene protección patrimonial → trámite adicional ante Patrimonio"]
}
```

### Herramientas que usa
Estructura estándar de agente + Wait webhook (solo si hay trámites críticos que requieran contacto externo).

### Cuándo se ejecuta
- Fase `design_done`

### Quién lo invoca
`main_orchestrator`

### Qué aprobación necesita
**Condicional — `external_contact`**. Solo si el agente detecta trámites con `priority: "critico"` que requieran consulta externa (llamar al ayuntamiento, escribir al administrador de fincas). Si no hay contacto externo necesario, no hay aprobación.

### Errores comunes y control

| Error | Causa | Control |
|---|---|---|
| Inventa normativa que no existe | Alucinación del LLM | Prompt incluye: "Si no estás seguro de un requisito, indícalo como 'A VERIFICAR'. Nunca inventes requisitos normativos." |
| Normativa desactualizada | Conocimiento del modelo obsoleto | Prompt incluye: "Tu conocimiento normativo puede estar desactualizado. Marca todo como 'DETECTADO - CONFIRMAR CON FUENTE OFICIAL'." El status es siempre `detected`, nunca `confirmed` automáticamente |
| No detecta trámites obvios | Contexto insuficiente sobre la intervención | El prompt inyecta el tipo de intervención, localización y propuesta de distribución completa |
| Draft_message inapropiado | Tono o contenido inadecuado | El arquitecto revisa antes de enviar. El agente NUNCA envía nada |

**Advertencia crítica**: este agente es el que más riesgo tiene de dar información incorrecta. La normativa municipal y autonómica varía mucho y cambia con frecuencia. El prompt debe insistir repetidamente en que todo es "potencialmente necesario" y debe ser confirmado por el profesional. La decisión normativa final es SIEMPRE humana.

---

## AGENTE 4: DOCUMENTAL (`agent_documents`)

### Misión
Mantener el expediente documental organizado. Clasificar documentos, detectar faltantes según la fase del proyecto, y mantener la estructura de Google Drive limpia.

### Prompt del agente
Este agente **no usa LLM en el MVP**. Su lógica es determinista: clasificación por reglas (extensión, nombre de archivo) y checklist de documentos esperados por tipo de proyecto y fase.

**Modelo**: Ninguno en MVP. V2: LLM para clasificación inteligente de contenido.
**Temperatura**: N/A

### Input esperado
```json
{
  "project_id": "uuid",
  "trigger_agent": "agent_briefing | agent_design | agent_memory | manual"
}
```

### Output esperado
```json
{
  "status": "complete",
  "new_registered": 3,
  "missing_detected": ["plano_acotado", "fotos_estado_actual"],
  "total_docs": 12
}
```

### Herramientas que usa
| Nodo | Función |
|---|---|
| Postgres (×2) | Leer proyecto, leer documentos existentes |
| Google Drive: List Files | Listar archivos en carpeta del proyecto |
| Code | Comparar Drive vs BD, clasificar por reglas, detectar faltantes |
| If | ¿Hay nuevos archivos? ¿Hay faltantes? |
| Postgres | Insertar nuevos registros, log warnings |

### Reglas de clasificación (Code node)

```javascript
function classifyFile(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const nameLower = fileName.toLowerCase();
  
  if (['dwg', 'dxf'].includes(ext) || nameLower.includes('plano')) return 'plano';
  if (['jpg', 'jpeg', 'png', 'heic'].includes(ext) || nameLower.includes('foto')) return 'foto';
  if (nameLower.includes('presupuesto') || nameLower.includes('oferta')) return 'presupuesto';
  if (nameLower.includes('contrato')) return 'contrato';
  if (nameLower.includes('informe') || nameLower.includes('certificado')) return 'informe';
  if (nameLower.includes('acta')) return 'acta';
  if (nameLower.includes('factura')) return 'factura';
  if (ext === 'pdf') return 'informe';
  return 'otro';
}
```

### Checklist de documentos esperados (Code node)

```javascript
const expectedDocs = {
  intake: ['foto_estado_actual'],
  briefing_done: ['foto_estado_actual', 'plano_acotado'],
  design_done: ['foto_estado_actual', 'plano_acotado', 'plano_propuesta'],
  analysis_done: ['foto_estado_actual', 'plano_acotado', 'plano_propuesta', 'listado_materiales'],
  costs_done: ['foto_estado_actual', 'plano_acotado', 'plano_propuesta', 'estimacion_costes'],
  trades_done: ['foto_estado_actual', 'plano_acotado', 'plano_propuesta', 'presupuesto_oficios'],
  proposal_done: ['propuesta_comercial'],
};
```

### Cuándo se ejecuta
- Transversal: el orquestador puede invocarlo después de cualquier agente que genere archivos.
- En el MVP, se invoca explícitamente tras `agent_design`, `agent_proposal` y `agent_memory`.

### Quién lo invoca
`main_orchestrator` o `agent_memory`

### Qué aprobación necesita
Ninguna. Es un agente de mantenimiento.

### Errores comunes y control

| Error | Causa | Control |
|---|---|---|
| Google Drive API rate limit | Demasiadas llamadas consecutivas | Retry nativo del nodo Google Drive (3 intentos, backoff) |
| Archivo en Drive no clasificable | Nombre genérico sin pistas | Clasificar como 'otro' + tag 'sin_clasificar' |
| Carpeta del proyecto no existe | init_new_project no la creó | If: si carpeta no existe → llamar util_file_organizer primero |

---

## AGENTE 5: MATERIALES / PROVEEDORES (`agent_materials`)

### Misión
Buscar materiales, acabados, referencias y precios para el proyecto. Proponer alternativas por gama. Alimentar al agente de costes con datos estimados. Consultar la memoria del estudio para reutilizar materiales que funcionaron bien.

### Prompt del agente
Ver `bloque4_prompts.md`, sección "AGENT_MATERIALS".

**Modelo recomendado**: Claude Sonnet o GPT-4o. Conocimiento amplio de materiales de construcción y reforma.
**Temperatura**: 0.3

### Input esperado
```json
{
  "project_id": "uuid"
}
```

Datos de BD: `projects`, `briefings`, `design_options` (seleccionada), `memory_cases` (materials_notable), `agent_prompts`

### Output esperado (del LLM)
```json
{
  "materials": [
    {
      "category": "pavimento",
      "name": "Porcelánico imitación madera Marazzi Treverkmore",
      "brand": "Marazzi",
      "model_ref": "MMYR",
      "unit_price": 32.50,
      "unit": "m2",
      "quantity_estimated": 65,
      "quality_tier": "media",
      "room_area": "toda la vivienda excepto baños",
      "notes": "Formato 20x120. Buena relación calidad-precio.",
      "alternatives": [
        {
          "name": "Porcelánico Porcelanosa Ston-Ker",
          "unit_price": 55.00,
          "quality_tier": "alta",
          "notes": "Gama superior, mejor acabado"
        },
        {
          "name": "Porcelánico Leroy Merlin Artens",
          "unit_price": 18.90,
          "quality_tier": "economica",
          "notes": "Opción económica aceptable"
        }
      ]
    }
  ],
  "summary": {
    "total_estimated": 28500,
    "by_category": {"pavimento": 8200, "sanitarios": 3500, "griferia": 1800, "cocina": 7500, "otros": 7500},
    "notes": "Estimación basada en gama media. Se incluyen alternativas por categoría."
  }
}
```

### Cuándo se ejecuta
- Fase `design_done` (tras selección de opción de diseño)

### Quién lo invoca
`main_orchestrator`

### Qué aprobación necesita
Ninguna en MVP. Los materiales se sugieren y el arquitecto los revisa al validar la propuesta final. En V2 se puede añadir aprobación si se quiere que el arquitecto valide materiales antes de estimar costes.

### Errores comunes y control

| Error | Causa | Control |
|---|---|---|
| Precios inventados o desactualizados | LLM no tiene precios reales actualizados | Prompt incluye: "Indica precios estimados basados en mercado español 2024-2025. Marca como ESTIMADO." El agente de costes aplicará un margen de seguridad |
| Marcas/modelos inexistentes | Alucinación | Prompt: "Solo sugiere marcas y modelos que existan realmente en el mercado español. Si no estás seguro, indica solo la categoría y gama sin marca específica." |
| Cantidades incorrectas | Cálculo erróneo sobre superficie | Code node valida: quantity × unit_price = total. Si la desviación es > 20% respecto a superficie disponible, warning |
| Demasiados materiales | Sobrecarga de datos | Limitar en prompt: "Máximo 5 materiales por categoría incluyendo alternativas" |

---

## AGENTE 6: COSTES (`agent_costs`)

### Misión
Convertir la propuesta de distribución + materiales + trámites en una estimación económica desglosada. Detectar si entra en presupuesto. Proponer ajustes si no. Generar escenarios alternativos (económico / estándar / premium).

### Prompt del agente
Ver `bloque4_prompts.md`, sección "AGENT_COSTS".

**Modelo recomendado**: Claude Opus o GPT-4. Razonamiento numérico complejo con múltiples fuentes de datos.
**Temperatura**: 0.2 (precisión máxima en números)

### Input esperado
```json
{
  "project_id": "uuid"
}
```

Datos de BD: `projects` (budget_target), `design_options`, `material_items`, `regulatory_tasks`, `memory_cases` (cost_final de similares), `agent_prompts`

### Output esperado (del LLM)
```json
{
  "total_estimated": 62400,
  "breakdown": [
    {"partida": "Demoliciones", "importe": 3200, "notes": "Tabiquería cocina-salón + baño viejo"},
    {"partida": "Albañilería", "importe": 8500, "notes": "Tabiques nuevos + remates"},
    {"partida": "Fontanería", "importe": 4800, "notes": "Nuevo baño completo + reubicación cocina"},
    {"partida": "Electricidad", "importe": 3900, "notes": "Nuevo cuadro + redistribución"},
    {"partida": "Carpintería", "importe": 4200, "notes": "Puertas paso + armario empotrado"},
    {"partida": "Pavimentos y revestimientos", "importe": 8200, "notes": "Porcelánico toda la vivienda + baños"},
    {"partida": "Pintura", "importe": 2200, "notes": "Toda la vivienda"},
    {"partida": "Cocina (mobiliario + instalación)", "importe": 9500, "notes": "Cocina completa con electrodomésticos gama media"},
    {"partida": "Sanitarios y grifería", "importe": 5300, "notes": "2 baños completos"},
    {"partida": "Honorarios técnicos", "importe": 4500, "notes": "Proyecto + dirección de obra"},
    {"partida": "Tasas y licencias", "importe": 500, "notes": "Comunicación previa"},
    {"partida": "Imprevistos (10%)", "importe": 5500, "notes": "Reserva estándar sobre PEM"},
    {"partida": "Gestión de residuos", "importe": 1100, "notes": "Contenedor + transporte"}
  ],
  "scenarios": {
    "economico": {"total": 48000, "notes": "Materiales gama económica, cocina básica, sin armarios empotrados"},
    "estandar": {"total": 62400, "notes": "La estimación actual"},
    "premium": {"total": 82000, "notes": "Materiales gama alta, cocina premium, domótica básica"}
  },
  "adjustments_if_over": [
    "Reducir gama de pavimento (ahorro ~3.000€)",
    "Cocina estándar en vez de con isla (ahorro ~2.500€)",
    "Mantener un solo baño reformado (ahorro ~5.000€)"
  ],
  "assumptions": [
    "Tabique cocina-salón NO es de carga (si lo es: +3.000-5.000€ en refuerzo estructural)",
    "No hay amianto ni materiales peligrosos",
    "Instalaciones eléctricas y fontanería requieren renovación completa"
  ],
  "risk_notes": "Principal riesgo: estado oculto de instalaciones. Recomendable partida de imprevistos del 10-15%."
}
```

### Cuándo se ejecuta
- Fase `analysis_done` (tras normativa y materiales)

### Quién lo invoca
`main_orchestrator`

### Qué aprobación necesita
Ninguna directa. El resultado se incorpora a la propuesta, que sí tiene aprobación. El orquestador emite una alerta si `deviation_status` es `over_budget` o `critical_over`.

### Errores comunes y control

| Error | Causa | Control |
|---|---|---|
| Total no cuadra con desglose | LLM suma mal | Code node recalcula: sum(breakdown.importe) y compara con total_estimated. Si difiere > 5%, corregir y logear warning |
| Falta partida de imprevistos | LLM la omite | Code node verifica que exista partida "imprevistos". Si no, añadir automáticamente al 10% |
| Precios muy alejados del mercado | Alucinación numérica | Comparar con memory_cases. Si coste/m² difiere > 50% de la media de proyectos similares, warning |
| No genera escenarios | Modelo ignora esa instrucción | Si scenarios es null, retry con prompt reforzado |
| deviation_pct calculado mal | Error en Code node | Fórmula explícita en Code: `((total - budget) / budget) * 100`, con manejo de budget = 0 o null |

---

## AGENTE 7: OFICIOS Y PRESUPUESTOS (`agent_trades`)

### Misión
Detectar oficios necesarios, preparar paquetes de consulta claros con toda la información que el oficio necesita para presupuestar, redactar mensajes listos para enviar, y (tras aprobación) facilitar la comparativa de presupuestos recibidos. Un solo agente para TODOS los oficios.

### Prompt del agente
Ver `bloque4_prompts.md`, sección "AGENT_TRADES".

**Modelo recomendado**: Claude Sonnet. Tarea de estructuración y redacción, no requiere razonamiento complejo.
**Temperatura**: 0.3

### Input esperado
```json
{
  "project_id": "uuid",
  "action": "prepare_packages | compare_quotes"
}
```

### Output esperado — `prepare_packages` (del LLM)
```json
{
  "trades_needed": [
    {
      "trade_type": "albanileria",
      "scope_description": "Demolición de tabiquería entre cocina y salón (aprox 3.5m lineales × 2.7m alto). Construcción de nuevo tabique para segundo baño (aprox 6m lineales). Recrecidos, remates y ayudas a instalaciones.",
      "scope_details": [
        {"item": "Demolición tabiquería", "quantity": "9.5 m²", "notes": "Tabique ladrillo hueco doble"},
        {"item": "Nueva tabiquería", "quantity": "16 m²", "notes": "Ladrillo o pladur (a definir)"},
        {"item": "Recrecidos y soleras", "quantity": "4.5 m²", "notes": "Zona nuevo baño"},
        {"item": "Ayudas a instalaciones", "quantity": "partida", "notes": "Rozas, tapados, pasos"}
      ],
      "required_info_for_trade": ["Plano con cotas", "Fotos del estado actual", "Descripción de materiales de acabado"],
      "draft_message": "Buenos días, somos [Estudio]. Estamos preparando una reforma integral de un piso de 85m² en el Eixample de Barcelona y necesitamos presupuesto para los trabajos de albañilería que le detallo a continuación:\n\n- Demolición de tabiquería entre cocina y salón (aprox 9.5 m²)\n- Nueva tabiquería para creación de segundo baño (aprox 16 m²)\n- Recrecidos y soleras en zona nuevo baño (4.5 m²)\n- Ayudas a instalaciones (rozas, tapados, pasos)\n\nAdjuntamos planos y fotos del estado actual.\n\n¿Podrían darnos un presupuesto desglosado? El plazo estimado de inicio sería [FECHA].\n\nGracias.",
      "message_channel": "whatsapp"
    }
  ]
}
```

### Output esperado — `compare_quotes` (del LLM)
```json
{
  "comparisons": [
    {
      "trade_type": "albanileria",
      "quotes_compared": 3,
      "best_value": "Reformas López",
      "cheapest": "Obras Rápidas S.L.",
      "comparison_notes": "Reformas López es un 10% más caro que el más barato pero incluye gestión de residuos y tiene mejor valoración en proyectos anteriores (4/5 en memoria del estudio). Obras Rápidas excluye retirada de escombro.",
      "recommendation": "Reformas López por relación calidad-precio y experiencia previa positiva."
    }
  ]
}
```

### Cuándo se ejecuta
- Fase `costs_done` con action `prepare_packages`
- Post-envío manual (cuando llegan respuestas) con action `compare_quotes`

### Quién lo invoca
`main_orchestrator`

### Qué aprobación necesita
**Sí — `trade_request_send`**. Antes de que el arquitecto envíe las solicitudes a los oficios, debe aprobar qué oficios contactar y con qué mensaje. Wait con formulario:
- Checkboxes de oficios a enviar
- Campo de contactos por oficio
- Acción: Aprobar envío / Editar primero / Cancelar

### Errores comunes y control

| Error | Causa | Control |
|---|---|---|
| No detecta un oficio necesario | Alcance no suficientemente detallado | El Code node compara oficios detectados con la lista de partidas del cost_estimate. Si hay partidas sin oficio, warning |
| Draft message con datos incorrectos | LLM inventa medidas | Las medidas se inyectan desde design_options y material_items. El prompt pide usar solo los datos proporcionados |
| Comparativa sesgada | LLM favorece arbitrariamente | Prompt: "Basa la comparativa en hechos: precio, inclusiones, exclusiones, plazo, experiencia previa. No hagas juicios subjetivos." |
| Demasiados oficios para un proyecto simple | Sobredetección | Prompt incluye el tipo de proyecto. Para una pintura simple no detecta fontanería |

---

## AGENTE 8: PROPUESTA Y PRESUPUESTO (`agent_proposal`)

### Misión
Montar la propuesta comercial final combinando toda la información generada por los demás agentes. El resultado debe ser un documento entendible para el cliente, vendible, con alcance claro, precio, exclusiones y advertencias.

### Prompt del agente
Ver `bloque4_prompts.md`, sección "AGENT_PROPOSAL".

**Modelo recomendado**: Claude Opus o GPT-4. Redacción profesional + síntesis de datos complejos.
**Temperatura**: 0.4

### Input esperado
```json
{
  "project_id": "uuid"
}
```

Datos de BD: TODAS las tablas del proyecto (briefing, design, regulatory, materials, costs, trades + quotes)

### Output esperado (del LLM)
```json
{
  "title": "Propuesta de Reforma Integral — Piso Calle Mallorca 245, 3º2ª, Barcelona",
  "executive_summary": "Reforma integral de vivienda de 85m² que incluye la apertura de cocina al salón, creación de segundo baño completo, renovación de todas las instalaciones y acabados de gama media. Duración estimada: 10-12 semanas.",
  "scope_description": "La intervención comprende: demolición de tabiquería entre cocina y salón, creación de nuevo baño completo aprovechando zona de pasillo, renovación completa de instalaciones de fontanería y electricidad, nuevos pavimentos y revestimientos en toda la vivienda, nueva cocina completa con mobiliario e isla central, pintura completa y carpintería interior.",
  "phases": [
    {"phase": 1, "name": "Demoliciones y preparación", "duration": "1 semana"},
    {"phase": 2, "name": "Instalaciones (fontanería + electricidad)", "duration": "2 semanas"},
    {"phase": 3, "name": "Albañilería y tabiquería", "duration": "1.5 semanas"},
    {"phase": 4, "name": "Revestimientos y pavimentos", "duration": "2 semanas"},
    {"phase": 5, "name": "Carpintería y cocina", "duration": "1.5 semanas"},
    {"phase": 6, "name": "Pintura y remates", "duration": "1 semana"},
    {"phase": 7, "name": "Limpieza final y entrega", "duration": "0.5 semanas"}
  ],
  "total_price": 62400,
  "price_breakdown": [
    {"partida": "Demoliciones y gestión de residuos", "importe": 4300},
    {"partida": "Albañilería", "importe": 8500},
    {"partida": "Fontanería", "importe": 4800},
    {"partida": "Electricidad", "importe": 3900}
  ],
  "exclusions": [
    "Mobiliario (excepto cocina y armarios empotrados si se incluyen)",
    "Electrodomésticos (excepto los incluidos en cocina)",
    "Persianas y ventanas exteriores",
    "Trabajos en zonas comunes del edificio"
  ],
  "inclusions": [
    "Dirección de obra por arquitecto técnico",
    "Gestión de comunicación previa ante el Ayuntamiento",
    "Gestión de residuos y contenedor"
  ],
  "payment_conditions": "30% a la firma del contrato, 40% al completar fase de instalaciones, 30% a la entrega final de la obra.",
  "validity_days": 30,
  "warnings": [
    "Si el tabique cocina-salón resulta ser de carga, se requerirá refuerzo estructural con sobrecoste estimado de 3.000-5.000€",
    "Posibles imprevistos en el estado oculto de instalaciones"
  ],
  "optional_items": [
    {"item": "Suelo radiante en baños", "price": 2800},
    {"item": "Domótica básica (iluminación + persianas)", "price": 3500},
    {"item": "Upgrade cocina a gama alta", "price": 4000}
  ]
}
```

### Cuándo se ejecuta
- Fase `trades_done`

### Quién lo invoca
`main_orchestrator`

### Qué aprobación necesita
**Sí — doble aprobación**:
1. `proposal_review`: revisión interna del contenido
2. `proposal_send`: confirmación para enviar al cliente

### Errores comunes y control

| Error | Causa | Control |
|---|---|---|
| Total de propuesta ≠ total de cost_estimate | LLM redondea o modifica | Code node compara. Si difiere > 2%, forzar el total del cost_estimate |
| Exclusiones insuficientes | Omite exclusiones importantes | Prompt incluye lista de exclusiones estándar que siempre deben revisarse |
| Propuesta demasiado larga | Modelo se extiende | Prompt: "Máximo 2 páginas de contenido. Sé conciso y profesional" |
| Tono inadecuado | Demasiado técnico o demasiado comercial | Prompt especifica: "Tono profesional pero accesible. El cliente no es técnico" |

---

## AGENTE 9: PLANIFICADOR (`agent_planner`)

### Misión
Transformar el proyecto aprobado en un plan operativo con fases, tareas, dependencias, hitos y cronograma lógico. No ejecuta: planifica.

### Prompt del agente
Ver `bloque4_prompts.md`, sección "AGENT_PLANNER".

**Modelo recomendado**: Claude Sonnet o GPT-4o. Tarea lógica/secuencial.
**Temperatura**: 0.2

### Input esperado
```json
{
  "project_id": "uuid"
}
```

Datos de BD: `projects`, `proposals` (aceptada), `design_options`, `trade_requests` (selected), `regulatory_tasks` (confirmed), `agent_prompts`

### Output esperado (del LLM)
```json
{
  "total_duration_days": 55,
  "phases": [
    {
      "phase": 1,
      "name": "Trámites y preparación",
      "duration_days": 5,
      "tasks": ["Presentar comunicación previa", "Contratar contenedor", "Proteger zonas comunes"],
      "trades": [],
      "depends_on": null,
      "milestone": "Inicio de obra autorizado"
    },
    {
      "phase": 2,
      "name": "Demoliciones",
      "duration_days": 5,
      "tasks": ["Demoler tabique cocina-salón", "Demoler baño viejo", "Retirar pavimento afectado", "Gestión de escombros"],
      "trades": ["albanileria"],
      "depends_on": [1],
      "milestone": "Vivienda lista para nueva distribución"
    }
  ],
  "milestones": [
    {"name": "Inicio de obra", "at_end_of_phase": 1},
    {"name": "Instalaciones completas", "at_end_of_phase": 4},
    {"name": "Entrega final", "at_end_of_phase": 8}
  ],
  "critical_path": [2, 3, 4, 6],
  "blockers": [
    "Si la comunicación previa tarda más de lo previsto, todo se retrasa",
    "Entrega de cocina: confirmar plazo con proveedor (habitualmente 3-4 semanas)"
  ],
  "dependencies_notes": "Fontanería y electricidad pueden solaparse parcialmente. Pavimentos solo tras finalizar todas las instalaciones empotradas."
}
```

### Cuándo se ejecuta
- Fase `approved` (tras aceptación del cliente)

### Quién lo invoca
`main_orchestrator`

### Qué aprobación necesita
Ninguna en MVP. El plan es informativo y el arquitecto lo ajusta manualmente si es necesario.

### Errores comunes y control

| Error | Causa | Control |
|---|---|---|
| Dependencias circular | LLM genera fase que depende de sí misma | Code node valida DAG (directed acyclic graph). Si detecta ciclo, warning |
| Duración irreal | Muy optimista o pesimista | Comparar con memory_cases (duration_actual_days). Si difiere > 40%, warning |
| Oficios no disponibles en la fecha | Información externa no disponible | Prompt: "Genera el plan asumiendo disponibilidad normal. Marca como CONFIRMAR los plazos de entrega de cocina y elementos a medida" |

---

## AGENTE 10: MEMORIA DEL ESTUDIO (`agent_memory`)

### Misión
Extraer y guardar las lecciones aprendidas, patrones, decisiones clave y métricas del proyecto completado. Construir la base de conocimiento que hace al estudio más eficiente con cada proyecto.

### Prompt del agente
Ver `bloque4_prompts.md`, sección "AGENT_MEMORY".

**Modelo recomendado**: Claude Sonnet. Tarea de síntesis y extracción.
**Temperatura**: 0.3

### Input esperado
```json
{
  "project_id": "uuid"
}
```

Datos de BD: TODAS las tablas del proyecto + `activity_log` (resumen de actividad)

### Output esperado (del LLM)
```json
{
  "summary": "Reforma integral de piso 85m² en Eixample, Barcelona. Cocina abierta al salón con isla, creación de segundo baño, renovación completa. Duración real: 12 semanas. Coste final: 65.800€ (sobrecoste 5.4% por refuerzo estructural imprevisto).",
  "scope_summary": "Demolición tabiquería, nuevo baño, renovación instalaciones, pavimentos, cocina nueva, pintura completa.",
  "decisions_made": [
    {"decision": "Abrir cocina completamente en vez de cristalera", "reason": "Cliente priorizó amplitud. El tabique no era de carga, facilitó la ejecución"},
    {"decision": "Porcelánico gama media en vez de alta", "reason": "Ajuste presupuestario. El resultado fue satisfactorio"}
  ],
  "lessons_learned": [
    "Siempre verificar si los tabiques son de carga ANTES de presupuestar, no asumir",
    "El plazo de entrega de cocinas a medida fue 5 semanas en vez de 3. Pedir confirmación por escrito"
  ],
  "problems_encountered": [
    {"problem": "Tabique resultó ser parcialmente de carga", "resolution": "Refuerzo con viga metálica. Sobrecoste 3.400€", "prevention": "Cata previa o estudio estructural en fase de diseño"}
  ],
  "patterns": [
    {"pattern": "Pisos del Eixample pre-1970 suelen tener tabiques de carga ocultos entre cocina y salón", "confidence": "media"},
    {"pattern": "Comunicación previa en Barcelona Eixample se procesa en 1-2 días hábiles si la documentación es completa", "confidence": "alta"}
  ],
  "trades_used": [
    {"trade": "albanileria", "provider": "Reformas López", "rating": 4, "notes": "Buen trabajo, cumplió plazos"},
    {"trade": "fontaneria", "provider": "Fontaner BCN", "rating": 5, "notes": "Excelente. Resolvió imprevisto de bajantes rápido"}
  ],
  "tags": ["reforma_integral", "eixample", "barcelona", "cocina_abierta", "segundo_baño", "piso_85m2"]
}
```

### Cuándo se ejecuta
- Fase `planning_done` (cierre del proyecto)

### Quién lo invoca
`main_orchestrator`

### Qué aprobación necesita
Ninguna. La memoria se escribe automáticamente. Es un registro interno del estudio.

### Errores comunes y control

| Error | Causa | Control |
|---|---|---|
| Datos finales incompletos | Proyecto cerrado sin registrar costes reales | Si cost_final no está disponible, usar cost_estimated y marcar como "sin datos reales" |
| Lecciones genéricas | LLM genera lecciones vagas ("planificar bien") | Prompt: "Las lecciones deben ser específicas y accionables. Ejemplo: 'En pisos del Eixample, verificar carga de tabiques con cata antes de presupuestar'" |
| Tags insuficientes | Pocos tags para búsqueda futura | Code node añade tags automáticos: project_type, location_city, property_type |

---

## RESUMEN DE TODOS LOS AGENTES

| # | Agente | Modelo MVP | Temp | Usa LLM | Aprobación | Tablas que escribe |
|---|---|---|---|---|---|---|
| 0 | Orquestador | — | — | No | No | projects, activity_log |
| 1 | Briefing | Sonnet | 0.2 | Sí | briefing_review | briefings, approvals |
| 2 | Diseño | Opus/GPT-4 | 0.5 | Sí | design_review | design_options, approvals |
| 3 | Normativa | Sonnet | 0.2 | Sí | external_contact (condicional) | regulatory_tasks, approvals |
| 4 | Documental | — | — | No (MVP) | No | documents |
| 5 | Materiales | Sonnet | 0.3 | Sí | No | material_items |
| 6 | Costes | Opus/GPT-4 | 0.2 | Sí | No (alerta si sobrecoste) | cost_estimates |
| 7 | Oficios | Sonnet | 0.3 | Sí | trade_request_send | trade_requests, approvals, external_quotes |
| 8 | Propuesta | Opus/GPT-4 | 0.4 | Sí | proposal_review + proposal_send | proposals, approvals |
| 9 | Planificador | Sonnet | 0.2 | Sí | No | project_plans |
| 10 | Memoria | Sonnet | 0.3 | Sí | No | memory_cases |

### Estimación de coste LLM por proyecto completo (MVP)

| Agente | Llamadas LLM | Tokens aprox (in+out) | Modelo | Coste estimado |
|---|---|---|---|---|
| Briefing | 1-2 | 3K+2K | Sonnet | ~0.03€ |
| Diseño | 1-2 | 5K+4K | Opus/GPT-4 | ~0.30€ |
| Normativa | 1 | 3K+2K | Sonnet | ~0.03€ |
| Materiales | 1 | 4K+3K | Sonnet | ~0.04€ |
| Costes | 1-2 | 6K+4K | Opus/GPT-4 | ~0.35€ |
| Oficios (prep) | 1 | 5K+4K | Sonnet | ~0.05€ |
| Oficios (compare) | 1 | 4K+2K | Sonnet | ~0.03€ |
| Propuesta | 1-2 | 8K+5K | Opus/GPT-4 | ~0.45€ |
| Planificador | 1 | 4K+3K | Sonnet | ~0.04€ |
| Memoria | 1 | 6K+3K | Sonnet | ~0.05€ |
| **TOTAL** | **10-15** | **~60K tokens** | Mixto | **~1.40€** |

Coste estimado por proyecto: **1-2€ en LLM**. Con 50 proyectos al año: **50-100€/año en LLM**.

Estos números asumen precios de API de Anthropic/OpenAI a marzo 2026. Si los precios bajan (tendencia), el coste será aún menor.

---

*Documento: BLOQUE 4 — Detalle de Implementación por Agente*
*Siguiente: archivo complementario con los prompts completos*
