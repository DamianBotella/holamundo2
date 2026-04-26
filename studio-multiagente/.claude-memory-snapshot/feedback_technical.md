---
name: Gotchas técnicos críticos — n8n 2.12.x
description: Errores conocidos y sus soluciones para construir workflows correctamente
type: feedback
originSessionId: 32bee148-6455-4e09-b04c-9ad2f179c99b
---
Estos errores se han producido y corregido en sesiones anteriores. Aplicar siempre sin excepción.

**Why:** n8n 2.12.x tiene comportamientos no documentados que causan fallos silenciosos o errores de validación.

**How to apply:** Antes de subir cualquier workflow, verificar esta lista.

## IF node v2.2
- Siempre añadir estos campos en `conditions.options`:
  ```json
  "options": {
    "version": 2,
    "leftValue": "",
    "caseSensitive": true,
    "typeValidation": "strict"
  }
  ```
- `leftValue: ""`, `caseSensitive: true`, `typeValidation: "strict"` son OBLIGATORIOS — sin ellos el workflow da error de validación
- Operadores UNARIOS (true/false/empty): necesitan `operator.singleValue: true`
- Operadores BINARIOS (equals con boolean): NO añadir `singleValue: true`

## Code node (jsCode)
- Usar template literals (backticks) para strings multilínea — las comillas simples con `\n` dan error de sintaxis
- Siempre `return [{ json: {...} }]`

## Postgres nodes
- Usar `typeVersion: 2.5` siempre
- Añadir `alwaysOutputData: true` cuando el SELECT puede devolver 0 filas
- Los parámetros posicionales van en `options.queryReplacement` como array

## Execute Workflow (sub-workflows)
- Usar `typeVersion: 1.1` con `workflowId: { __rl: true, value: "ID", mode: "id" }`
- El sub-workflow debe estar Published para funcionar en producción

## n8n_update_full_workflow
- Requiere el campo `name` obligatoriamente (da error de validación si no se incluye)

## Credenciales reales (nunca PLACEHOLDER)
- Postgres: `{ "id": "cfxNZdzy0NB3xkYC", "name": "Postgres account" }`
- Gmail: `{ "id": "Y829iKHZi6Lh660e", "name": "Gmail DamianDomeya@" }`
