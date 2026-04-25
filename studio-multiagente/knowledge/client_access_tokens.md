# Acceso público con tokens — formularios para cliente + project summary

## Estado

- **Migración 017** aplicada: `client_access_tokens` (13 cols) + función `validate_client_token()` + trigger updated_at.
- **3 workflows construidos y activos**:
  - `client_token_create` (`exakZ5PNFcWKIh2F`) — Damián genera tokens (con auth).
  - `aftercare_public_form` (`WHtdrr3tJpei3IM8`) — formulario HTML público (sin auth, validado por token).
  - `aftercare_public_submit` (`x5j2VKbz9tfQyqzl`) — POST sin auth (validado por token), inserta `aftercare_incidents` y notifica a Damián.
  - `project_summary` (`LuTpknJdwLwzUVqc`) — vista HTML consolidada del proyecto (sin auth, validada por token `project_view`).
- **Verificación E2E (2026-04-25)**: token con `aftercare_submit` permite GET form (HTML) + POST submit (con/sin foto). Token con `project_view` permite GET summary (HTML 3KB). Token bad → 404.

## Por qué importa

Antes, para que el cliente reportara una incidencia post-entrega tenía que mandar email a Damián, que copiaba el contenido manualmente. Ahora Damián genera un link único de 90 días y el cliente lo guarda en favoritos. El cliente final NO necesita la API key del sistema.

Mismo patrón para que el cliente vea el estado de su proyecto sin acceso al panel de control: link mágico de 30 días con el resumen consolidado.

## Modelo de datos

### `client_access_tokens`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK projects | proyecto al que da acceso |
| `client_id` | uuid FK clients | (opcional) |
| `token` | text UNIQUE | string aleatorio 40 chars, default `encode(gen_random_bytes(20), 'hex')` |
| `purpose` | text CHECK | `aftercare_submit` \| `project_view` \| `full_access` |
| `issued_at`, `expires_at` | timestamptz | TTL típico 30-90 días |
| `used_count`, `last_used_at` | tracking de uso | |
| `revoked_at` | timestamptz | revocación manual |
| `notes` | text | a qué cliente se le envió |

### Función `validate_client_token(p_token, p_purpose)`

Devuelve `(project_id, token_id, valid, reason)`. Razones de invalidación:
- `token_not_found` — no existe
- `revoked` — `revoked_at` presente
- `expired` — `expires_at < now()`
- `wrong_purpose` — token tiene `purpose` distinto y no es `full_access`
- `ok` — válido (incrementa `used_count`, actualiza `last_used_at`)

Es atómica: validación + tracking en una sola transacción.

## Workflows

### `client_token_create` — Damián genera tokens

`POST /webhook/client-token-create` con `X-API-Key`.

Body:
```json
{
  "project_id": "uuid",
  "purpose": "aftercare_submit | project_view | full_access",
  "expires_days": 90,
  "notes": "Para Maria Garcia"
}
```

Respuesta `201`:
```json
{
  "status": "created",
  "token_id": "uuid",
  "token": "string40chars",
  "project_id": "uuid",
  "purpose": "aftercare_submit",
  "expires_at": "2026-07-24T...",
  "urls": {
    "aftercare_form": "https://.../webhook/aftercare-public-form?token=...",
    "project_summary": "https://.../webhook/project-summary?token=..."
  }
}
```

Damián copia las URLs y se las envía al cliente por el canal que prefiera (email manual, WhatsApp).

### `aftercare_public_form` — formulario público

`GET /webhook/aftercare-public-form?token=<token>` (sin auth).

- Si token inválido → HTML 404 "Enlace no válido".
- Si OK → HTML form con: textarea descripción, input URL foto opcional, input email opcional, botón submit.
- El JS embebido envía `POST /webhook/aftercare-public-submit` con el token.

### `aftercare_public_submit` — recibe el reporte

`POST /webhook/aftercare-public-submit` (sin auth, validado por token).

Body:
```json
{
  "token": "...",
  "description": "qué pasa (>=10 chars)",
  "photo_url": "https://..." (opcional),
  "client_contact": "email" (opcional)
}
```

- Token bad → 401.
- description < 10 chars → 400.
- OK → INSERT `aftercare_incidents` con `reporter='cliente'`, severity default `medium`, status `reported`. Auto-notifica a Damián por email.
- Respuesta `201`: `{ status:'ok', incident_id: '...' }`.

**Nota**: si el cliente sube foto, NO se hace OCR/Vision automático aquí (lo haría `aftercare_submit` interno con autenticación). Esto es a propósito: la incidencia entra como reportada y Damián decide si reanaliza con Vision.

### `project_summary` — vista del proyecto

`GET /webhook/project-summary?token=<token>` (sin auth, validada por `project_view`).

HTML responsivo con:
- Cabecera: nombre, tipo, ubicación, área, fase actual
- Sección Briefing (summary, objetivos, espacios afectados)
- Sección Diseño seleccionado
- Resumen financiero (estimado vs facturado, certificaciones)
- Patologías detectadas (lista coloreada por severity)
- Trámites administrativos
- Postventa LOE (últimas 10 incidencias)

`pii_decrypt(b.client_needs_enc)` para los `client_needs` cifrados (migración 009).

## Cómo se usa (flujo típico)

```bash
# 1. Damián genera token con full_access para Maria (cliente del proyecto X)
curl -X POST .../webhook/client-token-create \
  -H "X-API-Key: ..." \
  -d '{"project_id":"<uuid>","purpose":"full_access","expires_days":180,"notes":"Maria"}'

# Respuesta incluye urls.aftercare_form y urls.project_summary

# 2. Damián envía las URLs a Maria por email/WhatsApp

# 3. Maria reporta una incidencia desde su móvil
#    → abre /webhook/aftercare-public-form?token=...
#    → rellena form, envía
#    → /webhook/aftercare-public-submit hace INSERT y notifica a Damián

# 4. Maria también puede ver el estado de su proyecto cuando quiera
#    → abre /webhook/project-summary?token=...
```

## Próximas iteraciones

1. **Token compartido por proyecto**: hoy cada token es único; si el cliente comparte el link, cualquiera con el link puede acceder. Considerar IP allow-list o bot-detection.
2. **Rotación automática**: después de N usos o tras incidencia detectada, expirar token y mandar uno nuevo.
3. **UI de gestión de tokens**: vista para que Damián vea qué tokens están activos por proyecto y los revoque manualmente.
4. **Subida de foto integrada**: el cliente sube foto directamente al form (multipart). Hoy tiene que pegar URL pública.
5. **Notificaciones al cliente**: cuando el aftercare progresa (assigned, resolved), enviar email automático al `client_contact` registrado.

## Espacio para Damián

```
## Tokens en circulación

- Cliente / proyecto / token / expira / uso:
- ...
```
