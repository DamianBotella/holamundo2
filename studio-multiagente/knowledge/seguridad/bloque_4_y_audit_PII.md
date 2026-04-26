# Bloque 4 + auditoría de lecturas PII (preparación Bloque 5)

## Estado

- **`cron_drive_cleanup`** (`6bG0DUrVWo9uBbNz`, activo): elimina backups Drive > 90 días.
- **`cron_security_alerts`** (`A0MgvE97s3IRicmt`, activo): alerta a Damián cuando una IP es bloqueada por rate-limit, con anti-flood de 1h.
- **Auditoría documental** de lecturas PII para Bloque 5 (rotación a `pii_decrypt`).
- **Última revisión**: 2026-04-25.

---

## 1) `cron_drive_cleanup`

### Cómo funciona

- **Schedule**: día 1 de cada mes, 04:00.
- **Manual**: `POST /webhook/trigger-drive-cleanup` con `X-API-Key`.

Pipeline:
1. `Compute Cutoff` — calcula fecha 90 días atrás.
2. `List Old Backups` — query a Drive API: `name contains 'arquitai_backup_' AND createdTime < cutoff AND trashed = false`.
3. `Split Files` + `Delete File` — bucle eliminando uno a uno.
4. `Aggregate Deletions` — calcula total de archivos eliminados y bytes liberados.
5. `Notify Cleanup` — email a Damián con resumen.

### Disparar manualmente

```bash
curl -X POST https://n8n-n8n.zzeluw.easypanel.host/webhook/trigger-drive-cleanup \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <WEBHOOK_API_KEY>" \
  -d '{}'
```

Test verificado 2026-04-25: 0 archivos eliminados (todos los backups creados hoy), email enviado.

---

## 2) `cron_security_alerts`

### Cómo funciona

- **Schedule**: cada 15 minutos.
- **Lógica**:
  - Consulta `rate_limit_log` con `blocked = true` en los últimos 15 min, agrupado por IP.
  - Excluye IPs que ya recibieron alerta en la última hora (anti-flood, lookup en `activity_log` con `agent_name='security_alert'`).
  - Para cada IP nueva: registra en `activity_log` y envía email a Damián con el detalle.
- **Anti-flood**: 1 alerta por IP por hora máximo.

### Email enviado

```
Asunto: ArquitAI ALERTA — IP bloqueada por rate limit: X.X.X.X
Cuerpo:
  IP origen: X.X.X.X
  Endpoints atacados: ['/webhook/orchestrator', '/webhook/new-project']
  Total requests en últimos 15 min: 142
  Minutos con bloqueo activo: 8
  Último hit: 2026-04-25 16:30:00+00
```

### Consultar histórico de alertas

```sql
SELECT created_at, source_ip, input_summary
FROM activity_log
WHERE agent_name = 'security_alert' AND action = 'ip_blocked_alert'
ORDER BY created_at DESC LIMIT 50;
```

---

## 3) Auditoría de lecturas PII (preparación Bloque 5)

La migración 009 dejó las columnas `_enc` cifradas pobladas pero los workflows siguen leyendo las columnas en plano. Para completar el cifrado hay que rotar todas las lecturas a `pii_decrypt(*_enc)` y luego dropear las columnas en plano.

### Lugares que LEEN PII (deben cambiar)

| Workflow | Nodo | Query/Acción |
|---|---|---|
| `agent_briefing` (`uq3GQWSdmoIV4ZdR`) | `Load Project + Client` | `SELECT ... c.email AS client_email, c.phone AS client_phone, c.notes AS client_notes FROM clients c ...` |
| `agent_briefing` | `Load Existing Briefing` | `SELECT id, version, summary, client_needs, ... FROM briefings ...` |
| `agent_design` (`sMGf7e8CSnsBQa1q`) | `Load Project` | `SELECT ... c.email AS client_email FROM clients c ...` |
| `agent_design` | `Load Briefing` | `SELECT ... client_needs ... FROM briefings ...` |
| `agent_proposal` (`Mqx8S6nR6exbRY86`) | `Load Project + Client` | (auditar la query exacta — toca clientes) |
| `init_new_project` (`HzPLldZVJGFjKbuc`) | `Find Existing Client` | `WHERE email = $1` ⚠️ ver caso especial abajo |

### Lugares que ESCRIBEN PII (no requieren cambios)

Los triggers `clients_sync_pii_enc` y `briefings_sync_pii_enc` pueblan las columnas `_enc` automáticamente. Los INSERT/UPDATE existentes funcionan sin cambios:

| Workflow | Nodo | Acción |
|---|---|---|
| `init_new_project` | `Create Client` | `INSERT INTO clients (name, email, phone, notes, ...)` — trigger pobla los `_enc` |
| `agent_briefing` | `Save Briefing` | `INSERT INTO briefings (... client_needs ...)` — trigger pobla `client_needs_enc` |

### Patrón de migración (queries SQL)

Antes:
```sql
SELECT c.email AS client_email, c.phone AS client_phone, c.notes AS client_notes
FROM clients c WHERE c.id = $1::uuid
```

Después:
```sql
SELECT pii_decrypt(c.email_enc) AS client_email,
       pii_decrypt(c.phone_enc) AS client_phone,
       pii_decrypt(c.notes_enc) AS client_notes
FROM clients c WHERE c.id = $1::uuid
```

Para `briefings.client_needs` (jsonb cifrado como texto):
```sql
SELECT pii_decrypt(client_needs_enc)::jsonb AS client_needs
FROM briefings WHERE project_id = $1::uuid
```

### Caso especial: `init_new_project.Find Existing Client`

Esta query busca un cliente existente por su email:
```sql
SELECT * FROM clients WHERE email = $1
```

**Problema**: `pgp_sym_encrypt` (que usa `pii_encrypt`) es **no-determinista** — cada cifrado del mismo plaintext genera un `bytea` distinto. No se puede hacer `WHERE email_enc = pii_encrypt($1)` porque el resultado sería siempre falso.

**Soluciones para Bloque 5**:

a) **Mantener `email` en plano** (no se cifra esta columna). Aceptar que el email del cliente queda visible en BD. Lo más sencillo y la elección práctica si se confía en el control de acceso a la BD.

b) **Añadir columna `email_hash` con HMAC determinista**:
```sql
ALTER TABLE clients ADD COLUMN email_hash bytea;
-- Trigger pobla con: hmac(LOWER(NEW.email), 'static_pepper', 'sha256')
-- Lookup: WHERE email_hash = hmac(LOWER($1), 'static_pepper', 'sha256')
```
Permite búsqueda sin descifrar pero requiere un "pepper" estático guardado fuera de BD (env var del backend).

c) **Escaneo + descifrado** (caro pero viable con pocos clientes):
```sql
SELECT * FROM clients
WHERE pii_decrypt(email_enc) = $1
LIMIT 1;
```
Hace un table scan; aceptable mientras `clients` < 10k filas.

**Recomendación**: opción (a) si el cifrado de email no es requisito hard-coded del cumplimiento; opción (b) si lo es y se quiere mantener búsqueda eficiente.

### Plan de Bloque 5

1. Decidir estrategia para `email` (caso especial arriba).
2. Adaptar `agent_briefing.Load Project + Client` a usar `pii_decrypt(c.*_enc)`.
3. Adaptar `agent_design.Load Project` y `agent_design.Load Briefing`.
4. Adaptar `agent_proposal.Load Project + Client`.
5. Adaptar `agent_briefing.Load Existing Briefing` (campo `client_needs`).
6. Verificar E2E con un proyecto: que los agentes reciben los datos descifrados correctamente.
7. **Solo entonces** dropear las columnas en plano:
   ```sql
   ALTER TABLE clients DROP COLUMN email, DROP COLUMN phone, DROP COLUMN notes;
   ALTER TABLE briefings DROP COLUMN client_needs;
   ```
8. Renombrar `email_enc` → `email_pii` (opcional).

**Tiempo estimado**: 2-3 horas para los puntos 2-6, +30 min para el drop final.

---

## Espacio para Damián

```
## Decisiones Bloque 5

- Estrategia para clients.email (a/b/c): ...
- Pepper para email_hash (si opción b, generado y guardado en): ...
- Fecha en que se ejecutó la rotación: ...
```
