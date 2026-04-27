# Lista de tareas para Damián — sesión 2026-04-27

> Trabajo autónomo cubierto en B20-B24 mientras descansabas. Aquí lo que necesito de ti para seguir avanzando, **ordenado por urgencia/impacto**.

---

## TL;DR — qué se hizo sin ti

1. **Onboarding conversacional con LLM (B20-B21)** — un "pequeño cerebro" que habla con el profesional para configurar `studio_profile` (identity, tone, priorities, red_lines, visit_checklist, materials_pref, trades_pref, jurisdiction). Frontend HTML responsive en `/webhook/setup-onboarding`. Admin dashboard en `/webhook/admin-studio-profile`.
2. **Migration 042** — tablas `studio_profile` + `onboarding_sessions` + función SQL `get_active_studio_profile()` + baseline seed (un perfil genérico activo hasta que un profesional real complete onboarding).
3. **Inyección studio_profile en 10 de 11 agentes núcleo (B22-B24)** — los agentes leen el perfil activo y prepend un bloque `_STUDIO_CONTEXT` al systemPrompt. Hoy con baseline el comportamiento es indistinguible del genérico, pero en cuanto un arquitecto real haga onboarding, los outputs se adaptarán a su tono/prioridades/líneas rojas/jurisdicción.
4. **Cron `cron_onboarding_session_review` (B24)** — vigila sesiones de onboarding paradas >7d y manda email para retomarlas o cerrarlas.

---

## Cosas que NECESITO de ti — orden de prioridad

### 🔴 P0 — Bloqueante para validar el refactor (impacto: alto, esfuerzo tuyo: 10 min)

**Conseguir un arquitecto real beta-tester que complete el chat de onboarding.**

Por qué: hasta que exista un perfil real (no el baseline), no puedo validar que la inyección studio_profile produce outputs **diferentes** y **coherentes** con el perfil. Refactorizar 10 agentes "a ciegas" sin poder comparar antes/después es trabajo sin feedback.

Cómo:
1. Comparte el link `https://n8n-n8n.zzeluw.easypanel.host/webhook/setup-onboarding` con un conocido arquitecto técnico/aparejador (LinkedIn, Telegram, comunidad).
2. Pídele que dedique 15-20 minutos hablando con el chat. El bot le pregunta por sus 8 secciones con tono humano.
3. Cuando complete, el sistema crea automáticamente una fila en `studio_profile` con `setup_source='onboarding_chat'` que desplaza el baseline.
4. Avísame en la siguiente sesión y haré E2E completo antes/después para validar que los outputs reflejan ese perfil real.

Si no tienes a nadie cerca: yo mismo puedo simular un perfil sintético "en frío" para hacer el A/B (menos válido pero acelera).

---

### 🟡 P1 — Decisión de producto (impacto: medio, esfuerzo tuyo: 5 min)

**Decidir qué hacer con `agent_documents` y `agent_trades`.**

Estos dos NO usan LLM (son deterministas), por eso no tienen inyección studio_profile. Pero podrían beneficiarse de algunos campos del perfil:
- `agent_documents`: estructura de carpetas de Drive podría seguir el `identity.estructura_drive_pref` del estudio (si lo tuvieran configurado).
- `agent_trades`: cuando manda RFQs, el cuerpo del email podría usar `tone.proveedores` y la lista de trades preferidos podría priorizar `trades_pref.criterios_seleccion`.

Opciones:
- **A** Convertirlos en mini-LLM (esfuerzo: ~1h cada uno). Más adaptables pero más caros.
- **B** Hacer template-based con substitución desde studio_profile (esfuerzo: ~30min cada uno). Sin coste LLM, menos flexible.
- **C** Dejarlos como están (genéricos profesionales). Es lo que está activo ahora.

Mi recomendación: **B** para `agent_trades` (el email a proveedores es la cara visible y el tono importa) y **C** para `agent_documents` (estructura de carpetas es invisible al cliente final).

Tu decisión: ___

---

### 🟡 P2 — Validar campos del baseline genérico (impacto: medio, esfuerzo tuyo: 15 min)

Yo generé un baseline genérico en `studio-multiagente/docs/perfil_predeterminado_arquitecto.md` con valores por defecto que considero razonables para un estudio de arquitectura técnica español de reformas. Como tú no eres arquitecto, no puedo verificar si:
- Los **trades preferidos** (albañil, fontanero, electricista, carpintero, pintor, instalador clima) coinciden con los oficios reales del sector.
- Las **prioridades por defecto** (1. seguridad estructural, 2. cumplimiento normativo, 3. presupuesto, 4. plazos, 5. estética) son el orden habitual.
- Las **líneas rojas** ("no aceptar trabajos sin licencia", "no skip de fase de proyecto", etc.) cubren los riesgos típicos.
- La **jurisdicción** (CCAA: Madrid por defecto) tiene sentido como neutral.

Lo que necesito: lee ese doc y dime "ok" o lista los campos que cambiarías. Si no tienes criterio fuerte: marca "ok" y lo iteramos cuando llegue el primer arquitecto real.

---

### 🟢 P3 — Feedback general (impacto: bajo, esfuerzo tuyo: 5 min)

**¿Cómo quieres que use el budget de horas autónomas a partir de ahora?**

Opciones que puedo perseguir si me dejas trabajar:
- **A** Construir los siguientes agentes pendientes de la sec 3 de `ArquitAI.md` (5-10 oportunidades nuevas: agent_marketing, agent_concept_3d, agent_landlord_communication, etc.)
- **B** Mejorar los agentes existentes con LightRAG sobre normativa real (CTE, RD 1627/1997, etc.) — solución profunda al problema de hallucination.
- **C** Construir la interfaz Foxhole (V3) — frontend completo para que un arquitecto vea sus proyectos sin n8n.
- **D** Crear E2E tests automatizados (cron diario que ejecuta un proyecto stub completo y reporta si algún agente falla).
- **E** Multi-tenant real — preparar el sistema para que varios estudios usen el mismo deploy (RLS Postgres + UI selector).

Mi recomendación: **D** primero (red de seguridad), luego **A** (más valor para vender el software), **E** (cuando empiece a escalar a >1 cliente).

Tu decisión: ___

---

## Estado del sistema (snapshot)

- **Workflows en n8n**: ~145 activos (B24 añade 1: cron_onboarding_session_review).
- **Agentes con studio_profile activo**: 10/11 LLM-using (todos menos documents/trades que no usan LLM).
- **Pipeline E2E**: probado satisfactorio en sesiones previas (briefing → design → regulatory → materials → costs → proposal). No re-probado tras la inyección studio_profile porque con baseline el comportamiento es ~igual al previo (por diseño).
- **Onboarding chat**: vivo en producción esperando primer profesional real.
- **Admin dashboards**: 20+ activos, todos linkeados desde `/webhook/admin-index`.

## Documentos clave para leer (priorizado)

1. `studio-multiagente/docs/patron_inyeccion_studio_profile.md` — el patrón aplicado.
2. `studio-multiagente/docs/perfil_predeterminado_arquitecto.md` — baseline para validar (P2).
3. `studio-multiagente/docs/idea_onboarding_conversacional.md` — diseño del onboarding LLM.
4. `studio-multiagente/CHANGELOG.md` — todo el detalle de B20-B24.

---

**Cuando vuelvas**: léelo, decide P0/P1/P2/P3, y seguimos.
