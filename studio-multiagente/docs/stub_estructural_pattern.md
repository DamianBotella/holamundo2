# Patrón "stub estructural" — guía técnica

Mini-guía interna del patrón usado para sincronizar workflows en `studio-multiagente/workflows/` cuando la versión completa es demasiado grande para encajar en git de forma legible (jsCode largo, prompts embebidos, queries SQL multi-línea).

## Por qué existe el patrón

n8n exporta workflows con todos los `parameters` inline: cada Code node mete su `jsCode` como string JSON, cada Postgres mete su SQL, cada Gmail mete el HTML de la plantilla. Para workflows grandes (15+ nodos con prompts) esto produce JSONs de 50-100KB ilegibles, donde un git diff por un cambio trivial es ruido infumable.

**El stub estructural conserva la topología (qué nodos hay, cómo conectan, qué tipo) y omite los `parameters`** detallados. Hace que el repo sea navegable y que los diffs cuenten cambios de estructura, no de contenido. Para inspeccionar el contenido completo: MCP `n8n_get_workflow id=<id> mode=full`.

## Cuándo usar stub vs JSON completo

| Situación | Patrón |
|---|---|
| Workflow nuevo creado en sesión | JSON completo (mientras tengamos el contenido reciente en cabeza) |
| Workflow heredado de sesiones previas con jsCode largo | Stub estructural |
| Workflow utilitario corto (< 6 nodos) sin code complejo | JSON completo siempre |
| Sub-workflows reutilizables con prompt fijo | JSON completo si prompt es revisable; stub si es para referencia |
| Sincronización masiva de huérfanos | Stub estructural |

Regla de oro: si abrir el JSON local te da contexto útil para entender el workflow, está bien. Si te ahoga en strings, conviértelo en stub.

## Estructura mínima de un stub

```jsonc
{
  "name": "<workflow_name>",                    // identificador humano
  "_n8n_id": "<id real en n8n>",                // para fetch via MCP
  "_note": "Stub sincronizado <fecha> (bloque <N>). Para version completa: mcp__n8n__n8n_get_workflow id=<id> mode=full",
  "_purpose": "<1-3 lineas: que hace el workflow, datos, side-effects>",
  // _campos opcionales que dan contexto (todos empiezan con underscore para no
  // confundirse con campos reales del schema de n8n):
  "_triggers": "<como se invoca>",
  "_persists_to": "<tablas que toca>",
  "_alerts_when": "<condiciones de email/notificacion>",
  "_chain": "<workflows aguas arriba/abajo>",
  "_no_llm": "<si aplica, marca que es deterministico>",

  "nodes": [
    { "id": "...", "name": "...", "type": "n8n-nodes-base.<tipo>", "position": [x, y] },
    // un objeto por nodo, SIN parameters detallados
    // se pueden añadir _campos auxiliares en nodos individuales:
    // { "id": "...", "type": "n8n-nodes-base.postgres", "_query_summary": "..." }
  ],

  "connections": { /* completas, tal cual las exporta n8n */ }
}
```

## Reglas

1. **Conservar IDs reales**: los `id` de los nodos deben coincidir con los reales en n8n. Permite hacer matching cuando alguien lee el stub y el workflow vivo en paralelo.
2. **Conservar `position`**: la geometría del canvas es información útil (orden de lectura, ramas paralelas).
3. **Conservar `connections` completas**: la topología es el activo principal del stub. Si las conexiones están incompletas, el stub no sirve.
4. **NO inventar `parameters`**: o los pones reales, o los omites. Un parameters parcial es peor que ninguno.
5. **`_campos auxiliares` con guión bajo**: cualquier metadato que añadas debe empezar con `_` para distinguirlo de campos del schema real (n8n los ignora si los reimportasen, pero por convención mantenemos la separación).
6. **`_purpose` debe responder**: qué problema resuelve, qué entrada espera, qué efecto secundario produce. Si solo dice "endpoint X" sin contexto, es ruido.
7. **`_n8n_id` es obligatorio**: sin él, no se puede hacer fetch del completo. Es el ancla.

## Ejemplo bueno

`studio-multiagente/workflows/util_admin_notes_list.json`:

```json
{
  "name": "util_admin_notes_list",
  "_n8n_id": "yL2a8zawMoQrZtRH",
  "_purpose": "GET /webhook/admin-notes-list?project_id=<uuid>... Cierra ciclo project_notes (crear via util_admin_note + ver pinned en util_admin_project_view_html + toggle/delete via util_admin_note_toggle + listar via este).",
  "_auth": "headerAuth credential 'Webhook API Key (entrante)'",
  "_response": "{ project_id, count, notes: [...] } orden: pinned DESC, created_at DESC",
  "nodes": [
    { "id": "nl-01", "name": "Webhook GET", "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [-700, 300], "parameters": {/*completos porque es corto*/} },
    ...
  ],
  "connections": {/* completas */}
}
```

(Cuando el workflow es corto, los parameters completos sí caben sin ahogar; mezclar full + stub-en-otros-archivos es perfectamente válido.)

## Anti-ejemplo

```json
{
  "name": "agent_X",
  "nodes": [
    { "id": "x-01", "name": "Webhook" }   // ← falta type, position
  ],
  "connections": {}                        // ← vacío = inútil
}
```

Sin type, position ni connections: ese stub no comunica nada que el lector no pudiese inferir del nombre. Mejor borrarlo que tenerlo así.

## Cómo regenerar un stub si el workflow vivo cambia

1. `mcp__n8n__n8n_get_workflow id=<id> mode=structure` — devuelve nodos (id, name, type, position) + connections, suficiente para regenerar el stub.
2. Comparas con el local. Si la topología cambió (nodos añadidos/removidos, reconectados), reescribes el archivo.
3. Si solo cambió `parameters` interno de un nodo, **el stub no necesita actualizarse** — es exactamente la propiedad que persigue el patrón.

## Stubs sincronizados a 2026-04-26 (bloque 13)

| Workflow | n8n_id | Bloque |
|---|---|---|
| agent_proposal | Mqx8S6nR6exbRY86 | 7 |
| agent_planner | lSUfNw61YfbERI8n | 8 |
| agent_memory | gLxmy7M0UmC7Yzye | 8 |
| cron_external_backup | Hv8RlkxGhCL6g0FQ | 8 |
| util_normativa_fetch | 4a03tQ7Q5nmtBpnI | 8 |
| util_admin_notes_list | yL2a8zawMoQrZtRH | 8 (full) |
| agent_materials | SOJW7SgCrJebLRP8 | 10 |
| cron_unknown_agent_alert | 3fNPnWuFjjcA7pBG | 11 (full) |
| agent_pathology | I34LYGuiWTQ8WJCa | 12 |
| agent_site_monitor | DPy3FBugAbWP10BD | 12 |
| agent_documents | E5uOVocm8GwNH278 | 12 |
| agent_financial_tracker | LEspjLl6VEHPclPG | 12 |
| cron_post_phase_audits | UyfJNFuf17w2BmFU | 12 |
| util_admin_llm_stats_html | QlGwyyV9S4AuVtln | 12 (full) |
| util_admin_pipeline_metrics_html | Zw6iaYTwznmgkeuL | 13 (full) |
| agent_compliance_audit | RzLYzuMiDWBPpo6y | 13 |
| agent_certificate_generator | OqOHU6Uc6FkVWPEu | 13 |
| agent_contracts | Abwnfh4BtHPU9lHg | 13 |
| aftercare_submit | GkcU8G1y3gFOeZp9 | 13 |
| cron_drive_cleanup | 6bG0DUrVWo9uBbNz | 13 |

20 stubs (12 estructurales puros + 8 con parameters completos por brevedad). Lista mantenida en `AUDIT.md`.
