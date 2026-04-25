# `agent_qc_checklists` — Control de calidad por fase de obra

## Estado

- **Migracion 018** aplicada: tabla `qc_checks` (13 cols) + trigger `qc_checks_touch` que recalcula status segun items.
- **Migracion 018b** aplicada: hook `pathology_findings -> regulatory_tasks` (auto-crea tarea normativa al detectar patologia con severity >= medium).
- **Migracion 020** aplicada (2026-04-26): hook `qc_recepcion_provisional COMPLETE -> projects.handover_date`. Trigger `qc_set_handover_date_trg` rellena automaticamente la fecha de entrega cuando el checklist de recepcion provisional pasa a complete (sin pisar valor previo).
- **3 workflows construidos y activos**:
  - `qc_generate` (`ge3Do1cEeSDuCtzk`): genera checklist desde template embebido por fase.
  - `qc_complete` (`JTPN78VZtz8i0ZwB`): actualiza un item individual y deja que el trigger recalcule el estado del checklist.
  - `cron_qc_review` (`beICCi9A5WYU5w45`): diario 09:15 + manual `POST /webhook/trigger-qc-review`. Detecta checklists stuck (`blocked > 3 dias` o `open/in_progress > 7 dias`) y envia email con tabla coloreada. Si nada stuck: silent noOp.
- **Verificacion E2E (2026-04-25 + 2026-04-26)**:
  - Hook patologia: insertar `aluminosis severity=high` -> auto-crea `regulatory_tasks` con priority='critico', entity='Laboratorio de ensayos acreditado', task_type='informe_tecnico'.
  - QC: generar checklist `demolicion` (5 items) -> pass d1 -> `in_progress` -> fail d3 -> `blocked` -> pass d2/d4/d5 + skip d3 -> `complete`.
  - Hook handover: checklist `recepcion_provisional` con 5 items pass -> trigger touch pasa a complete + completed_at -> trigger handover pone `projects.handover_date='2026-04-25'`.
  - cron_qc_review: backdated INSERT (10d antiguo, 1pass/1fail/1pending) -> cron detecta, email enviado con detalles, fail_items listados.

## Por que importa

ArquitAI sec 3.8 (prio #16): el control de calidad en obra hoy es informal y disperso. El arquitecto técnico debe verificar muchos hitos por fase (apuntalamiento, gestion de residuos, instalaciones, acabados) y la trazabilidad ante el cliente o ante un litigio depende de tener evidencia documentada. Las apps genericas (Procore, etc.) son caras y sobre-dimensionadas para reformas residenciales.

`agent_qc_checklists` es un sistema minimo: cada fase tiene una checklist con items conocidos, el arquitecto marca pass/fail/skip al ir verificando, y queda registro con foto + comentario opcionales. Cuando una checklist se cierra `complete`, el orquestador puede usar ese hito para avanzar la fase del proyecto.

## Modelo de datos

### `qc_checks`

| Campo | Tipo | Descripcion |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK | |
| `phase_key` | text CHECK | demolicion, replanteo, albanileria, instalaciones_electricas, instalaciones_fontaneria, instalaciones_climatizacion, aislamiento_carpinteria, pavimentos_revestimientos, sanitarios_griferia, pintura, recepcion_provisional, otros |
| `template_version` | text | default `v1`, permite versionar templates en el futuro |
| `items` | jsonb | array de `{id, label, description, status, comment, evidence_url, checked_at}` |
| `status` | text | open / in_progress / complete / blocked / cancelled — **gestionado por trigger** |
| `generated_by`, `generated_at` | metadata | |
| `completed_at` | timestamptz | seteado por el trigger cuando status pasa a `complete` |
| `evidence_summary`, `notes` | text libres | |
| UNIQUE | `(project_id, phase_key, template_version)` | un solo checklist activo por fase y version |

### Trigger `qc_checks_touch`

BEFORE INSERT/UPDATE. Calcula counts de items por status y decide:

- `cancelled`: respeta el valor (manual)
- `fail` en algun item -> `blocked`
- todos `pass`/`skip`, ninguno `pending` -> `complete` + setea `completed_at`
- alguno `pass`/`skip` pero quedan `pending` -> `in_progress`
- todos `pending` -> `open`

## Workflows

### `qc_generate` — generar checklist para una fase

**Endpoint**: `POST /webhook/qc-generate` con `X-API-Key`.

**Body**:
```json
{
  "project_id": "<uuid>",
  "phase_key": "demolicion",
  "generated_by": "arquitecto" (opcional),
  "notes": "..." (opcional)
}
```

**Flujo**:
1. Webhook -> Code `Validate + Build`: valida `project_id` UUID + `phase_key` en lista, y construye los items desde el template embebido (12 fases con 4-5 items cada una).
2. Postgres `Insert Checklist`: INSERT en `qc_checks` con `ON CONFLICT (project_id, phase_key, template_version) DO UPDATE` -> permite re-generar/actualizar items conservando el id.
3. Respond 201 con `{qc_id, phase_key, items_count, checklist_status}`.

**Templates inline** (snapshot 2026-04-25). Cada item tiene `id`, `label`, `description`. Se inicializa con `status='pending'`, `comment=null`, `evidence_url=null`, `checked_at=null`.

| Fase | # items |
|---|---|
| demolicion | 5 (apeo, acotamiento, RCD, inspeccion post-demo, estructura) |
| replanteo | 4 |
| albanileria | 5 |
| instalaciones_electricas | 5 (REBT, cuadro, tomas, iluminacion, certificado) |
| instalaciones_fontaneria | 4 (presion, sanitarios, ACS, prueba estanqueidad) |
| instalaciones_climatizacion | 4 |
| aislamiento_carpinteria | 4 |
| pavimentos_revestimientos | 5 |
| sanitarios_griferia | 4 |
| pintura | 4 |
| recepcion_provisional | 5 (limpieza, llaves, manuales, garantias, acta firmada) |
| otros | 1 (placeholder editable) |

Si necesitas modificar templates: editar el JSCode del nodo `Validate + Build` del workflow `ge3Do1cEeSDuCtzk` y subir `template_version` a `v2`.

### `qc_complete` — actualizar un item

**Endpoint**: `POST /webhook/qc-complete` con `X-API-Key`.

**Body**:
```json
{
  "qc_id": "<uuid>",
  "item_id": "d1",
  "status": "pass" | "fail" | "skip" | "pending",
  "evidence_url": "https://drive..." (opcional),
  "comment": "texto libre <= 1000 chars" (opcional)
}
```

**Flujo**:
1. Webhook -> Code `Validate`: requiere qc_id, item_id, status valido.
2. IF `Valid?`: si no -> Respond 400.
3. Postgres `Update Item`: UPDATE con `jsonb_agg + jsonb_set` muta solo el item con `id=$2` dentro del array `items`. Devuelve counts (passed/failed/pending) y status del checklist (recalculado por trigger).
4. IF `Match?` -> Respond 200 con summary.
5. Si no se encontro qc_id -> Respond 404.

**Gotcha resuelto (2026-04-25)**: la primera version del UPDATE usaba `to_jsonb(NULLIF($4,''))` directo y, al ser NULL, `jsonb_set` devolvia NULL para todo el item -> el array quedaba con `null` en esa posicion. Fix aplicado: envolver con `COALESCE(to_jsonb(NULLIF($4,'')), 'null'::jsonb)` para forzar jsonb null en lugar de SQL NULL.

## Hook `pathology_findings -> regulatory_tasks`

### Que hace

Cuando `agent_pathology` (o cualquier INSERT manual) detecta una patologia con `severity` en `medium/high/critical`, el trigger `pathology_to_regulatory_trg` crea automaticamente la tarea regulatoria correspondiente al gremio/entidad responsable. Sin trigger, el arquitecto tendria que crearla a mano y se perderian.

### Mapeo

| pathology_type | task_type | entity | priority |
|---|---|---|---|
| aluminosis | informe_tecnico | Laboratorio de ensayos acreditado | critico |
| amianto_sospechoso | otro | Autoridad laboral autonomica | critico |
| plomo_sospechoso | otro | Sanidad autonomica | importante |
| radon_sospechoso | informe_tecnico | Empresa autorizada CSN | recomendable |
| fisura_estructural / asentamiento / oxidacion_armadura / carbonatacion | informe_tecnico | Estructurista colegiado | critico si severity=critical, sino importante |
| termitas / xilofagos | informe_tecnico | Empresa tratamientos DDD autorizada | importante |

Severity `low` o tipos no listados: el trigger hace `RETURN NEW` sin crear tarea.

### Idempotencia

Antes de insertar, comprueba si ya existe una `regulatory_tasks` con `(project_id, title)` igual y status distinto de `not_required`. Si existe, no duplica. Esto permite reinsertar la misma patologia (por ejemplo, tras edicion) sin generar tareas duplicadas.

### Trazabilidad

La columna `notes` de la `regulatory_tasks` generada lleva `pathology_finding_id: <uuid>` para enlazar la tarea con la patologia que la origino.

## Cobertura ArquitAI sec 3 (post-2026-04-25)

Con esta entrega:
- **#16 (sec 3.8 — agent_qc_checklists)**: cubierto por qc_generate + qc_complete + tabla qc_checks. Pendiente: integracion con orquestador (avanzar fase del proyecto cuando se cierra `complete` el checklist de `recepcion_provisional`).
- **Hook patologia -> normativa**: refuerzo de #4 sec 3.5 (agent_pathology) y #1 sec 3.7 (agent_regulatory). Cierra el silo: detectar una patologia ahora dispara automaticamente la cadena administrativa.

## Proximas iteraciones

1. **Templates configurables en BD**: hoy los items por fase viven en el JSCode del workflow. Mover a tabla `qc_templates` permitiria que Damian edite items sin tocar el workflow (y versionar mejor).
2. **Subida de foto integrada**: hoy el arquitecto pega una URL en `evidence_url`. Idealmente: subida directa a Drive desde un form web (similar a aftercare_public_form).
3. ~~**Vinculacion handover_date**~~ ✅ Hecho 2026-04-26 con trigger `qc_set_handover_date_trg` (migration 020). Pendiente: avanzar `projects.current_phase` automaticamente al cerrar recepcion_provisional (requiere decidir target phase: 'completed'? 'archived'?).
4. **Checklist como informe PDF**: al cerrar `complete`, generar un PDF con todos los items + evidencias adjuntas (Google Doc -> PDF, similar al patron de `proposal_pdf`).
5. ~~**Cron de checklists abiertas**~~ ✅ Hecho 2026-04-26 con `cron_qc_review` (umbral blocked>3d, open/in_progress>7d).
6. **Auto-generacion al avanzar fase**: cuando el orquestador entra en una fase, generar automaticamente la checklist correspondiente (sin que Damian tenga que llamar al endpoint).

## Espacio para Damian

```
## Mis customizaciones de templates por fase

- demolicion: ...
- ...

## Politica de evidencia

- Que tipo de foto/documento subo en cada item:
- ...
```
