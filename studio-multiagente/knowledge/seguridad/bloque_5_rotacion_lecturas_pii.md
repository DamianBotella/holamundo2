# Bloque 5 — Rotación de lecturas a `pii_decrypt`

## Estado

- **Decisión adoptada**: opción (a) del audit — `clients.email` se mantiene en plano para preservar la búsqueda por email en `init_new_project.Find Existing Client`. Las columnas `phone`, `notes` y `briefings.client_needs` se leen ahora desde su versión cifrada.
- **3 workflows actualizados**: `agent_briefing`, `agent_design`, `agent_proposal`.
- **Columnas en plano NO dropeadas todavía**: defensa en profundidad + backward compat. Se dropean en una fase futura cuando queramos cerrar el ciclo.
- **Última revisión**: 2026-04-25.

## Cambios aplicados

### `agent_briefing` (`uq3GQWSdmoIV4ZdR`)

**`Load Project + Client`** — query SQL:
- `c.phone as client_phone` → `pii_decrypt(c.phone_enc) as client_phone`
- `c.notes as client_notes` → `pii_decrypt(c.notes_enc) as client_notes`
- `c.email as client_email` → sin cambios (decisión a).

**`Load Existing Briefing`** — query SQL:
- `client_needs,` → `pii_decrypt(client_needs_enc)::jsonb AS client_needs,`

### `agent_design` (`sMGf7e8CSnsBQa1q`)

**`Load Approved Briefing`** — query SQL:
- `client_needs,` → `pii_decrypt(client_needs_enc)::jsonb AS client_needs,`

`Load Project Data` no toca `phone`/`notes` — solo lee `email` (en plano), sin cambios.

### `agent_proposal` (`Mqx8S6nR6exbRY86`)

**`Load Project + Client`** — query SQL:
- `c.phone as client_phone` → `pii_decrypt(c.phone_enc) as client_phone`.
- Subquery del briefing: `(SELECT row_to_json(b.*) FROM briefings b ...)` → `(SELECT json_build_object('id', b.id, 'version', b.version, 'summary', b.summary, 'objectives', b.objectives, 'client_needs', pii_decrypt(b.client_needs_enc)::jsonb, 'constraints', b.constraints, 'style_preferences', b.style_preferences, 'rooms_affected', b.rooms_affected, 'status', b.status) FROM briefings b ...)`. Solo se exponen los campos que `Build Proposal Prompt` consume.

## Verificación E2E (2026-04-25)

**Roundtrip cifrado/descifrado** sobre BD existente:
```json
{
  "clients_phone_all_match": true,
  "clients_notes_all_match": true,
  "briefings_cn_all_match": true,
  "sample_decrypted_phone": "+34 612 345 678",
  "clients_with_phone_enc": 10,
  "briefings_with_cn_enc": 16
}
```

**Query simulando `agent_briefing.Load Project + Client`** sobre proyecto real `63f51b6e-fed0-4ee5-9ac1-254130d725b9`:
```json
{
  "project_name": "Sec Test",
  "client_email": "sec.test@example.com",
  "client_phone_enc_decrypted": "+34600000000",
  "client_notes_enc_decrypted": null,
  "phone_match": true,
  "notes_match": true
}
```

Las queries leen correctamente los datos cifrados y los devuelven en plano para los agentes.

## Lo que NO cambió

- **INSERT/UPDATE de clients y briefings**: siguen escribiendo en las columnas en plano. Los triggers de migración 009 (`clients_sync_pii_enc`, `briefings_sync_pii_enc`) pueblan automáticamente las columnas `_enc`. Los workflows `init_new_project.Create Client`, `agent_briefing.Save Briefing` no requieren cambios.
- **`init_new_project.Find Existing Client`**: sigue buscando `WHERE email = $1` sobre la columna en plano. Como `clients.email` se mantiene legible, la búsqueda funciona sin necesidad de `email_hash` ni table scan.
- **Otros workflows que leen `email`**: `agent_design.Load Project Data`, `agent_proposal.Load Project + Client`, `util_notification` (si existe), todos siguen leyendo la columna en plano.

## Cómo cerrar el ciclo (fase futura)

Cuando se quiera dropear las columnas en plano para que solo exista la versión cifrada:

```sql
-- Verificar primero que ningún SELECT activo lee las columnas en plano:
--   grep -r "c\.phone\|c\.notes\|client_needs" en los workflows JSON
--   buscar también clients.phone, briefings.client_needs en queries del backend

-- Solo entonces:
ALTER TABLE clients   DROP COLUMN phone, DROP COLUMN notes;
ALTER TABLE briefings DROP COLUMN client_needs;

-- Y eliminar los triggers (ya no son necesarios — los INSERT/UPDATE
-- escribirán directamente en *_enc):
DROP TRIGGER clients_sync_pii_enc ON clients;
DROP TRIGGER briefings_sync_pii_enc ON briefings;

-- Y rotar los INSERTs en los workflows para que escriban directamente:
--   INSERT INTO clients (..., phone_enc, notes_enc, ...) VALUES (..., pii_encrypt($phone), pii_encrypt($notes), ...)
--   INSERT INTO briefings (..., client_needs_enc, ...) VALUES (..., pii_encrypt($client_needs::text), ...)
```

**`email` se mantendría en plano** — esa columna no se dropea por la decisión (a).

## Tabla resumen del estado de cifrado

| Columna | Estado actual | Lectura | Escritura |
|---|---|---|---|
| `clients.email` | Plano (visible) | columna directa | INSERT directo |
| `clients.email_enc` | Bytea poblado por trigger | (no usado en lecturas) | trigger BEFORE I/U |
| `clients.phone` | Plano (visible, redundante) | NO se usa | INSERT directo (trigger pobla `_enc`) |
| `clients.phone_enc` | Bytea, fuente de verdad para lectura | `pii_decrypt(phone_enc)` ✓ | trigger BEFORE I/U |
| `clients.notes` | Plano (visible, redundante) | NO se usa | INSERT directo (trigger pobla `_enc`) |
| `clients.notes_enc` | Bytea, fuente de verdad | `pii_decrypt(notes_enc)` ✓ | trigger BEFORE I/U |
| `briefings.client_needs` | Plano (visible, redundante) | NO se usa | INSERT directo (trigger pobla `_enc`) |
| `briefings.client_needs_enc` | Bytea, fuente de verdad | `pii_decrypt(client_needs_enc)::jsonb` ✓ | trigger BEFORE I/U |

## Espacio para Damián

```
## Decisiones tomadas

- 2026-04-25: opción (a) seleccionada — email queda en plano.
  Razón: sistema single-user, búsqueda por email es funcional, email
  ya aparece en notificaciones y trazas externas (Drive folders, Gmail,
  Calendar). Cifrarlo en BD pero exponerlo en otros sitios sería teatro.

## Cuándo dropear las columnas en plano (phone/notes/client_needs)

- Esperar a tener al menos N proyectos pasados por todos los agentes
  con la nueva configuración: ...
- Verificar logs de pii_decrypt en producción durante: ...
- Decisión final: ...
```
