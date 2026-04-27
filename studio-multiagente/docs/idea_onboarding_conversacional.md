# Idea — Onboarding conversacional para profesionales

**Estado**: PARKING LOT (idea acordada, implementación pospuesta).
**Propuesto por**: Damián, 2026-04-27.
**Por qué pospuesto**: Damián prefiere primero completar la lista de 5 puntos del `REPORTE_15H.md` antes de abrir frente nuevo.

---

## Concepto

Cuando un profesional (arquitecto / oficina) compra el software, en lugar de rellenar un formulario rígido para configurarlo, **conversa con un LLM especializado** ("pequeño cerebro") que le entrevista de tú a tú y extrae todo lo necesario para personalizar los 11 agentes núcleo a su estilo profesional.

Es la diferencia entre:
- **Wizard tradicional**: "Rellena 8 secciones con campos y dropdowns." Cualquier software lo hace.
- **Onboarding conversacional**: "Cuéntame cómo trabajas y voy entendiendo tu estudio." Diferenciador comercial.

## Arquitectura propuesta

```
┌─────────────────────────────────────────────────────────────┐
│ 1. setup_wizard_chat_html (workflow nuevo)                  │
│    GET /webhook/setup-onboarding?session=NEW|<id>           │
│    HTML responsive estilo chat: bubbles, textarea, send.    │
│    Inicia o reanuda una sesión.                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 2. agent_onboarding (workflow conversacional, "el cerebro") │
│    POST /webhook/setup-onboarding-message                   │
│    - Carga session de onboarding_sessions                   │
│    - Carga sections_covered                                 │
│    - Construye prompt entrevistador                          │
│    - util_llm_call → respuesta natural                       │
│    - Persiste mensaje + respuesta + sections_covered        │
└──────────────────┬──────────────────────────────────────────┘
                   │ (cuando 8/8 cubiertas o user dice "ya está")
┌──────────────────▼──────────────────────────────────────────┐
│ 3. agent_onboarding_extract (workflow LLM extractor)         │
│    Lee toda la conversación.                                 │
│    LLM con prompt "extrae JSON estructurado según schema".  │
│    INSERT INTO studio_profile.                               │
│    Notifica al profesional: perfil listo, editable en       │
│    /admin-studio-profile.                                    │
└─────────────────────────────────────────────────────────────┘
```

## 8 secciones a recoger durante la conversación

| # | Sección | Qué captura | Inyectado en |
|---|---|---|---|
| 1 | **Identidad** | nombre estudio, persona principal, colegiado, ciudad, ámbito (reformas / obra nueva / comercial / mixto) | header docs, plantillas, contratos |
| 2 | **Tono comunicación** | formal vs cercano, técnico vs llano, longitud preferida, ejemplos textuales mal/bien | TODOS los agentes con LLM, plantillas email |
| 3 | **Prioridades absolutas** | 5-10 reglas tipo "seguridad > estética", "CTE > rapidez" | agent_design, agent_proposal, agent_briefing |
| 4 | **Líneas rojas / nunca** | 3-7 cosas que NUNCA propones / firmas | agent_proposal, agent_certificate_generator |
| 5 | **Visita inicial — checklist** | datos que SIEMPRE preguntas (ruido vecinos, horarios obra, plano original…) | agent_briefing.open_questions |
| 6 | **Materiales / proveedores preferidos** | marcas habituales por categoría, gama típica | agent_materials (complementa supplier_catalog) |
| 7 | **Gremios / colaboradores** | criterios de selección, mapa trade→contacto preferente | agent_trades, cron_aftercare_sla_breach |
| 8 | **Jurisdicción** | comunidad autónoma principal, ayuntamientos habituales, normativa autonómica adicional | agent_regulatory, permit_register |

## Tablas SQL nuevas requeridas

```sql
-- Migración 042 (futura)
CREATE TABLE IF NOT EXISTS studio_profile (
  studio_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity         jsonb NOT NULL DEFAULT '{}'::jsonb,    -- sec 1
  tone             jsonb NOT NULL DEFAULT '{}'::jsonb,    -- sec 2
  priorities       jsonb NOT NULL DEFAULT '[]'::jsonb,    -- sec 3
  red_lines        jsonb NOT NULL DEFAULT '[]'::jsonb,    -- sec 4
  visit_checklist  jsonb NOT NULL DEFAULT '[]'::jsonb,    -- sec 5
  materials_pref   jsonb NOT NULL DEFAULT '{}'::jsonb,    -- sec 6
  trades_pref      jsonb NOT NULL DEFAULT '{}'::jsonb,    -- sec 7
  jurisdiction     jsonb NOT NULL DEFAULT '{}'::jsonb,    -- sec 8
  setup_completed_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id        uuid REFERENCES studio_profile(studio_id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'in_progress'
                   CHECK (status IN ('in_progress','completed','abandoned')),
  messages         jsonb NOT NULL DEFAULT '[]'::jsonb,
  sections_covered jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  llm_total_cost   numeric(10,5)
);
```

Pensado para multi-tenant desde el inicio: la columna `studio_id` permite que mañana, sin refactor, distintos profesionales compartan instancia.

## Refactor de los 11 agentes

Cada `Build Prompt` Code de los 11 agentes núcleo añadiría un nodo previo `Load Studio Profile` (Postgres) y el JS concatenaría las secciones del perfil al `prompt_system`.

Los `agent_prompts.content` pasarían a usar placeholders `{{studio_tone}}`, `{{studio_priorities}}`, etc. — los agentes los sustituirían en runtime.

## Trade-offs vs el formulario rígido

| Aspecto | Formulario | Chat onboarding |
|---|---|---|
| Tiempo del profesional | 15-20 min | 30-45 min |
| Captura de matices | Bajo (solo lo que cabe en campos) | Alto (LLM puede pedir follow-ups) |
| Coste | 0€ | ~$0.50/sesión con gpt-4o |
| Diferenciación comercial | Baja | Alta |
| Adaptable al ritmo del usuario | No | Sí |
| Facilidad implementación | Más rápida (~5h) | Más cara (~13h) |

**Recomendación cuando se construya**: chat onboarding como modo principal, formulario como fallback opcional para usuarios que prefieren campos directos.

## Esfuerzo estimado total

13-14 horas mías repartidas:
- Migración SQL (`studio_profile` + `onboarding_sessions`): ~30 min
- `setup_wizard_chat_html` (frontend chat responsive): ~2h
- `agent_onboarding` (LLM conversacional): ~3h
- `agent_onboarding_extract` (LLM extractor): ~1.5h
- Refactor 11 agentes para inyectar perfil: ~3h
- `admin-studio-profile` endpoint (ver/editar): ~1.5h
- Testing E2E + iteración: ~2h

Tu input: una sola vez, rellenar el chat (~30-45 min). Esa misma rellena = E2E del propio sistema.

## Por qué se pospone

Damián pidió primero completar las **5 cosas que necesito de él** del `REPORTE_15H.md`:
1. ✅ Migración 041 supplier_catalog seed (hecha 2026-04-27)
2. ⏳ Items reales de proveedores
3. ⏳ Conversación sobre prompts (← parte de esto se materializará en **studio_profile** cuando se construya el onboarding)
4. ✅ Cleanup proyecto test (hecho 2026-04-27)
5. ⏳ Decisiones estratégicas

Cuando los 5 estén cerrados, retomamos esta idea.

## Implicación importante

Lo que Damián me cuente HOY sobre cómo trabaja (en el punto 3 "Conversación sobre prompts") **NO se pierde**. Se convertirá en el primer registro de `studio_profile` cuando se construya el onboarding. El cuestionario que le pasé es exactamente lo mismo que el LLM le preguntará en la conversación, solo que en formato distinto. Por eso conviene que lo responda ahora con calidad: es input doblemente útil.

## Decisión técnica que queda abierta

Multi-tenant V2 (modelo B del REPORTE_15H punto 5). Cuando aparezca el segundo estudio, hacer la migración de `studio_id` a `tenant_id` con RLS Supabase activado.
