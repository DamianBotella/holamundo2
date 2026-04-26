# `agent_home_automation` — Propuesta de domotica residencial

## Estado

- **Migracion 024** aplicada: tabla `home_automation_proposals` (21 cols, jsonb para devices y preinstall_requirements).
- **Workflow** `agent_home_automation` (`6f25BcR8LwNX2HQH`) activo. Endpoints:
  - `POST /webhook/trigger-home-automation` con `{project_id, level?, ecosystem_pref?}`
  - executeWorkflowTrigger paralelo (sub-workflow desde orquestador en futuro)
- **Verificacion E2E (2026-04-26)**: proyecto Madrid 72m2 reforma integral, level=medio, ecosystem_pref=home_assistant -> propuesta `home_assistant`, 1051 EUR, 6 devices recomendados, 4 preinstall requirements, rationale tecnico justificando eleccion. ~$0.01/eval con gpt-4o.

## Por que importa

ArquitAI sec 3.16 #21: cada vez mas reformas piden domotica. El arquitecto suele derivarlo a un integrador *despues* de cerrar la obra, lo que duplica el coste (anadir mecanismos con neutro, conductos, cajas registrables a posteriori es 2-3x mas caro). `agent_home_automation` aporta:

- **Decision temprana**: ecosistema + dispositivos + preinstalacion *antes* de cerrar el proyecto electrico.
- **Conocimiento experto**: el LLM con prompt entrenado conoce los principales ecosistemas y sus tradeoffs (KNX cableado vs Zigbee inalambrico, Matter como puente, etc.).
- **Lista de preinstalacion EN OBRA** que el arquitecto pasa al electricista con tiempo (cables neutro, cajas dobles, espacio en cuadro para hub, etc.).
- **Presupuesto desglosado**: dispositivos vs instalacion. Permite presentar al cliente con cifras concretas.

NO sustituye al integrador. Es una **propuesta inicial** que orienta decisiones de obra y luego el integrador ejecuta.

## Modelo de datos (`home_automation_proposals`)

| Campo | Tipo | Descripcion |
|---|---|---|
| `project_id` | uuid FK | |
| `version` | int | versionado por proyecto |
| `ecosystem` | text | home_assistant / knx / matter / zigbee / wifi_mixed / no_recommendation |
| `level` | text | basico / medio / avanzado / premium |
| `devices_recommended` | jsonb | `[{room, device_type, name, qty, unit_price_eur, total_eur, notes}]` |
| `preinstall_requirements` | jsonb | `[{room, description, critical}]` |
| `estimated_cost_devices_eur` | numeric | total dispositivos |
| `estimated_cost_install_eur` | numeric | total mano de obra integrador |
| `estimated_total_eur` | numeric | suma |
| `rationale` | text | resumen LLM justificando la propuesta |
| `warnings` | jsonb | datos faltantes o decisiones a tomar con cliente |
| `status` | text | draft / presented_to_client / accepted / rejected / superseded |
| `llm_*` | telemetry LLM |

## Niveles

| `level` | Descripcion | Budget orientativo |
|---|---|---|
| `basico` | iluminacion + 1-2 escenas + control voz | 500-1500 EUR |
| `medio` | iluminacion + climatizacion + persianas + camara | 1500-3500 EUR |
| `avanzado` | + acceso (cerradura) + audio multi-room + alarma | 3500-7000 EUR |
| `premium` | KNX completo cableado + scenes complejas + cuadros visuales | > 7000 EUR |

## Ecosistemas

| `ecosystem` | Cuando | Pros | Cons |
|---|---|---|---|
| `home_assistant` | reforma sin obra mayor, budget medio | flexible, gratis, hub local | requiere mantenimiento |
| `knx` | obra completa, budget alto | robusto, profesional, futureproof | caro, requiere bus dedicado |
| `matter` | cliente con mix Apple/Google | interoperabilidad | aun ecosistema joven |
| `zigbee` | inalambrico simple | barato, no requiere obra | rango limitado |
| `wifi_mixed` | proyecto pequeno sin pretension | rapido | dependencia router/cloud |
| `no_recommendation` | budget < 1500 EUR o desinteres real | honestidad | (es la negativa elegante) |

## Prompt del LLM

Cargado en `agent_prompts.agent_home_automation` (version 1, gpt-4o, temperature 0.3). Reglas duras:
- En reforma residencial sin obra mayor: prioriza Zigbee + hub Home Assistant.
- Para obra completa con presupuesto alto: KNX cableado.
- Matter como puente entre ecosistemas si el cliente tiene mix Apple/Google.
- NUNCA propone un dispositivo sin justificar la preinstalacion necesaria.
- Si el budget no da para domotica real (< 1500 EUR): `no_recommendation` con explicacion honesta.

## Workflow

1. ExecuteWorkflowTrigger O Manual Webhook -> Normalize Input.
2. Load Architect Email + Load Project Data (project + design_option seleccionada + briefing).
3. Has Project? IF (404 si no existe).
4. Load Agent Prompt + Prepare LLM Payload.
5. Call LLM (executeWorkflow util_llm_call).
6. Parse Response (extrae JSON, fallback con warnings='parse_failure' si falla).
7. Insert Proposal (BD).
8. Build Notification (HTML con tabla devices + lista preinstall criticos en rojo).
9. Send Email + Webhook Response.

## Queries utiles

```sql
-- Proyectos sin propuesta domotica
SELECT p.id, p.name, p.budget_target
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM home_automation_proposals h WHERE h.project_id = p.id)
  AND p.current_phase IN ('design_done','analysis_done','costs_done','trades_done');

-- Distribucion ecosistemas elegidos
SELECT ecosystem, count(*) FROM home_automation_proposals
WHERE status IN ('accepted','presented_to_client') GROUP BY ecosystem;

-- Coste medio domotica por nivel
SELECT level, count(*), avg(estimated_total_eur)::int AS avg_eur
FROM home_automation_proposals GROUP BY level ORDER BY 1;

-- Preinstalaciones criticas en proyectos actuales
SELECT p.name, jsonb_array_elements(h.preinstall_requirements) AS req
FROM home_automation_proposals h
JOIN projects p ON p.id = h.project_id
WHERE p.current_phase NOT IN ('completed','archived')
  AND h.status IN ('accepted','presented_to_client');
```

## Proximas iteraciones

1. **Hook con `agent_briefing`**: si briefing menciona "smart home" / "domotica" / "Alexa" / "Google Home", auto-disparar agent_home_automation.
2. **Hook con `agent_costs`**: anadir partidas de domotica al breakdown si propuesta `accepted`.
3. **Hook con `agent_safety_plan`**: las preinstalaciones criticas deben informar el plan de obra.
4. **Catalogo BD de dispositivos**: mover precios y modelos a tabla `home_automation_catalog` para que Damian actualice sin tocar workflow (el LLM puede ir variando).
5. **Comparativa vs presupuesto del integrador real**: cuando el integrador entrega su presupuesto, comparar con la estimacion ArquitAI.
6. **Plantilla de pliego**: generar Google Doc con la propuesta para presentar al cliente firmable (similar a agent_contracts).

## Espacio para Damian

```
## Mis integradores domoticos habituales

- HA / Zigbee: ...
- KNX: ...

## Marcas que prefiero

- Iluminacion: Philips Hue / IKEA Tradfri / ...
- Climatizacion: Tado / Sensibo / ...
- Persianas: Somfy / Aqara / ...
```
