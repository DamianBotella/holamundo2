# `agent_pathology` — Detección de patologías durante la visita previa

## Estado

- **Migración 014** aplicada: `pathology_findings` (29 columnas) + trigger `updated_at`.
- **Workflow** `agent_pathology` (`I34LYGuiWTQ8WJCa`) activo.
- **Verificación E2E**: foto sin patologías → Vision devolvió `total_findings: 0`, `confidence: low`, `requires_in_situ_diagnosis: true`. Sin alucinaciones.
- **Coste**: ~$0.005 por inspección (gpt-4o detail:high, ~700 tokens in / 200 out).
- **Última revisión**: 2026-04-25.

## Por qué importa

Durante la visita previa al briefing, el arquitecto debe detectar las patologías existentes del inmueble para presupuestar bien la reforma. Es un trabajo de criterio que se hace en 30 minutos y se olvidan detalles. Los problemas que se detectan después (en obra, o tras la reforma) son los que disparan el coste y crean fricción con el cliente.

`agent_pathology` analiza fotos de la visita y genera un informe estructurado de patologías visibles, especializado en el parque inmobiliario español:

| Tipo | Pista clave | Cuándo aplica |
|---|---|---|
| `aluminosis` | Hormigón visto + manchas marrón-rojizas | Edificios 1958-1972 |
| `humedad_capilaridad` | Mancha en planta baja, eflorescencias, hasta 1m altura | Edificios sin barrera horizontal |
| `humedad_filtracion` | Bordes definidos, asociada a punto exterior | Cubiertas, fachadas, juntas |
| `humedad_condensacion` | Rincones fríos, techos sobre baños, moho | Aislamiento insuficiente |
| `instalacion_electrica_obsoleta` | Cables empotrados sin tubo, sin diferencial | REBT pre-2002 |
| `amianto_sospechoso` | Terrazos pre-1990, fibrocemento, bajantes antiguos | Edificios pre-1990 |
| `plomo_sospechoso` | Tuberías grises | Fontanería pre-1980 |
| `carbonatacion` | Manchas oxidación en armaduras | Hormigón visto antiguo |

## Endpoint

`POST /webhook/pathology-inspect` con `X-API-Key`.

```json
{
  "project_id": "uuid",
  "photo_url": "https://..." (o "photo_urls": ["url1","url2"], hasta 6),
  "description": "Texto del inspector",
  "location_in_property": "ej: salón pared norte, baño techo NE",
  "inspector": "arquitecto|aparejador|cliente|perito|otro"
}
```

**Respuesta `200/201`** (con findings):
```json
{
  "status": "analyzed",
  "project_id": "uuid",
  "total_findings": 3,
  "critical": 0,
  "high": 1,
  "has_critical": true,
  "requires_in_situ_diagnosis": false,
  "summary": "Resumen 2-3 frases",
  "finding_ids": ["uuid", "uuid", "uuid"],
  "llm_cost": 0.012
}
```

**Respuesta `200`** (sin findings — no hay patologías visibles):
```json
{
  "status": "analyzed",
  "total_findings": 0,
  "summary": "No se detectan patologías visibles...",
  "confidence": "low",
  "requires_in_situ_diagnosis": true
}
```

**Respuesta `502`**: descarga de imagen falló (ver limitación de URLs en `agent_site_monitor.md`).

## Output del LLM

Cada finding contiene:
- `pathology_type` (24 valores normalizados, ver migración 014)
- `severity` (low/medium/high/critical)
- `urgency` (informativo/programar/urgente/inmediato)
- `structural` (bool)
- `affects_safety` (bool — riesgo inmediato)
- `affects_habitability` (bool)
- `description` (qué se ve y dónde)
- `recommended_action` (intervención recomendada)
- `estimated_cost_min` / `estimated_cost_max` (orientativo en EUR para piso ~80m²)
- `requires_specialist` (bool)
- `specialist_type` (laboratorio_aluminosis, tecnico_amianto, estructurista, etc.)

Y a nivel global:
- `global_summary` (2-3 frases impacto en viabilidad reforma)
- `confidence` (low/medium/high)
- `requires_in_situ_diagnosis` (bool — si las fotos son insuficientes)

## Auto-alerta

Si **alguna patología es `severity ∈ {high, critical}` o `affects_safety = true`** → email HTML automático a Damián con:
- Lista coloreada por severity
- Badges `SEGURIDAD` y `ESTRUCTURAL` cuando aplican
- Costes orientativos
- Acción recomendada por finding
- Enlaces a las fotos
- Mención si requiere diagnóstico in situ

Si no hay severidades altas: respond 201 con resumen, sin email.

## Modelo de datos

```sql
-- Una fila por cada patología detectada (un agente puede generar múltiples filas
-- desde una sola inspección con varias fotos)
SELECT pathology_type, severity, urgency,
       structural, affects_safety, recommended_action,
       estimated_intervention_cost_min || '-' ||
         estimated_intervention_cost_max || 'eur' AS coste_orientativo,
       requires_specialist, specialist_type, status
FROM pathology_findings
WHERE project_id = '<uuid>'
ORDER BY
  CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                WHEN 'medium' THEN 2 ELSE 3 END;
```

## Hook con `agent_briefing` (no aplicado, listo para activar)

`agent_briefing.Load Project + Client` puede sumar las patologías detectadas para que el LLM las tenga en cuenta al construir el briefing. Modificación SQL pendiente:

```sql
-- En agent_briefing.Load Project + Client, añadir al SELECT principal:
,(SELECT json_agg(json_build_object(
   'type', pathology_type, 'severity', severity, 'description', description,
   'affects_safety', affects_safety, 'cost_range',
   estimated_intervention_cost_min || '-' || estimated_intervention_cost_max
 ) ORDER BY severity)
 FROM pathology_findings
 WHERE project_id = p.id AND status NOT IN ('repaired','dismissed')
) AS pathology_findings
```

Y en `agent_briefing.Prepare LLM Payload` añadir al userPrompt:

```
PATOLOGÍAS DETECTADAS EN INSPECCIÓN PREVIA:
${(project.pathology_findings || []).map(p =>
  `- [${p.severity}] ${p.type}: ${p.description}` +
  (p.affects_safety ? ' (AFECTA SEGURIDAD)' : '') +
  (p.cost_range ? ` (estimado ${p.cost_range}€)` : '')
).join('\n') || '(sin patologías registradas)'}
```

Con esto, el briefing resultante incluirá automáticamente las patologías como `constraints` o como objectives extra cuando proceda.

**No aplicado en esta sesión** para no introducir riesgo en un workflow productivo. Aplicación posterior cuando Damián tenga proyectos con patologías reales registradas.

## Queries útiles

### Patologías abiertas por proyecto

```sql
SELECT p.name AS proyecto, pf.pathology_type, pf.severity, pf.urgency,
       pf.affects_safety, pf.structural,
       LEFT(pf.description, 100) AS preview,
       pf.estimated_intervention_cost_min || '-' ||
         pf.estimated_intervention_cost_max || 'eur' AS coste
FROM pathology_findings pf
JOIN projects p ON p.id = pf.project_id
WHERE pf.status NOT IN ('repaired','dismissed')
ORDER BY
  CASE pf.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                   WHEN 'medium' THEN 2 ELSE 3 END,
  pf.inspection_date DESC;
```

### Patologías que requieren especialista

```sql
SELECT specialist_type, count(*) AS pendientes,
       array_agg(DISTINCT pathology_type) AS tipos
FROM pathology_findings
WHERE requires_specialist = true
  AND status IN ('detected','confirmed','scheduled')
GROUP BY specialist_type
ORDER BY pendientes DESC;
```

### Top patologías por frecuencia (aprendizaje)

```sql
SELECT pathology_type, count(*) AS frecuencia,
       round(avg(estimated_intervention_cost_max)) AS coste_avg_max
FROM pathology_findings
GROUP BY pathology_type
HAVING count(*) >= 2
ORDER BY frecuencia DESC;
```

## Próximas iteraciones

1. **Hook con `agent_briefing`** (documentado arriba): activar cuando haya datos suficientes.
2. **Workflow `pathology_confirm`/`pathology_repair`**: marcar status (igual patrón que `aftercare_assign_resolve`).
3. **Cron `cron_pathology_review`**: alerta de patologías abiertas con severity high+ sin actualizar > 30 días.
4. **Hook con `agent_costs`**: sumar `estimated_intervention_cost` de patologías detectadas como partida adicional al cost_estimate.
5. **Vision con múltiples fotos en serie**: analizar la misma patología desde varios ángulos y consolidar findings duplicados.
6. **Knowledge embedding**: subir PDFs técnicos sobre patología (catálogo CYPE, manuales colegio profesional) y dar al LLM context vía RAG semántico.

## Espacio para Damián

```
## Mis especialistas habituales

- Laboratorio aluminosis: ...
- Técnico amianto certificado: ...
- Estructurista: ...
- Perito de patologías: ...

## Patologías que más veo en mi cartera

- ...
```
