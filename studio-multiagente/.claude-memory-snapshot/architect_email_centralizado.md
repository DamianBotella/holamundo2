---
name: Email del arquitecto centralizado en system_config.architect_email
description: Como cambiar la direccion destino de TODAS las notificaciones del sistema en un solo sitio
type: project
originSessionId: 32bee148-6455-4e09-b04c-9ad2f179c99b
---
A partir del 2026-04-25, el email del arquitecto NO está hardcodeado en los workflows. Vive en `system_config.architect_email`.

**Para cambiarlo en TODO el sistema (29 workflows, 21 nodos email):**
```sql
UPDATE system_config SET value='nueva.direccion@x.com' WHERE key='architect_email';
```
Surte efecto en la siguiente ejecución de cada workflow. Sin redespliegue.

**Why:** Antes había 21 nodos hardcodeados con `botelladesdeel98@gmail.com` distribuidos en 17 workflows. Cambiar la dirección era tedioso, error-prone, y se quedaban referencias muertas. Ahora el cambio es atómico.

**How to apply:** Si construyes un workflow nuevo que envíe email a Damián:
1. Añade un nodo Postgres `Load Architect Email` cerca del trigger:
   ```
   query: SELECT value FROM system_config WHERE key = 'architect_email'
   credentials: cfxNZdzy0NB3xkYC (Postgres account)
   ```
2. En el nodo Gmail, `sendTo: ={{ $('Load Architect Email').first().json.value }}` (debe empezar con `=`).
3. NUNCA escribas `botelladesdeel98@gmail.com` literal en parámetros de nodos.
4. Si el workflow tiene multi-trigger (Schedule + Manual Webhook), conecta AMBOS triggers a `Load Architect Email`.

Ver migración: `studio-multiagente/schemas/migrations/019_architect_email_centralizado.sql` para la lista completa de workflows ya migrados.
