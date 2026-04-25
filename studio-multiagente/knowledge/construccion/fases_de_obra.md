# Fases de obra — Secuencia técnica estándar en reforma de vivienda

## Estado

- **Mantiene:** Claude (secuencia estándar) + Damián (plazos reales y variaciones)
- **Última revisión:** 2026-04-24

## Principio

En reforma de vivienda las fases siguen una secuencia técnica que **respeta las dependencias entre gremios**. Saltarse el orden genera retrabajos costosos (ej. pintar antes de instalar puertas → marcas en la pintura).

## Secuencia estándar (reforma integral de piso)

### Fase 0 — Preparación y permisos (semanas 0-2)

- Obtención de licencia o Declaración Responsable.
- Contratación de constructor y definición de gremios.
- Acopio de materiales con plazo de entrega largo (carpintería a medida, sanitarios de importación).
- Comunicación a vecinos y a administrador de la finca.

**Gremios activos:** ninguno (planificación).

**Agentes de ArquitAI involucrados:** `agent_proposal`, `agent_permit_tracker` (futuro), `agent_trade_comms` (futuro).

### Fase 1 — Demolición y desescombro (semana 1-2 de ejecución)

- Retirada de sanitarios, electrodomésticos, mobiliario fijo.
- Picado de azulejos y solados.
- Demolición de tabiques interiores NO portantes.
- Cegado de instalaciones antiguas.
- Retirada de escombros a vertedero autorizado (con contenedor visible en obra).

**Gremios:** albañilería, peonaje.

**Partidas CYPE típicas en `price_references`:**
- Demolición de tabique de ladrillo hueco (m²)
- Desmontaje de alicatado existente (m²)
- Demolición de solado cerámico (m²)
- Retirada de sanitarios (ud)
- Retirada de escombros con contenedor (m³)

**Verificaciones clave:**
- Mantener ventilaciones existentes (patinillos).
- No tocar muros portantes sin proyecto estructural visado.
- Comprobar plomadas de forjado tras retirar solado (a veces aparecen desniveles ocultos).

### Fase 2 — Obra civil estructural y redistribución (semanas 2-4)

- Demolición de muros portantes (si aplica, con proyecto estructural y apeo).
- Apertura de huecos (puertas, pasamuros).
- Levantamiento de tabiquería nueva (ladrillo o pladur).
- Refuerzos estructurales, cargaderos, dinteles.

**Gremios:** albañilería, estructura.

**Atenciones:**
- Los pasamuros para instalaciones se dejan YA previstos (no esperar a fase 3).
- El pladur se puede levantar antes o después de instalaciones ocultas según la preferencia del constructor — preguntar.

### Fase 3 — Instalaciones ocultas (semanas 3-5)

Ejecución de las tres instalaciones principales, con **coordinación estricta** porque comparten tabique:

#### 3a. Fontanería y saneamiento

- Trazado de tuberías de agua fría/caliente (multicapa PEX).
- Montaje de desagües con pendiente mínima 2%.
- Instalación de válvulas de corte por estancia.
- Pruebas de presión ANTES de tapar.

#### 3b. Electricidad

- Trazado de canalizaciones corrugadas.
- Colocación de cajas de mecanismos y registros.
- Cableado (no conexión de mecanismos aún — fase 6).
- Nuevo cuadro con IGA + ICP + diferenciales (REBT).

#### 3c. Climatización

- Canalización de suelo radiante (si aplica — requiere recrecido posterior).
- Canalizaciones de aire acondicionado por conductos.
- Previsiones para máquinas exteriores (tendedero, patinillo).

**Gremios:** fontanero, electricista, climatización.

**Atenciones:**
- Jamás meter tubos de cobre y eléctrico en el mismo recorrido sin separación.
- El suelo radiante obliga a recrecido posterior (+5 cm de altura perdida) — avisar al cliente.
- Pruebas de presión de fontanería documentadas ANTES de alicatar.

**Partidas CYPE típicas:**
- Instalación eléctrica completa REBT vivienda (m²)
- Instalación fontanería baño completo (ud)
- Instalación fontanería cocina (ud)

### Fase 4 — Tabiquería interior y revestimientos base (semanas 5-7)

- Tabiques definitivos de pladur si no se hicieron antes.
- Trasdosados con aislamiento térmico y/o acústico.
- Enfoscados y guarnecidos.
- Falsos techos (continuos o registrables).

**Gremios:** albañilería, pladurista.

**Verificaciones:**
- Aislamiento térmico mínimo según CTE HE para paredes con medianera o fachada.
- Aislamiento acústico mínimo DB-HR entre unidades de uso diferentes.

### Fase 5 — Solados y alicatados (semanas 6-8)

- Recrecido de suelos (con aislamiento acústico si aplica).
- Colocación de alicatados en zonas húmedas (baños, cocina).
- Colocación de pavimentos: cerámico, porcelánico, microcemento, parquet, tarima.
- Rodapiés.

**Gremios:** solador, alicatador.

**Atenciones:**
- Respetar tiempos de fraguado del recrecido antes de solar (≥ 48h autonivelante, 7-14 días mortero).
- Vigilar resbaladicidad CTE DB-SUA 1 en baño (clase 2 mínimo).
- El rodapié va antes de la carpintería fina.

### Fase 6 — Carpintería y acabados (semanas 7-9)

- Carpintería exterior nueva (ventanas, puerta de entrada).
- Carpintería interior (puertas de paso, armarios empotrados).
- Mobiliario de cocina y baño.
- Grifería y sanitarios.
- Mecanismos eléctricos y enchufes.

**Gremios:** carpintero, electricista (retorno), fontanero (retorno), cocina a medida.

**Atenciones:**
- La carpintería exterior idealmente se coloca ANTES de pintar (evita golpes de albañilería).
- Sanitarios y grifería con protección hasta entrega (plásticos).

### Fase 7 — Pintura (semanas 8-9)

- Imprimación.
- Pintura plástica en techos.
- Pintura plástica en paredes (dos manos mínimo).
- Retoques y limpieza.

**Gremios:** pintor.

**Atenciones:**
- La pintura es la ÚLTIMA fase de acabados, excepto la limpieza final.
- Siempre dos manos.

### Fase 8 — Limpieza final y entrega (semana 9)

- Retirada de protecciones.
- Limpieza final de obra (incluye cristales).
- Prueba de funcionamiento de todas las instalaciones.
- Entrega con actas.

## Plazos típicos — reforma integral piso 70-90 m²

| Fase | Duración típica |
|---|---|
| 0 — Preparación | 2-4 semanas antes de empezar |
| 1 — Demolición | 1 semana |
| 2 — Obra civil | 2 semanas |
| 3 — Instalaciones | 2-3 semanas (paralelo a 2 en parte) |
| 4 — Tabiquería | 1-2 semanas |
| 5 — Solados/alicatados | 2 semanas |
| 6 — Carpintería/acabados | 2 semanas |
| 7 — Pintura | 1 semana |
| 8 — Limpieza | 2-3 días |
| **Total con solapes** | **8-10 semanas** en 70-90 m² |

Plazos referenciales — los reales varían según tamaño, complejidad, gremios disponibles, ritmo del cliente.

**Damián, si tienes datos reales de tus proyectos, sustituye estas cifras en una sección "### Mis plazos reales" al final.**

## Hitos de control (milestones) para `agent_planner`

1. **Inicio de obra** — semana 0 de ejecución.
2. **Fin de demolición** — semana 1, verificar peso estructural real tras retirar solados.
3. **Fin de obra civil e instalaciones ocultas** — semana 5, todo tapado: punto de no retorno.
4. **Fin de solados y alicatados** — semana 8.
5. **Fin de carpintería y acabados** — semana 9.
6. **Entrega con recepción** — semana 9-10.

Estos hitos son los que `agent_planner` debe incluir por defecto en `project_plans.milestones`.

## Critical path típico

En reforma integral: **Obra civil (2) → Instalaciones ocultas (3) → Tabiquería (4) → Solados (5)**.

Cualquier retraso en esta cadena retrasa la entrega. Carpintería y pintura tienen más holgura.

## Riesgos y retrasos frecuentes

- **Plazos de entrega de carpintería exterior** (RPT con vidrio bajoemisivo) — 4-6 semanas. Pedir en fase 0.
- **Cocinas a medida** — 6-8 semanas. Pedir en fase 0.
- **Sanitarios/grifería especiales** — pueden llegar a 12 semanas para importados.
- **Incidencias estructurales no previstas** — siempre dejar 10-15% de holgura en el plazo.
- **Disponibilidad de gremios** — el electricista bueno está siempre ocupado, reservar con antelación.
- **Requerimientos del ayuntamiento** — Declaración Responsable a menudo tiene inspección tardía.

## Cómo se usa este archivo

- `agent_planner` lo lee como base para estructurar `project_plans.phases` con las dependencias correctas.
- `agent_briefing` y `agent_design` pueden citar plazos aproximados en la propuesta al cliente.
- `agent_trade_comms` (futuro) lo usa para coordinar envíos a gremios por fase.
