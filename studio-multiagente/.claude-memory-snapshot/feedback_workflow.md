---
name: Cómo trabajar con Damián
description: Preferencias de trabajo: autonomía total, sin imports manuales, n8n vía MCP
type: feedback
originSessionId: 32bee148-6455-4e09-b04c-9ad2f179c99b
---
Damián quiere que yo gestione todo en n8n de forma autónoma usando el MCP. No hace imports manuales ni configura nodos — solo asigna credenciales en la UI de n8n (que no se pueden hacer por API) y pulsa Publish cuando se lo pido.

**Why:** Es más eficiente y evita errores humanos en la importación.

**How to apply:** Siempre usar mcp__n8n__n8n_update_full_workflow o n8n_update_partial_workflow para subir cambios. Nunca entregar JSON para importar manualmente a menos que el MCP falle.

## Sobre el SQL de Supabase
El SQL sí lo ejecuta Damián manualmente en el SQL Editor de Supabase. Darle siempre el bloque completo en un solo copy-paste, con IF NOT EXISTS para que sea idempotente.

## Estilo de respuesta
- Respuestas cortas y directas
- Sin teoría vacía
- Cuando algo está listo, decirlo con una tabla de estado clara
- Si necesito que haga algo en Supabase o n8n, darlo como una lista de pasos numerados muy concreta
