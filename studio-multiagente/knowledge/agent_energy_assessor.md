# `agent_energy_assessor` — Evaluacion energetica estimada (CTE HE0/HE1 + huella CO2)

## Estado

- **Migracion 021** aplicada: tabla `energy_assessments` (28 cols, jsonb para breakdown CO2 y recomendaciones).
- **Workflow** `agent_energy_assessor` (`63XFqhlsg0d1cXav`) activo. Endpoints:
  - `POST /webhook/trigger-energy-assessor` con `X-API-Key` y `{project_id}` (manual)
  - executeWorkflowTrigger paralelo (sub-workflow desde orquestador en futuro)
- **Verificacion E2E (2026-04-26)**: proyecto Madrid 72m2 reforma integral -> zona climatica D3, recomendaciones (PVC bajo emisivo, aislamiento techos, MVHR), warnings sobre datos incompletos. Sin materiales declarados los numeros quedan null por diseno.

## Por que importa

ArquitAI sec 3.10 #18: el CEE (Certificado de Eficiencia Energetica) y la huella de CO2 se generan al final del proyecto con CE3X/CYPETherm, software desconectado del flujo de diseno. Resultado: el arquitecto descubre demandas excesivas o calificaciones bajas cuando ya no puede cambiar el aislamiento o la carpinteria. `agent_energy_assessor` aporta una **pre-evaluacion en tiempo de diseno**: con design + materials propuestos te dice por donde va la calificacion estimada y donde estan las palancas de mejora.

NO sustituye al CEE oficial. Es una **estimacion** que orienta decisiones de diseno.

## Modelo de datos (`energy_assessments`)

| Campo | Tipo | Descripcion |
|---|---|---|
| `project_id` | uuid FK | |
| `version` | int | versionado por proyecto |
| `zona_climatica` | text | A3, B4, D3, E1, ... segun CTE DB-HE Anejo B |
| `demanda_calefaccion_kwh_m2_anyo` | numeric | estimada por LLM |
| `demanda_refrigeracion_kwh_m2_anyo` | numeric | |
| `demanda_total_kwh_m2_anyo` | numeric | |
| `transmitancia_envolvente_global` | numeric | U medio W/m2K |
| `consumo_energia_primaria_kwh_m2_anyo` | numeric | |
| `emisiones_co2_kg_m2_anyo` | numeric | factor 0.252 kg/kWh aprox |
| `calificacion_demanda` | text A-G | |
| `calificacion_emisiones` | text A-G | |
| `cumple_he0` / `cumple_he1` | bool | |
| `huella_carbono_embebida_kg` | numeric | calculado por code node desde tabla embebida |
| `huella_carbono_breakdown` | jsonb | `{categoria: kg_co2eq}` |
| `analysis_summary` | text | resumen tecnico LLM |
| `recomendaciones` | jsonb | `[{descripcion, impacto_kwh_m2_anyo, prioridad}]` |
| `warnings` | jsonb | datos faltantes |
| `llm_*` | telemetry LLM (modelo, tokens, coste) |

## Calculo de huella embebida (Code node)

Tabla `CO2_FACTORS` por categoria de material en kg CO2eq/unit:
- pavimento (porcelanico/ceramico/parquet/vinilico/microcemento)
- sanitarios (lavabo/inodoro/ducha/banera/bidet)
- griferia (monomando/termostatico)
- cocina (mueble/encimera/electrodomestico)
- carpinteria (interior/exterior PVC/Al/madera)
- pintura (plastica/esmalte)
- aislamiento (lana mineral/EPS/XPS/SATE)
- instalaciones (electrica/fontaneria/climatizacion)

Para cada item del proyecto (categoria + cantidad) se aplica el factor primario de su categoria. Es una estimacion conservadora (datos ITeC BEDEC aproximados); para huella oficial usar OneClickLCA o similar.

## Prompt del LLM

Cargado en `agent_prompts.agent_energy_assessor` (version 1, gpt-4o, temperature 0.2). Reglas duras del prompt:
- Identificar zona climatica segun tabla CTE DB-HE Anejo B.
- Estimar demanda kWh/m2/anyo basandose en superficie + clima + transmitancia tipica de envolvente segun materiales.
- Estimar emisiones con factor de paso 0.252 kg CO2/kWh.
- Calificacion A-G segun rangos RD 235/2013.
- **Sin datos suficientes: poner null, NO inventar**.
- Output JSON exacto, sin markdown ni texto antes/despues.

## Flujo de ejecucion

1. Recibe project_id (sub-workflow trigger O manual webhook).
2. Load Architect Email (system_config.architect_email).
3. Load Project Data: project + briefing + design_option seleccionada + materials aprobados.
4. Validate: `property_area_m2 > 0` y `location_province` obligatorios (sin estos no hay zona climatica posible).
5. Load Agent Prompt + Prepare LLM Payload (formato esperado por util_llm_call).
6. Call LLM (executeWorkflow util_llm_call).
7. Parse Response: extrae JSON, coerce types, fallback con warnings='parse_failure' si no parsea.
8. Calculate Embedded Footprint: aplica tabla CO2_FACTORS a cada material.
9. Insert Assessment.
10. Build Notification Email + Send (HTML con tabla coloreada calificacion A-G).
11. Return Success / Webhook Response.

## Coste

~$0.01 por evaluacion con gpt-4o (1500 tokens in / 400 out aprox).

## Queries utiles

```sql
-- Proyectos sin evaluacion energetica
SELECT p.id, p.name, p.location_province, p.property_area_m2
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM energy_assessments e WHERE e.project_id = p.id)
  AND p.current_phase NOT IN ('intake','briefing_done','archived');

-- Distribucion de calificaciones
SELECT calificacion_demanda, count(*) FROM energy_assessments
WHERE calificacion_demanda IS NOT NULL
GROUP BY calificacion_demanda ORDER BY 1;

-- Recomendaciones mas frecuentes
SELECT jsonb_array_elements(recomendaciones)->>'descripcion' AS reco, count(*)
FROM energy_assessments GROUP BY reco ORDER BY count DESC LIMIT 20;
```

## Proximas iteraciones

1. **Actualizar `recomendaciones` cuando design/materials cambien**: re-disparar agente al recibir nuevo design_option seleccionado o materials aprobados (hook desde agent_design / agent_materials).
2. **Comparativa antes/despues**: si project tiene > 1 version, generar tabla con delta de calificacion.
3. **Export CE3X**: una vez validados los numeros con Damian, exportar a fichero .ctex compatible con CE3X para certificacion oficial.
4. **Tabla `co2_factors_db`**: mover los factores embebidos a BD para que Damian pueda actualizarlos sin tocar workflow.
5. **Hook con `agent_costs`**: el coste de cada recomendacion (PVC bajo emisivo, SATE, etc) puede tirar de `price_references` para indicar el ROI energetico.
6. **Integracion con LightRAG normativa**: cuando se construya RAG sobre CTE DB-HE, el LLM podria citar articulos exactos (HE1 art. 3.1.1.5, etc).

## Espacio para Damian

```
## Notas mias sobre evaluaciones generadas

- Proyecto X / fecha / valor estimado vs valor CEE oficial real:
- ...

## Recomendaciones del LLM que NO comparto (criterio profesional)

- ...
```
