# Auditoría — `agent_regulatory` con criterio Civil Engineer

**Fecha**: 2026-04-27 (B26)
**Fuente del criterio**: `~/.claude/agents/specialized-civil-engineer.md` (de agency-agents-main)
**Objetivo**: identificar huecos de cobertura técnica/normativa en el prompt actual de `agent_regulatory` y proponer enriquecimiento.

---

## TL;DR

El prompt actual cubre **bien la capa administrativa** (licencias, comunicación previa, comunidades) pero **no menciona la capa técnica** que la Administración exige para autorizar cada trámite:
- 0 menciones a CTE-DB (Código Técnico de la Edificación, Documentos Básicos).
- 0 menciones a Eurocódigos (EN 1990–EN 1998) y sus Anejos Nacionales españoles.
- 0 menciones a normativa estructural concreta (EHE-08, EAE).
- No distingue **ULS/SLS** para reformas con afectación estructural.
- No detalla **documentación técnica requerida por trámite** (memoria, planos, ESS/EBSS, cédulas).

Resultado: el agente detecta "necesitas licencia de obra mayor" pero NO dice "y para ella necesitarás proyecto técnico que incluya verificación EN 1992 ULS+SLS, ESS según RD 1627/1997 si >75k€/30d/20 trabajadores, certificado de compatibilidad urbanística, etc." Esa es información que un arquitecto técnico real va a esperar del sistema.

---

## Cobertura actual (prompt vigente en `agent_prompts` table)

✅ **Cubre bien**:
- Distinción intervención estructural vs no estructural.
- Comunicación previa vs licencia de obra mayor.
- Notificación a comunidad de propietarios.
- Lenguaje conservador ("probablemente necesario", "verificar con ayuntamiento").
- Marcaje `status='detected'` + nota de confirmación oficial.
- task_type enumerado (licencia_obra, comunicacion_previa, permiso_comunidad, etc.).
- Priorización (crítico/importante/recomendable/informativo).

❌ **No cubre**:
- Documentos Básicos del CTE (DB-SE, DB-SI, DB-SUA, DB-HE, DB-HS, DB-HR).
- Eurocódigos aplicables (EN 1990–1998) + Anejos Nacionales ES.
- EHE-08 (Instrucción de Hormigón Estructural) y EAE (Acero Estructural).
- Verificación ULS (Estados Límite Últimos) + SLS (Estados Límite de Servicio).
- Requisitos documentales por tipo de trámite (memoria descriptiva vs proyecto técnico vs ESS/EBSS).
- ESS (Estudio de Seguridad y Salud) según umbrales RD 1627/1997 (>75k€ presupuesto, >30 días, >20 trabajadores simultáneos).
- EBSS (Estudio Básico) si NO se cumplen los umbrales anteriores.
- Cédula de compatibilidad urbanística (cambios de uso).
- Plazos legales por tipo de trámite (silencio administrativo positivo/negativo).
- Cálculos estructurales requeridos por la Administración para autorizar (apertura muros, cambios distribución con sobrecarga, etc.).

---

## Huecos por tipo de intervención

### Apertura/derribo muro de carga (afectación estructural)
- **Falta**: cálculo estructural según EN 1992-1-1 (hormigón) o EN 1996 (mampostería); estudio previo de afectación a forjados; refuerzos (UPN, IPE, hormigón); verificación ULS+SLS de la nueva estructura; coordinación con comunidad si afecta elementos comunes.

### Reforma integral con redistribución
- **Falta**: aplicación DB-SUA (accesibilidad, dimensiones mínimas), DB-HE (mejora energética obligatoria si >25% envolvente), DB-HR (aislamiento acústico entre viviendas), comprobación cumplimiento HD-HS3 (ventilación), DB-SI si afecta a sectorización.

### Cambio de distribución con afectación instalaciones
- **Falta**: REBT (RD 842/2002) certificación instalación eléctrica; RITE (RD 1027/2007) si toca clima/calefacción; nuevo certificado eficiencia energética RD 235/2013 si tras reforma cambia >25% envolvente.

### Demolición parcial
- **Falta**: estudio previo cargas; gestión RCDs (residuos construcción/demolición) según RD 105/2008; plan de seguridad estructural durante demolición.

### Rehabilitación energética (común en reformas integrales)
- **Falta**: detección obligatoriedad mejora envolvente DB-HE 1; obligatoriedad EE post-reforma; subvenciones autonómicas potenciales (PREE, MITECO, etc.).

---

## Propuesta de enriquecimiento — versión v2 del prompt

### Cambios al system prompt

1. **Añadir contexto técnico-normativo español** (no solo administrativo):
   - Bloque "MARCO TÉCNICO ESPAÑOL" con CTE + DBs aplicables + Eurocódigos + EHE-08 + EAE + REBT + RITE + RD 1627/1997.
   - Bloque "ANEJO NACIONAL ESPAÑOL" recordando que los Eurocódigos tienen NDP (parámetros nacionales) específicos.

2. **Mapear intervención → trámites con requisitos técnicos**:
   - Tabla mental: "si intervención afecta estructura → licencia obra mayor + proyecto técnico EN 1992/EAE + ESS o EBSS según presupuesto + …".

3. **Añadir nuevos task_types**:
   - `estudio_seguridad_salud` (ESS, RD 1627/1997, presupuesto >75k€)
   - `estudio_basico_ss` (EBSS, presupuesto <75k€)
   - `proyecto_tecnico` (memoria + planos + mediciones + presupuesto + cumplimiento CTE)
   - `certificado_eficiencia_energetica` (RD 235/2013)
   - `gestion_rcd` (residuos construcción demolición, RD 105/2008)
   - `cedula_compatibilidad_urbanistica` (cambios de uso)
   - `boletines_instalaciones` (REBT, RITE, fontanería)
   - `cumplimiento_db_sua_accesibilidad` (DB-SUA del CTE)

4. **Añadir output structurado adicional**: por cada trámite, rellenar `documentation_required` (array de docs concretos) y `code_references` (array de DB CTE/Eurocódigos aplicables).

5. **Mantener** el lenguaje conservador y los safeguards actuales.

### Cambios al user template

- Añadir `pathology_findings` (si existen patologías estructurales detectadas → activan trámites adicionales).
- Añadir `presupuesto_obra_estimado` (umbral RD 1627/1997 ESS vs EBSS).
- Añadir `duracion_estimada_dias` y `trabajadores_simultaneos_max` (umbrales adicionales RD 1627/1997).

---

## Riesgo del cambio

**Bajo**: estamos enriqueciendo el prompt, no cambiando el output schema (los `regulatory_tasks` se siguen guardando igual; solo añadimos nuevos task_types al ENUM). El parser actual no rompe.

**Mitigación**: si el LLM produce task_types fuera del enum tras el enriquecimiento, el INSERT a `regulatory_tasks` los acepta como string libre (no hay constraint estricto en BD).

---

## Aplicación

1. **Migration `044_agent_regulatory_prompt_v2.sql`** — UPDATE del prompt en tabla `agent_prompts`.
2. **`prompts/agent_prompts.md`** — sección AGENT_REGULATORY actualizada (fuente de verdad histórica).
3. **Validación E2E** sobre un proyecto stub real cuando el sistema reciba tráfico.

Coste tiempo aplicación: 15 min. Beneficio: el agente pasa de "checklist administrativo" a "asistente técnico real de un arquitecto técnico español".
