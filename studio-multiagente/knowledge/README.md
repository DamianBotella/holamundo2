# knowledge/ — Conocimiento alimentado a los agentes de ArquitAI

Esta carpeta es la **fuente de verdad técnica** que los prompts de los agentes usan como contexto. Cada agente carga solo los archivos relevantes a su especialidad (inyectados en `prompt_system` o, post-MVP, recuperados vía RAG semántico con LightRAG).

## Filosofía

- Un archivo = un tema acotado, navegable en 5 min.
- Formato Markdown para que un humano pueda revisar y corregir.
- **Nunca** inventar cifras o artículos de normativa: todo se cita con referencia al documento oficial.
- Cada archivo lleva cabecera `## Estado` indicando quién lo mantiene y cuándo se actualizó.

## Convención de nombrado

```
knowledge/
├── {tema_raiz}/
│   ├── {subtema}.md         ← contenido técnico
│   └── {subtema}/           ← carpeta si el subtema tiene múltiples archivos
│       ├── ejemplo_1.md
│       └── ejemplo_2.md
```

## Estado de cada sección (2026-04-24)

| Carpeta | Archivos creados | Pendiente (tú) | Consumido por |
|---|---|---|---|
| `normativa/cte/` | vacío | Bajar PDFs oficiales del CTE desde [codigotecnico.org](https://www.codigotecnico.org) | agent_regulatory, agent_accessibility, agent_energy_assessor |
| `normativa/cte_indice.md` | ✅ (yo) | Revisar y añadir artículos que tú uses frecuentemente | todos los agentes técnicos |
| `normativa/loe.md` | ✅ (yo) | Nada crítico | agent_regulatory, agent_proposal |
| `normativa/autonomica/madrid/` | vacío | Decreto habitabilidad CAM, accesibilidad Madrid, etc. | agent_regulatory |
| `normativa/municipal/madrid/` | vacío | PGOU Madrid, ordenanzas específicas | agent_regulatory, agent_permit_tracker |
| `construccion/fases_de_obra.md` | ✅ (yo) | Tus plazos típicos por fase | agent_planner |
| `construccion/patologias.md` | ✅ (yo) | Casos reales que hayas visto | agent_pathology (futuro) |
| `construccion/detalles_constructivos/` | carpeta vacía | Tus detalles favoritos (fachada, cubierta, tabiquería) | agent_design, agent_documents |
| `instalaciones/electrica_REBT.md` | ✅ (yo) | Tu know-how específico | agent_design, agent_costs |
| `instalaciones/fontaneria_CTE_HS.md` | ✅ (yo) | Idem | agent_design, agent_costs |
| `instalaciones/climatizacion_RITE.md` | ✅ (yo) | Idem | agent_design, agent_costs |
| `instalaciones/domotica_KNX_Matter.md` | ✅ (yo) | Tus integradores de confianza | agent_home_automation (futuro) |
| `accesibilidad/DB-SUA_checklist.md` | ✅ (yo) | Revisar | agent_accessibility (futuro), agent_briefing constraints |
| `economico/honorarios_profesionales.md` | ✅ (yo) | Tus tarifas reales actualizadas | agent_proposal |
| `economico/impuestos_y_tasas.md` | ✅ (yo) | Revisar para tu comunidad | agent_costs, agent_proposal |
| `materiales/compatibilidades.md` | ✅ (yo) | Tus reglas específicas | agent_materials, agent_design |
| `materiales/catalogos_proveedores.md` | pendiente | Tus 5-10 proveedores con contacto + precios | agent_materials, util_price_search |
| `materiales/bedec_huella_carbono.md` | pendiente | Yo lo puedo generar al instalar LightRAG | agent_energy_assessor (futuro) |
| `proyectos_reales/` | vacío | 1-2 proyectos tuyos anonimizados (briefing, decisiones, lessons) | agent_memory_v2 (futuro), referencia |
| `tu_forma_de_trabajar/checklist_visita_previa.md` | pendiente | **Imprescindible** — qué miras al entrar a un piso | agent_briefing, agent_pathology |
| `tu_forma_de_trabajar/preferencias_materiales.md` | pendiente | Tus "siempre / nunca" | agent_materials |
| `tu_forma_de_trabajar/criterios_seleccion_gremios.md` | pendiente | Cómo eliges gremios | agent_trades |
| `tu_forma_de_trabajar/faq_clientes.md` | pendiente | Preguntas típicas de cliente y tus respuestas | agent_client_concierge (futuro) |

## Lo mínimo que necesito de ti para seguir

Por orden de prioridad:

1. **`tu_forma_de_trabajar/checklist_visita_previa.md`** — sin esto los agentes no saben qué miras tú en una visita. Media página basta.
2. **`tu_forma_de_trabajar/preferencias_materiales.md`** — 10 reglas de "siempre / nunca". Ej.: "siempre granito en encimera, nunca carpintería PVC en exterior, gama Grohe en grifería".
3. **`materiales/catalogos_proveedores.md`** — tus 5-10 proveedores habituales con categoría, email/teléfono, condiciones.
4. **1 proyecto real en `proyectos_reales/`** — cualquier estructura sirve para que vea cómo escribes tú un briefing/memoria.

El resto se rellena a medida que vayamos expandiendo agentes.

## Cómo se consume este conocimiento

**Versión actual (MVP)** — los prompts de los agentes en `agent_prompts` (Supabase) incluyen enlaces o referencias textuales a estos archivos. En algunos casos el texto se inyecta directamente en `prompt_system`.

**Post-MVP** — integración con LightRAG (ver `ArquitAI.md` sección 2.3) para que cada agente recupere semánticamente las secciones relevantes en vez de cargar archivos enteros. Esto optimiza coste de tokens y permite que `knowledge/` crezca sin límite.

## Cómo ampliar `knowledge/`

Cuando quieras añadir contenido:

1. Pon el archivo en la carpeta correcta.
2. Abre una issue o dime "añadí `knowledge/X.md`, integrador con agente Y".
3. Yo actualizo el `prompt_system` del agente correspondiente para que use el nuevo contenido.

---

**Última actualización:** 2026-04-24 por Claude (Fase B del roadmap de ArquitAI).
