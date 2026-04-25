# RD 1627/1997 — Disposiciones mínimas de seguridad y salud en obras de construcción

## Estado

- **Mantiene:** Claude (base) + Damián (casos reales)
- **Fuente oficial:** [BOE RD 1627/1997](https://www.boe.es/buscar/act.php?id=BOE-A-1997-22614) de 24 de octubre.
- **Última revisión:** 2026-04-25
- **Consumido por:** `agent_safety_plan`

## Qué regula

Disposiciones mínimas de seguridad y salud aplicables a las obras de construcción en España. Desarrolla la Ley 31/1995 de Prevención de Riesgos Laborales en el ámbito específico de la construcción.

## Documentación obligatoria por proyecto

### EBSS — Estudio Básico de Seguridad y Salud (art. 4.2)

**Obligatorio cuando NO se den las circunstancias del PSS** (la mayoría de las reformas de vivienda).

Contenido mínimo:
- Memoria descriptiva de riesgos.
- Pliego de condiciones.
- Identificación de fases con riesgos especiales.

**Quién lo redacta**: técnico competente designado por el promotor (arquitecto o arquitecto técnico).

### PSS — Plan de Seguridad y Salud (art. 7)

**Obligatorio cuando se cumple AL MENOS uno** de los supuestos del art. 4.1:

| Supuesto | Umbral |
|---|---|
| (a) Presupuesto de ejecución material (PEM) | > 450.000 € |
| (b) Duración estimada con trabajadores simultáneos | > 30 días Y > 20 trabajadores simultáneos en algún momento |
| (c) Volumen de mano de obra | > 500 jornadas trabajador |
| (d) Tipo de obra especial | Túneles, galerías, conducciones subterráneas, presas |

Contenido mínimo:
- Memoria descriptiva con análisis de los procesos y riesgos.
- Pliego de condiciones con exigencias preventivas.
- Mediciones y presupuesto de las medidas de prevención.
- Planos de la ubicación de protecciones y detalles.

**Quién lo redacta**: lo elabora el contratista, a partir del EBSS o ESS, antes del inicio de los trabajos.

### Para reforma típica de vivienda 70-90 m² < 450.000 €

→ **EBSS**. La mayoría de proyectos de Damián caen en esta categoría.

## Coordinador de Seguridad y Salud (CSS)

Designado por el promotor (art. 3 RD 1627/1997). Es **obligatorio** si:
- Hay más de un contratista en obra (típico — siempre hay varios gremios).

Funciones del CSS (art. 9):
- Coordinar las actividades preventivas.
- Aprobar el Plan de Seguridad y Salud.
- Organizar la coordinación de actividades empresariales (art. 24 LPRL).
- Coordinar las acciones y funciones de control de la aplicación correcta de los métodos.
- Adoptar las medidas necesarias para que solo personas autorizadas accedan a la obra.

**En reforma de vivienda** habitualmente el arquitecto técnico Damián asume CSS además de DEO.

Honorarios CSS típicos: 300-600 € fijo o 1-1.5% PEM.

## Estructura del EBSS — qué genera `agent_safety_plan`

El agente devuelve un JSON con la siguiente estructura, alineada con los requisitos legales:

```json
{
  "document_type": "EBSS|PSS",
  "document_type_justification": "...",
  "project_summary": "...",
  "applicable_regulations": ["RD 1627/1997", "Ley 31/1995", ...],
  "phases_with_risks": [
    {
      "phase_name": "Demolición",
      "phase_order": 1,
      "workers_simultaneous": 3,
      "specific_risks": [
        {
          "risk": "Caída a distinto nivel",
          "severity": "alta",
          "probability": "media",
          "preventive_measures": [...],
          "collective_protections": [...],
          "epis_required": [...]
        }
      ]
    }
  ],
  "general_collective_protections": [...],
  "general_epis": [...],
  "emergency_protocol": {...},
  "hygiene_facilities": [...],
  "simultaneous_activities": [...],
  "training_required": [...],
  "medical_surveillance": "...",
  "recommendations_to_architect": [...]
}
```

## Riesgos típicos por fase de reforma de vivienda

(extracto del prompt del agente — añadir casos reales aquí)

### Demolición
- **Caída a distinto nivel** (forjados antiguos): arnés cuando borde >2m, casco UNE-EN 397, calzado S3, gafas; barandillas perimetrales, redes.
- **Atrapamiento por desplome**: apuntalamiento previo si muros portantes; casco.
- **Inhalación de polvo (sílice, amianto)**: mascarilla FFP3 mínimo si sospecha de amianto; humedecer escombros.
- **AMIANTO** (edificios pre-2002): si bajantes o cubierta de fibrocemento → DETENER y empresa **RERA autorizada** para retirada antes de continuar.

### Obra civil estructural
- **Caída de cargas en izado**: acordonar zona, no transitar bajo cargas suspendidas, casco.
- **Sobreesfuerzos**: medios mecánicos para >25 kg.
- **Apuntalamiento mal ejecutado**: cálculo previo por técnico, supervisión continua.

### Instalaciones eléctricas (REBT)
- **Contactos eléctricos directos/indirectos**: desconectar instalación existente antes de manipular, comprobar ausencia tensión, guantes dieléctricos para BT.
- Solo personal cualificado IBTE.

### Instalaciones fontanería/climatización
- **Cortes con herramienta**: guantes anticorte.
- **Quemaduras soldadura**: guantes cuero, gafas, protector facial.
- **Trabajos en altura** (climatización exterior): arnés + línea vida si >2m.

### Tabiquería pladur
- **Inhalación polvo yeso**: mascarilla FFP1.
- **Cortes con cutter**: guantes anticorte.
- **Sobreesfuerzos**: medios mecánicos para placas grandes.

### Solados y alicatados
- **Inhalación polvo cemento/cerámica**: mascarilla FFP1, gafas.
- **Posturas forzadas (rodillas)**: rodilleras, alternar trabajadores.
- **Cortes con radial**: gafas, protector facial, calzado S3, guantes.

### Carpintería
- **Cortes con sierra/router**: gafas, protección auditiva, guantes anticorte (excepto sierra).
- **Caída objetos al instalar**: casco.

### Pintura
- **Inhalación disolventes**: mascarilla con filtro orgánico A2, ventilación forzada.
- **Salpicaduras**: gafas, ropa adecuada.

## Concurrencia de actividades (art. 24 LPRL + RD 171/2004)

Cuando varias empresas (gremios) coinciden en obra, deben coordinarse para:
- No interferir entre actividades incompatibles.
- Compartir información de riesgos.
- Designar un encargado de coordinación (típicamente el CSS).

Casos típicos en reforma:
- **Eléctricas + fontanería simultáneas**: coordinación para no inutilizar circuitos en uso.
- **Solados + carpintería**: protección de pavimentos con plásticos hasta finalización.
- **Pintura + cualquier otra fase posterior**: pintura va casi al final, todo lo demás debe estar terminado.

## Normativa aplicable obligatoria

A citar siempre en `applicable_regulations`:

- **RD 1627/1997** — disposiciones mínimas seguridad obras construcción.
- **Ley 31/1995 PRL** — Ley de Prevención de Riesgos Laborales.
- **RD 39/1997** — servicios de prevención.
- **RD 773/1997** — equipos de protección individual.
- **RD 485/1997** — señalización de seguridad.
- **RD 487/1997** — manipulación manual de cargas.
- **Convenio General Construcción** — convenio sectorial vigente.

## Notas para Damián (espacio para tu experiencia)

```
## Mis casos reales de seguridad

### Proyecto X (anonimizado)
- Incidencia: ...
- Origen: ...
- Solución: ...
- Lección aprendida: ...
```

Cuando rellenes esta sección, los casos reales alimentan el prompt del agente para mejorar futuras generaciones.

## Cómo se invoca `agent_safety_plan`

Vía Execute Sub-workflow (n8n) o webhook directo. Input mínimo:

```json
{ "project_id": "uuid del proyecto" }
```

El agente:
1. Carga briefing + design + trade_assignments + project_plan.
2. Lee su prompt_system de `agent_prompts`.
3. Construye prompt_user con datos del proyecto.
4. Llama a util_llm_call (gpt-4o).
5. Parsea respuesta JSON.
6. Inserta draft en `safety_plans` con `content_json` completo.
7. Crea Google Doc con título "EBSS - {project_name}".
8. Inserta el contenido formateado en el Doc.
9. Actualiza `safety_plans.google_doc_id` y `google_doc_url`.

**Output**: `{ status, safety_plan_id, google_doc_url, document_type, project_id }`.

## Tabla `safety_plans` (Supabase)

```sql
CREATE TABLE safety_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  version         integer NOT NULL DEFAULT 1,
  document_type   text NOT NULL DEFAULT 'EBSS' CHECK (document_type IN ('EBSS','PSS')),
  content_json    jsonb,
  google_doc_id   text,
  google_doc_url  text,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','superseded')),
  execution_id    uuid REFERENCES agent_executions(id) ON DELETE SET NULL,
  exec_status     text NOT NULL DEFAULT 'confirmed',
  notes           text,
  created_at      timestamptz DEFAULT now(),
  approved_at     timestamptz,
  approved_by     text
);
```

## Limitaciones conocidas

1. **Google Docs API debe estar habilitada** en el proyecto GCP del usuario. Si no lo está, el `Insert Doc Body HTTP` falla pero el contenido se guarda igualmente en `safety_plans.content_json` (la fuente canónica). Para activarla: console.developers.google.com/apis/api/docs.googleapis.com/overview. Activada en este entorno el 2026-04-25.
2. **Edificios pre-2002**: el agente recomienda evaluación de amianto pero no la ejecuta. La retirada requiere **empresa RERA autorizada** y proceso administrativo independiente.
3. **El documento se genera pero NO se firma automáticamente**. El CSS designado debe revisar, completar campos específicos del proyecto (ubicación exacta del botiquín, hospital más cercano, etc.) y firmar.

## Nota técnica de implementación

El nodo `Google Docs` de n8n con operación `update` daba consistentemente "Bad request" pese a pasar la validación de configuración. Solución aplicada: reemplazar el nodo por un `HTTP Request` directo a la API de Google Docs:

```
POST https://docs.googleapis.com/v1/documents/{documentId}:batchUpdate
Auth: googleDocsOAuth2Api
Body: {
  "requests": [
    { "insertText": { "location": { "index": 1 }, "text": "<contenido>" } }
  ]
}
```

La credencial OAuth2 se reutiliza desde `googleDocsOAuth2Api` (ID `6NK9u2hvm1UUdoVu`).
