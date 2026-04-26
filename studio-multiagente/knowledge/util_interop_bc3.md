# `util_interop_bc3` — Exportador FIEBDC-3 (BC3) para CYPE/Presto

## Estado

- **Workflow** `util_interop_bc3` (`WJUcvxmUQU0wR42l`) activo.
- Endpoint: `POST /webhook/export-bc3` con `X-API-Key` y `{project_id, version?}`.
- **Verificacion E2E (2026-04-26)**: cost_estimate sintetico con 10 partidas (demolicion, tabique pladur, suelo radiante, plato ducha, mampara, carpinteria PVC, pintura, instalacion electrica/fontaneria, mobiliario cocina) por 35.400 EUR -> archivo `1dc2b176_v99_25042026.bc3` de 1066 bytes generado y subido a Drive (carpeta presupuestos).

## Por que importa

ArquitAI sec 3.19 #19: CYPE / Presto / TCQ son parte del dia a dia del oficio en Espana. Hasta hoy, los `cost_estimates` de ArquitAI quedaban en silo (jsonb en Supabase) y el arquitecto tenia que retipear las partidas si queria abrir el presupuesto en CYPE para ajustes finos. Con `util_interop_bc3`:

- **Un click**: `POST /webhook/export-bc3 {project_id}` -> archivo `.bc3` listo para abrir en CYPE/Presto (formato FIEBDC-3/2007 estandar del sector).
- **Sin perder informacion**: cada partida del breakdown se exporta como concepto BC3 con codigo, unidad, cantidad, precio unitario, y descripcion extendida.
- **Multiplica adopcion**: facilita que ArquitAI sea un **orquestador** (briefing, design, materials, costs, propuesta, planificacion) y deje el ajuste fino del presupuesto al software profesional con el que el arquitecto ya tiene fluidez.

Fase 2 deberia anadir el inverso: `util_interop_bc3_import` para que cambios en CYPE refresquen los `cost_estimates`.

## Spec FIEBDC-3 implementada

Formato ASCII delimitado por `~` (registro) y `|` (campo). Cada linea es un registro tipado:

| Tipo | Significado | Estructura |
|---|---|---|
| `~V` | Cabecera version | `~V\|3.1\|FIEBDC-3/2007\|FECHA\|FORMATO_GEN\|VERSION_PRG\|EUR\|` |
| `~C` | Concepto (capitulo, partida, material) | `~C\|<codigo>\|<unidad>\|<resumen>\|<precio>\|<fecha>\|<tipo>\|` (tipo: 0=cap, 1=mat, 2=partida, 3=aux) |
| `~T` | Texto extendido de un concepto | `~T\|<codigo>\|<descripcion_larga>\|` |
| `~D` | Descomposicion (relaciones padre-hijo) | `~D\|<padre>\\<hijo1>\\<cantidad1>\\<hijo2>\\<cantidad2>\\\|` |

Lo que genera ArquitAI:
1. `~V` con metadata (FIEBDC-3/2007, fecha hoy, generador "ArquitAI v1.0", moneda EUR).
2. `~C ##` raiz: el proyecto entero como concepto capitulo (tipo 0) con su nombre y total.
3. Para cada partida del `cost_estimates.breakdown`:
   - `~C <code>`: codigo correlativo (001, 002, ...), unidad (m2/ud/ml), nombre, precio_unit, tipo 2 (partida).
   - `~T <code>` si hay notes/source.
4. `~D ##\\<code>\\<cantidad>\\...\\` con la descomposicion del proyecto.

## Estructura esperada en `cost_estimates.breakdown`

El workflow es **flexible** con el formato de `breakdown`. Acepta:
- `array` directo de partidas, o
- `{items: [...]}` o `{partidas: [...]}`

Cada partida puede tener (todos opcionales con fallbacks):
- `partida` | `name` | `concept` (nombre)
- `unidad` | `unit` (default `pa`)
- `cantidad` | `quantity` (default 1)
- `precio_unit` | `unit_price` (calculado desde importe/cantidad si no esta)
- `importe` | `amount`
- `notes`, `source` (van a ~T)

## Sanitizacion

Caracteres `~`, `|`, `\` en textos se reemplazan por espacio (son delimitadores BC3). Saltos de linea se colapsan. Numeros con 2 decimales (`toFixed(2)`).

## Output

```bash
curl -X POST .../webhook/export-bc3 -H "X-API-Key: ..." -d '{
  "project_id": "<uuid>",
  "version": 99
}'
# -> 200
# {
#   "status": "exported",
#   "filename": "<8charProjectId>_v<version>_<DDMMYYYY>.bc3",
#   "bytes": 1066,
#   "partidas_count": 10,
#   "drive_file_id": "1SB8DiY...",
#   "drive_url": "https://drive.google.com/file/d/.../view"
# }
```

El fichero queda en la carpeta Drive de presupuestos del proyecto (folderId tomado de project metadata).

## Workflow internals

1. Webhook con auth.
2. Validate input (project_id obligatorio, version opcional).
3. Load Cost Estimate: SQL con joins a projects y latest version (o version solicitada).
4. Has Estimate? IF (404 si no hay ninguno).
5. Build BC3 (Code node): genera el contenido FIEBDC-3 segun spec.
6. Build Binary (Code): convierte a base64 + binary item para Google Drive.
7. Upload to Drive (Google Drive node, folder presupuestos).
8. Log Export (activity_log).
9. Respond 200 con drive_url + drive_file_id.

## Queries utiles

```sql
-- Cuantos cost_estimates exportados via BC3
SELECT date_trunc('day', created_at) AS dia, count(*)
FROM activity_log WHERE agent_name='util_interop_bc3' AND action='export_bc3'
GROUP BY 1 ORDER BY 1 DESC;

-- Proyectos con cost_estimate listos para exportar
SELECT p.id, p.name, ce.version, ce.total_estimated, ce.status
FROM projects p
JOIN cost_estimates ce ON ce.project_id = p.id
WHERE ce.breakdown IS NOT NULL AND jsonb_array_length(ce.breakdown) > 0
ORDER BY ce.created_at DESC;
```

## Proximas iteraciones

1. **Import BC3 inverso** (`util_interop_bc3_import`): leer .bc3 modificado en CYPE y actualizar `cost_estimates.breakdown` (con merge inteligente si hay nuevas partidas).
2. **Soporte IFC** (BIM, sec 3.12): requiere libreria IFC pero permitiria interop con Revit/ArchiCAD.
3. **Soporte GAEB** (sec 3.19): para clientes internacionales (Alemania).
4. **Plantilla con descomposicion auxiliar**: las partidas BC3 reales tienen sub-conceptos (mano de obra + materiales). MVP los resume en una sola linea.
5. **Codigos jerarquicos**: usar codigos tipo "01.02.005" en vez de correlativo para mejor legibilidad en CYPE.
6. **Auto-export al cerrar `cost_estimates.status='approved'`**: hook desde agent_costs/agent_proposal.

## Espacio para Damian

```
## Software de presupuestos que uso

- ...

## Ajustes que hago siempre tras importar el BC3 a CYPE

- ...
```
