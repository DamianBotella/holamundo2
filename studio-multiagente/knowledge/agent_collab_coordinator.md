# `agent_collab_coordinator` — Coordinacion de colaboradores externos

## Estado

- **Migracion 023** aplicada: tablas `collaborators` (catalogo) + `collab_assignments` (asignaciones por proyecto).
- **3 workflows construidos y activos**:
  - `collab_register` (`0FTkQZ7DmwUH7wif`): POST /webhook/collab-register
  - `collab_assign` (`8BFQs3rWSfWp7nTJ`): POST /webhook/collab-assign (envia email automatico al colaborador con CC a Damian)
  - `collab_update_status` (`1iZQkV6uzkRDqpfF`): POST /webhook/collab-update (notificacion a Damian con badge de estado)
- **Verificacion E2E (2026-04-26)**: registro Pepe Estructurista -> assign para muro cocina (350 EUR, deadline 15/05) -> mark accepted con notas. Email enviado correctamente, accepted_at poblado por trigger.

## Por que importa

ArquitAI sec 3.20 #24: proyectos complejos requieren colaboradores puntuales (estructurista para cata de muros portantes, ingeniero de instalaciones para climatizacion, paisajista, geotecnico para cimentaciones, topografo, aparejador para DEO en grandes obras...). La coordinacion es por emails dispersos y queda fuera del sistema.

`agent_collab_coordinator` aporta:
- **Catalogo persistente** de colaboradores con especialidad y datos de contacto.
- **Ciclo de vida estructurado**: invitado -> aceptado -> en progreso -> entregado -> aprobado por Damian -> cerrado.
- **Email automatizado** con CC a Damian al invitar y al actualizar estado.
- **Trazabilidad**: cada decision tecnica del proyecto puede vincularse al `collaborator_id` que la firmo.

## Modelo de datos

### `collaborators` (catalogo)

| Campo | Descripcion |
|---|---|
| `name`, `email`, `phone` | datos contacto |
| `specialty` | estructurista, instalaciones, paisajismo, interiorista, arquitecto, aparejador, ingeniero, topografo, geotecnico, otros |
| `company`, `collegiate_no` | datos profesionales |
| `hourly_rate_eur` | tarifa habitual (referencia) |
| `notes` | espacio libre |
| `active` | true/false (soft-delete) |

### `collab_assignments` (entregables por proyecto)

| Campo | Descripcion |
|---|---|
| `project_id` FK | |
| `collaborator_id` FK | |
| `role` | descripcion corta del rol ("calculo estructural muro cocina") |
| `scope` | alcance detallado |
| `deliverables` jsonb | array `["Informe firmado PDF", "Plano DWG", ...]` |
| `fee_eur` | honorarios pactados |
| `deadline` date | fecha limite entrega |
| `status` | invited / accepted / rejected / in_progress / delivered / approved / rejected_delivery / closed / cancelled |
| `invited_at`, `accepted_at`, `delivered_at`, `approved_at`, `closed_at` | timestamps automaticos por trigger |
| `delivery_files` jsonb | URLs/refs de los entregables recibidos |
| `decision_notes` | comentarios del colaborador o de Damian |

Trigger `collab_assignments_touch` (BEFORE UPDATE): pone los timestamps automaticamente cuando status pasa al estado correspondiente.

## Workflows

### `collab_register` — alta de colaborador

```bash
curl -X POST .../webhook/collab-register -H "X-API-Key: ..." -d '{
  "name": "Pepe Estructurista",
  "email": "pepe@estructuras-mad.es",
  "phone": "+34 600 111 222",
  "specialty": "estructurista",
  "company": "Estructuras Madrid SL",
  "collegiate_no": "COAATM-12345",
  "hourly_rate_eur": 75,
  "notes": "Especialista en patologias de hormigon armado. Disponible Madrid."
}'
# -> 201 con collaborator_id
```

### `collab_assign` — invitar a participar en un proyecto

```bash
curl -X POST .../webhook/collab-assign -H "X-API-Key: ..." -d '{
  "project_id": "<uuid>",
  "collaborator_id": "<uuid>",
  "role": "calculo estructural muro cocina",
  "scope": "Cata + dictamen sobre si el muro divisorio cocina-salon es portante. Si lo es, calculo de viga IPE necesaria + apuntalamiento provisional.",
  "deliverables": ["Informe firmado en PDF", "Plano DWG con seccion estructural"],
  "fee_eur": 350,
  "deadline": "2026-05-15"
}'
# -> 201 con assignment_id, email enviado al colaborador con CC a Damian
```

El email automatico al colaborador incluye: rol, especialidad, honorarios, deadline, alcance completo, lista de entregables, y le pide confirmacion.

### `collab_update_status` — actualizar estado

```bash
curl -X POST .../webhook/collab-update -H "X-API-Key: ..." -d '{
  "assignment_id": "<uuid>",
  "new_status": "delivered",
  "decision_notes": "Entregado con 3 dias de retraso por subsanacion de medidas in situ.",
  "delivery_files": [
    "https://drive.google.com/file/d/.../informe.pdf",
    "https://drive.google.com/file/d/.../plano.dwg"
  ]
}'
# -> 200, trigger pone delivered_at, email a Damian con resumen y entregables
```

`new_status` valido:
- `accepted` / `rejected`: respuesta a la invitacion
- `in_progress`: trabajo arrancado
- `delivered`: entregables enviados a Damian
- `approved` / `rejected_delivery`: Damian aprueba o rechaza el entregable
- `closed`: cierre administrativo (factura cobrada, archivo)
- `cancelled`: cancelado antes de tiempo

## Queries utiles

```sql
-- Asignaciones activas por proyecto
SELECT p.name, c.name AS collab, ca.role, ca.status, ca.deadline,
       (ca.deadline - now()::date) AS dias_restantes
FROM collab_assignments ca
JOIN projects p ON p.id = ca.project_id
JOIN collaborators c ON c.id = ca.collaborator_id
WHERE ca.status NOT IN ('closed','cancelled','rejected')
ORDER BY ca.deadline ASC NULLS LAST;

-- Performance por colaborador (cumplimiento deadlines)
SELECT c.name, c.specialty,
       count(*) FILTER (WHERE ca.status IN ('approved','closed')) AS completados,
       count(*) FILTER (WHERE ca.delivered_at <= ca.deadline) AS a_tiempo,
       count(*) FILTER (WHERE ca.delivered_at > ca.deadline) AS tarde,
       avg(EXTRACT(DAY FROM ca.delivered_at - ca.invited_at)) AS dias_promedio
FROM collaborators c
JOIN collab_assignments ca ON ca.collaborator_id = c.id
WHERE ca.delivered_at IS NOT NULL
GROUP BY c.id, c.name, c.specialty
ORDER BY a_tiempo DESC;

-- Proximos vencimientos (proximos 7 dias)
SELECT p.name, c.name AS collab, ca.role, ca.deadline, ca.status
FROM collab_assignments ca
JOIN projects p ON p.id = ca.project_id
JOIN collaborators c ON c.id = ca.collaborator_id
WHERE ca.deadline BETWEEN now()::date AND now()::date + INTERVAL '7 days'
  AND ca.status NOT IN ('delivered','approved','closed','cancelled')
ORDER BY ca.deadline;
```

## Proximas iteraciones

1. **`cron_collab_review`** (diario 09:00): alerta de assignments con `deadline < now()` y status no terminal, o `delivered > 7d` sin approved.
2. **Integracion con `agent_qc_checklists`**: cuando un colaborador entrega, generar automaticamente un mini-checklist QC para que Damian lo revise sistematicamente.
3. **Pago automatico**: tras `approved`, generar `invoice` en `agent_financial_tracker` con la tarifa pactada.
4. **Hook con `agent_pathology`**: cuando se detecta patologia que requiere colaborador externo (estructurista para fisuras, geotecnico para asentamientos), proponer assignment automatico al colaborador habitual de esa especialidad.
5. **RLS multi-tenant**: cuando el sistema sea multi-estudio, cada estudio ve solo sus colaboradores. Los colaboradores tendrian su propio login para ver sus assignments.
6. **Portal para colaborador**: link magico tipo `aftercare_public_form` para que el colaborador acepte/rechace/entregue desde web sin email.

## Espacio para Damian

```
## Mis colaboradores habituales

- Estructurista: ...
- Ingeniero instalaciones: ...
- Geotecnico: ...
- Topografo: ...

## Tarifas de referencia que aplico

- Calculo estructural cata + dictamen: ...
- Memoria instalaciones: ...
- ...
```
