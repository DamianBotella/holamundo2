# `agent_accessibility` — Auditor automático de accesibilidad

## Estado

- **Workflow n8n**: `s7ctmUsITOWK7cRT`. 11 nodos. Activo.
- **Tabla principal**: `accessibility_audits` (migración 005).
- **Prompt**: en `agent_prompts` (`agent_name = 'agent_accessibility'`, ~5.250 chars).
- **Última revisión**: 2026-04-25.
- **Consume**: `briefings`, `design_options.rooms_layout`, `projects.property_type`.
- **Genera**: `accessibility_audits` + `project_intelligence` entry.

## Input

```json
{ "project_id": "<uuid del proyecto>" }
```

Lee del proyecto: tipo (vivienda/local), property_type, rooms_layout del design seleccionado, briefing aprobado (constraints + objetivos + necesidades cliente).

## Output (JSON devuelto y guardado)

```json
{
  "applies_to_project": true | false,
  "applies_justification": "razón de obligatoriedad o no",
  "overall_compliance": "compliant | partial | non_compliant | pending",
  "compliance_issues": [
    {
      "location": "baño principal",
      "parameter": "ancho libre puerta",
      "required_value": "≥80 cm",
      "detected_value": "70 cm aproximado",
      "normativa": "DB-SUA 9 / Orden VIV/561/2010",
      "severity": "critica | alta | media | baja",
      "impact": "consecuencia técnica o legal",
      "correction_options": [
        { "option": "...", "cost_impact": "bajo|medio|alto", "feasibility": "viable|complejo|inviable" }
      ]
    }
  ],
  "recommendations": [
    {
      "category": "obligatorio | recomendado | comercial",
      "recommendation": "string",
      "justification": "string"
    }
  ],
  "commercial_argumentation": "texto en lenguaje cliente listo para usar"
}
```

## Cuándo aplica DB-SUA 9 obligatoriamente

| Caso | Aplicación |
|---|---|
| Vivienda unifamiliar privada | NO obligatorio salvo casos especiales |
| Piso individual privado | NO obligatorio salvo casos especiales |
| Reforma para uso turístico o colaborativo | SÍ obligatorio |
| Vivienda adaptada por solicitud expresa | SÍ obligatorio |
| Edificio con acceso común a ≥12 viviendas | SÍ en zonas comunes |
| Cambio de uso (local→vivienda, local→público) | SÍ aplica completo |

El agente detecta automáticamente esto y, si no aplica, igualmente genera `recommendations` por buenas prácticas + `commercial_argumentation` para que el arquitecto venda mejoras.

## Parámetros que verifica

### Puertas
- Ancho libre paso accesible: ≥80 cm.
- Altura libre: ≥210 cm.
- Espacio libre maniobra ambos lados: Ø 120 cm.
- Resistencia mecanismo: ≤25 N.
- Altura tirador: 80-120 cm.

### Pasillos
- Ancho libre: ≥100 cm (ideal 120 cm).
- Espacio Ø 120 cm en cruces y extremos.
- Pendiente: ≤6% si >6 m, ≤8% si 3-6 m, ≤10% si <3 m.

### Baño accesible (cuando aplica)
- Espacio maniobra Ø 150 cm.
- Inodoro borde 42-45 cm, lavabo borde 82-85 cm.
- Grifo monomando palanca ≥10 cm o sensor.
- Plato ducha enrasado con pendiente 2%.
- Barras apoyo 70-75 cm del suelo.

### Resbaladicidad solados (DB-SUA 1)
- Zonas secas interiores: clase 1 mínimo.
- **Zonas húmedas (baño, cocina): clase 2 — OBLIGATORIO siempre**.
- Ducha, piscina: clase 3.
- Exterior cubierto: clase 2; descubierto: clase 3.

### Mecanismos eléctricos
- Interruptores: 80-120 cm.
- Enchufes: 40-120 cm.
- Timbres, telefonillo: 90-120 cm.

### Vidrios y barandillas
- Bañera/ducha vidrio: templado o laminar (seguridad).
- Barandillas hasta 6 m caída: ≥90 cm.
- Distancia entre barrotes: ≤10 cm.

## Cómo se invoca

Vía **Execute Sub-workflow** desde otro agente o vía webhook directo:

```javascript
// Desde otro workflow n8n
{
  "workflowId": "s7ctmUsITOWK7cRT",
  "input": { "project_id": "<uuid>" }
}
```

Output devuelto: `{ status, audit_id, applies, overall_compliance, issues_count, project_id }`.

## Cuándo se ejecuta

Por diseño, **bajo demanda post-design_done**. Ideal:
- Tras aprobación de design para auditar antes de pasar a regulatory.
- Antes de propuesta comercial para incorporar argumentación.
- Manualmente si el arquitecto quiere validar una variación.

No está integrado en `main_orchestrator` automáticamente — se invoca explícitamente cuando el arquitecto lo necesita (es opcional según el proyecto).

## Limitaciones conocidas

1. **Calidad de output depende de `rooms_layout`**: si el design solo tiene strings genéricos sin dimensiones, `overall_compliance` saldrá "pending". El agente requiere datos cuantificables para auditar contra umbrales.
2. **No valida planos 2D**: trabaja con texto del design, no con CAD. Para validación geométrica precisa hace falta `agent_3d_design` (post-MVP).
3. **Normativa autonómica**: prompt actual cubre DB-SUA + Orden VIV/561/2010 estatal. Para Madrid CAM, Cataluña, etc. hace falta enriquecer con las normas autonómicas específicas (pendiente, requiere que Damián aporte los textos).

## Lo que aporta al proyecto

| Antes de `agent_accessibility` | Después |
|---|---|
| Arquitecto tiene que recordar todos los parámetros DB-SUA al revisar design | Lista automática con norma + valor requerido + corrección |
| Detección de incumplimientos en obra (caro de rehacer) | Detección antes de ejecución |
| Argumentación comercial improvisada cliente a cliente | Texto preparado y consistente |
| DB-SUA 1 (resbaladicidad) frecuentemente olvidado en cocinas/baños | Verificación sistemática clase 2 |

## Ejemplo de output (proyecto E2E `1dc2b176`)

- `applies_to_project: false` (piso individual privado, no aplica obligatorio).
- `recommendations`: 5 (3 "comercial" sobre ducha enrasada/REBT/CTE HE + 2 "recomendado" sobre ancho puertas/pavimento antideslizante).
- `commercial_argumentation`: "Si en 10 años la familia cambia o se alquila, será más caro adaptarlo entonces que hacerlo ahora con una inversión adicional en puertas más anchas, pavimento antideslizante y ducha enrasada..."

## Espacio para Damián

```
## Mis criterios específicos de accesibilidad

- Cuándo siempre recomiendas ducha enrasada vs. plato extraplano:
  ...

- Tu argumentario comercial preferido para cliente reacio:
  ...

- Casos donde has visto en obra que no se respetó accesibilidad y costó rehacer:
  ...
```

Cuando rellenes esta sección, lo integro en el prompt para personalizar el output.
