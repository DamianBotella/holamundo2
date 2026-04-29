# Auditoría — `agent_safety_plan` con criterio Civil Engineer

**Fecha**: 2026-04-27 (B26 P2)
**Fuente del criterio**: `~/.claude/agents/specialized-civil-engineer.md` (de agency-agents-main)
**Fuente de comparación**: `knowledge/seguridad/RD_1627_1997_resumen.md` (knowledge file actual del agente)
**Objetivo**: identificar mejoras al output schema y procedimiento, no al prompt directo (el prompt vive en `agent_prompts` table, no accesible esta sesión por MCP n8n caído).

---

## TL;DR

`agent_safety_plan` está **mejor cubierto técnicamente** que `agent_regulatory` lo estaba antes de v2. Tiene knowledge file detallado (146 líneas) con:
- ✅ EBSS vs PSS umbrales correctos (RD 1627/1997 art. 4.1).
- ✅ CSS designación (art. 3 + funciones art. 9).
- ✅ Riesgos por fase (demolición, civil, eléctrico, fontanería, pladur, solados, carpintería, pintura).
- ✅ Concurrencia art. 24 LPRL + RD 171/2004.
- ✅ AMIANTO (RERA) flagged.

Lo que **el Civil Engineer aporta de extra**:
1. **Trazabilidad normativa por riesgo** — referenciar CTE-DB y Eurocódigos aplicables en cada `phase_with_risks` (no solo "RD 1627/1997").
2. **Coherencia con agent_regulatory v2** — la "regla de oro" detecta proyecto que requiere ESS, agent_safety_plan debe **producir** ese ESS. Hoy no hay handoff explícito de la decisión EBSS vs ESS desde regulatory hacia safety_plan.
3. **Distinción documental EBSS/PSS** — el ESS (Estudio de Seguridad y Salud) NO es lo mismo que el PSS (Plan elaborado por contratista). Verificar el agente no los confunde.
4. **Anejos técnicos al EBSS** — el Civil Engineer recomienda incluir cálculos auxiliares si aplican (ej: cálculo de apuntalamiento en demoliciones, cargas máximas en forjados durante obra).

---

## Cobertura actual vs mejoras propuestas

### Lo que el knowledge file ya dice bien

✅ EBSS si NO se cumplen los 4 supuestos del art. 4.1 → mayoría de reformas vivienda.
✅ PSS lo elabora el contratista, NO el agente del estudio. El agente genera EBSS, no PSS.
✅ Estructura JSON output con `document_type`, `phases_with_risks`, `general_collective_protections`, `general_epis`, `emergency_protocol`, `hygiene_facilities`, `simultaneous_activities`, `training_required`, `medical_surveillance`, `recommendations_to_architect`.
✅ Riesgos por fase con `severity`, `probability`, `preventive_measures`, `collective_protections`, `epis_required`.
✅ AMIANTO en pre-2002 → DETENER + empresa RERA.

### Mejoras propuestas (no urgentes — el sistema funciona)

#### 1. Añadir `code_references` por riesgo
Hoy: cada riesgo lista solo medidas preventivas/EPIS. Mejora: añadir array de normativa de respaldo.

```json
{
  "phase_name": "Demolición",
  "specific_risks": [
    {
      "risk": "Caída a distinto nivel",
      "severity": "alta",
      "code_references": ["RD 1627/1997 Anexo IV.A.1", "UNE-EN 363 (sistemas anticaídas)", "UNE-EN 397 (cascos)"],
      "preventive_measures": [...],
      "epis_required": [...]
    }
  ]
}
```

Beneficio: el EBSS firmado tiene trazabilidad explícita; un inspector trabajo o seguro puede verificar qué norma respalda cada decisión.

#### 2. Campo `applies_when_estructural` en cada fase
Hoy: las fases se generan por defecto (demolición, civil, instalaciones, etc.). Mejora: marcar cada fase con `applies_when_estructural: true|false` para que en proyectos sin afectación estructural, las fases que no apliquen se omitan.

#### 3. Handoff explícito desde agent_regulatory
Hoy: agent_safety_plan se ejecuta en su fase del orquestador independientemente de regulatory.
Mejora (orquestador): si `regulatory_tasks` contiene un `task_type='estudio_seguridad_salud'` con priority='critico' → flag al input de safety_plan `recommended_document_type='ESS'` para que el agente ajuste el output a la complejidad mayor.

Sin este handoff, el agente decide EBSS/PSS solo con presupuesto/duración del proyecto, lo cual es correcto para 95% casos pero pierde info del análisis previo de regulatory.

#### 4. Cálculos auxiliares del Civil Engineer (cuando aplique)
Para fases con demolición de elementos estructurales, el Civil Engineer recomienda incluir un anejo con:
- Cargas estimadas durante obra (acumulación escombros sobre forjado).
- Apuntalamientos necesarios (cálculo simple Eurocode EN 1992 fila contrarresta).
- Verificación que el forjado existente soporta las cargas temporales.

Hoy: no se incluye en el output de safety_plan (lo hace el proyecto técnico de agent_regulatory por separado).
Mejora: añadir campo opcional `structural_safety_during_works` con referencia al cálculo del proyecto técnico (`code_references: ["EN 1992-1-1 7.4 (deflection)", "EHE-08 Anejo 12"]`).

#### 5. Output `pdf_layout_hints` (para Document Generator)
Cuando el output JSON se convierta a PDF firmable (próxima evolución vía agente Document Generator), conviene que el JSON ya incluya hints:
- `cover_page`: {project_name, address, document_type, technical_director, css}
- `signature_blocks`: [{role, name, college, date_placeholder}]
- `legal_disclaimers`: array de textos legales preceptivos

Esto **prepara el terreno** para el siguiente paso (PDF nativo firmable) sin tocar el agente todavía.

---

## Riesgo del cambio

**Muy bajo**. Las mejoras 1-2 y 5 son **adiciones al schema** (campos nuevos opcionales). El parser de safety_plan acepta JSON con campos extra sin romper.

La mejora 3 (handoff) requiere tocar el orquestador (87 nodos) y el input de safety_plan workflow — **alto coste de implementación**, beneficio modesto. Pausar hasta que MCP n8n vuelva.

La mejora 4 (cálculos auxiliares) es opcional, alto valor técnico pero exige LLM con conocimiento estructural (claude-sonnet-4 lo tiene).

---

## Aplicación pragmática

**Esta sesión (sin MCP n8n)**: solo documentar la auditoría (este archivo).

**Próxima sesión (con MCP n8n)**:
1. Extraer prompt actual de `agent_safety_plan` desde `agent_prompts` table.
2. Añadir al system prompt instrucciones para los nuevos campos (1, 2, 5).
3. Aplicar como migration 046_agent_safety_plan_prompt_v2.sql.
4. Validar E2E sobre proyecto stub.

**Sesión Document Generator** (paralelo): construir `scripts/safety_plan_to_pdf.py` que toma una fila de `safety_plans` y genera PDF firmable con `weasyprint` (HTML+CSS → PDF). Reemplaza el paso humano "JSON → Google Doc → exportar PDF → firmar".

---

## Conclusión honesta

`agent_safety_plan` no necesita cambios urgentes. Está bien construido. Las mejoras propuestas son **incrementales** y se aplicarán cuando se desbloquee el MCP n8n.

**El mayor valor real** del Civil Engineer en este área es para `agent_regulatory` (ya aplicado en B26 v2) y para futuro **agente structural_engineer** (no construido aún, sería el que hace cálculos ULS+SLS reales sobre intervenciones estructurales — Fase 3 del proyecto, post-MVP).
