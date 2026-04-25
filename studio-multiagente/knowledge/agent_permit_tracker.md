# `agent_permit_tracker` — Gestión de licencias y trámites municipales

## Estado

- **Migración 010** aplicada (tabla `permit_applications` + `permit_status_history` + 2 triggers).
- **3 workflows construidos y activos**: `permit_register`, `permit_update_status`, `cron_permit_review`.
- **Hook automático**: `regulatory_tasks` con `exec_status='confirmed'` y task_type elegible crea su `permit_application` sin tocar el workflow.
- **Verificación E2E**: registro + actualización de estado vía webhook OK.
- **Última revisión**: 2026-04-25.

## Por qué esto resuelve un dolor real

> Presentar el expediente en el ayuntamiento es solo el inicio. Después hay que monitorizarlo: cada sede electrónica tiene su propio formato y los requerimientos de subsanación llegan sin aviso. Si pasan días sin revisarlo, la obra se retrasa.

`agent_permit_tracker` no automatiza el scraping (cada ayuntamiento es diferente — eso es trabajo de fase 2). Lo que sí hace:

1. **Registra** cada expediente que el arquitecto presenta.
2. **Recordatorio diario** a las 09:00 con tabla HTML de pendientes ordenados por urgencia: vencidos, próximos a vencer, sin revisar > 14 días.
3. **Auditoría completa**: cada cambio de estado se registra en `permit_status_history` automáticamente.
4. **Auto-registro**: cuando `agent_regulatory` confirma una task de licencia, se crea el permit sin acción manual.

## Modelo de datos

### `permit_applications`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK projects | proyecto al que pertenece |
| `regulatory_task_id` | uuid FK regulatory_tasks (nullable) | task que generó este expediente (auto) |
| `entity` | text | "Ayuntamiento de Madrid", "Comunidad de Madrid", etc. |
| `application_type` | text CHECK | uno de 10 tipos válidos |
| `expediente_id` | text | número de expediente que asigna la administración |
| `status` | text CHECK | preparing → submitted → in_review / requires_subsanation → approved / rejected / withdrawn / expired |
| `submitted_at` | timestamptz | fecha de presentación |
| `expected_response_days` | int | plazo esperado (default 30) |
| `status_url` | text | URL directa a la sede electrónica |
| `last_checked_at` | timestamptz | última vez que se consultó el estado |
| `resolved_at` | timestamptz | auto-poblado cuando status pasa a terminal |
| `notes` | text | observaciones libres |

### `application_type` — valores válidos

- `licencia_obra_mayor` — proyecto técnico, plazo típico 1-3 meses
- `licencia_obra_menor` — actuaciones menores, 2-4 semanas
- `comunicacion_previa` — sin esperar resolución (silencio positivo)
- `declaracion_responsable` — sin tramitación
- `licencia_actividad` — uso del local, 1-3 meses
- `primera_ocupacion` — al terminar obra
- `cambio_uso` — vivienda → local o viceversa
- `cedula_urbanistica` — info previa
- `autorizacion_autonomica` — patrimonio, costas, etc.
- `otro`

### `status` — valores válidos

```
preparing            → expediente en preparación, aún no presentado
submitted            → presentado, sin acuse aún
in_review            → administración revisándolo
requires_subsanation → ha llegado un requerimiento, hay que subsanar
approved             → aprobado (terminal, auto-resolved_at)
rejected             → rechazado (terminal)
withdrawn            → retirado por el arquitecto/cliente (terminal)
expired              → caducado por inacción (terminal)
```

## Workflows

### `permit_register` (ID `4d4Js8Y5fuZI4W9Q`)

- Endpoint: `POST /webhook/permit-register` con `X-API-Key`.
- Body mínimo: `{ project_id, entity, application_type }`.
- Body completo:
```json
{
  "project_id": "uuid",
  "regulatory_task_id": "uuid | null",
  "entity": "Ayuntamiento de Madrid",
  "application_type": "licencia_obra_mayor",
  "expediente_id": "EXP-2026-1234",
  "status": "submitted",
  "submitted_at": "2026-04-25T10:00:00Z",
  "expected_response_days": 60,
  "status_url": "https://sede.madrid.es/...",
  "notes": "Comentarios del arquitecto"
}
```
- Respuesta `201`: `{ status: 'created', permit_id, expediente_id, submitted_at, expected_response_days }`.
- Respuesta `400`: `{ status: 'error', error: '...' }`.

### `permit_update_status` (ID `QGiZjzrCeRcxWjqj`)

- Endpoint: `POST /webhook/permit-update` con `X-API-Key`.
- Body: `{ permit_id, new_status, notes?, status_url? }`.
- Cualquier cambio de estado se registra automáticamente en `permit_status_history`.
- `last_checked_at` se actualiza con cada UPDATE (proxy de "lo he revisado hoy").

### `cron_permit_review` (ID `0LK6VrMq5lHOFJaL`)

- **Schedule**: diario a las 09:00.
- **Manual**: `POST /webhook/trigger-permit-review` con `X-API-Key`.
- Calcula para cada permit activo (no terminal y proyecto no completado):
  - `days_overdue` = días desde la fecha de vencimiento esperada (`submitted_at + expected_response_days`).
  - `days_since_check` = días desde `last_checked_at`.
  - `priority` = `overdue` (vencido) | `due_soon` (a < 7 días) | `stale_check` (sin revisar > 14 días) | `normal`.
- Si hay pendientes: email HTML a Damián con tabla coloreada por prioridad. Si no hay pendientes: noOp silencioso.

## Hook automático

Trigger SQL `regulatory_task_to_permit_trg` sobre `regulatory_tasks` AFTER INSERT OR UPDATE OF exec_status:

```sql
-- Cuando regulatory_task pasa a 'confirmed':
-- - Si task_type ∈ {licencia_obra, comunicacion_previa, cedula_urbanistica, certificado_habitabilidad}
-- - Y no existe ya un permit ligado a esa task
-- → crea permit_application con status='preparing'
```

Mapeo task_type → application_type:

| `regulatory_tasks.task_type` | `permit_applications.application_type` |
|---|---|
| `licencia_obra` | `licencia_obra_mayor` (default conservador) |
| `comunicacion_previa` | `comunicacion_previa` |
| `cedula_urbanistica` | `cedula_urbanistica` |
| `certificado_habitabilidad` | `primera_ocupacion` |

Después, el arquitecto actualiza el `application_type` correcto si es obra menor en lugar de mayor.

## Queries útiles

### Permits activos con prioridad

```sql
SELECT
  p.name AS proyecto, pa.entity, pa.application_type, pa.expediente_id, pa.status,
  CASE
    WHEN pa.submitted_at IS NULL THEN 'sin presentar'
    ELSE to_char(pa.submitted_at + (pa.expected_response_days || ' days')::interval, 'YYYY-MM-DD')
  END AS vence,
  CASE
    WHEN pa.last_checked_at IS NULL THEN 'nunca'
    ELSE round(EXTRACT(EPOCH FROM (now() - pa.last_checked_at))/86400) || 'd'
  END AS sin_revisar
FROM permit_applications pa
JOIN projects p ON p.id = pa.project_id
WHERE pa.status NOT IN ('approved','rejected','withdrawn','expired')
ORDER BY pa.submitted_at + (pa.expected_response_days || ' days')::interval ASC NULLS LAST;
```

### Histórico de un expediente

```sql
SELECT changed_at, old_status, new_status, notes
FROM permit_status_history
WHERE permit_id = '<permit-uuid>'
ORDER BY changed_at;
```

### Tiempos medios de resolución por entidad

```sql
SELECT entity, application_type,
       count(*) AS total,
       round(avg(EXTRACT(EPOCH FROM (resolved_at - submitted_at))/86400)) AS dias_promedio
FROM permit_applications
WHERE resolved_at IS NOT NULL AND submitted_at IS NOT NULL
GROUP BY entity, application_type
ORDER BY total DESC;
```

## Próximas iteraciones (fase 2)

1. **Scraping por ayuntamiento**: workflow específico por sede electrónica que detecte cambios de estado vía Jina Reader o Playwright.
   - Empezar por Madrid (sede.madrid.es) — el más usado.
   - Cada ayuntamiento documentado en `knowledge/permit_sedes/<municipio>.md`.
2. **Integración Autofirma/FNMT** para presentar subsanaciones desde el sistema.
3. **Aprendizaje**: estimar `expected_response_days` por entidad+application_type usando los datos históricos de la query de tiempos medios.
4. **Alertas escaladas**: si un permit lleva > 90 días vencido, email + WhatsApp al arquitecto.

## Espacio para Damián

```
## Sedes electrónicas que uso

- Ayuntamiento de Madrid: https://sede.madrid.es/...
  - Cómo se llama el campo del expediente: ...
  - Cómo se obtiene el estado: ...
- Comunidad de Madrid: ...
- (otros)

## Tipos típicos según mi cartera de proyectos

- Reformas integrales pequeñas (< 80 m2): suelen ser comunicacion_previa
- Reformas con cambios estructurales: licencia_obra_mayor
- ...
```
