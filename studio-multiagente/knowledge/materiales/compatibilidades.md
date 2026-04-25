# Compatibilidades de materiales — Reglas técnicas

## Estado

- **Mantiene:** Claude (base) + Damián (sus reglas específicas)
- **Última revisión:** 2026-04-24

## Uso de este archivo

Reglas de compatibilidad técnica entre materiales. `agent_materials` las consulta antes de proponer combinaciones. Evita errores clásicos que aparecen en obra o en post-venta.

## Reglas clave por categoría

### Pavimentos

| Compatibilidad | Regla | Por qué |
|---|---|---|
| Porcelánico + suelo radiante | ✅ Compatible | Conduce bien el calor |
| Parquet laminado AC4 + suelo radiante | ⚠️ Con restricción | Temperatura máx. de superficie 27°C |
| Parquet macizo + suelo radiante | ❌ Evitar | Dilata y agrieta |
| Microcemento + suelo radiante | ✅ Compatible | Excelente conductividad |
| Tarima flotante sobre solado existente | ⚠️ Solo si diferencia altura ≤ 15 mm en 2 m | Crujidos si base irregular |
| Porcelánico rectificado ≥ 60x60 cm + cola C2 S1 | ✅ | Cola flexible necesaria para piezas grandes |

### Baño — sanitarios, grifería, revestimientos

| Regla | Detalle |
|---|---|
| Encimera de baño continua (tipo mármol Silestone) | Necesita soporte estructural en anclaje — no directamente sobre pladur |
| Lavabo sobre encimera vs. encimera con seno integrado | El seno integrado evita acumulación de suciedad en juntas, más caro pero más duradero |
| Plato de ducha extraplano cerámico | Requiere buena pendiente del forjado o recrecido con pendiente; si no, acumula agua |
| Mampara con hoja fija + corredera | Mejor que batiente en baños < 4 m² |
| Grifería monomando empotrada | Siempre con válvula de corte externa accesible — avería sin ella obliga a cortar agua del piso |

### Cocina

| Regla | Detalle |
|---|---|
| Encimera silestone | No soporta calor extremo directo (ollas recién sacadas) — preferir cuarzo compacto si es el uso |
| Encimera dekton | Soporta calor y rayaduras, más caro pero top gama |
| Campana extractora sin salida al exterior | Evitar en cocina cerrada — reciclar no es suficiente para humedad |
| Fregadero bajo encimera vs sobre encimera | Bajo encimera: limpieza fácil, pero requiere encimera resistente al agua (cuarzo o dekton, no granito poroso) |

### Carpintería exterior

| Combinación | Valoración |
|---|---|
| Aluminio RPT + vidrio 4+16+4 low-e | ✅ Estándar actual CTE HE zona D (Madrid) |
| PVC 5 cámaras + vidrio 4+16+4 low-e | ✅ Mejor aislante térmico, peor estético según cliente |
| Madera + vidrio doble | ✅ Alto valor estético, mantenimiento alto |
| Aluminio sin RPT | ❌ Incumple CTE HE en zona D o superior |
| Vidrio monolítico | ❌ Incumple CTE HE en casi toda España |

**En reforma de piso antiguo**: sustituir carpintería exterior por aluminio RPT + vidrio 4+16+4 es estándar. Avisar al cliente del coste/m² (referencia en `price_references`).

### Pintura

| Regla | Detalle |
|---|---|
| Pintura plástica en baño/cocina | Usar versión antihumedad y antimoho — la estándar se descama |
| Imprimación nueva sobre pintura vieja | Necesaria si la capa anterior no se puede quitar; evita pelar |
| Pintura sobre pladur nuevo | Imprimación obligatoria — el pladur absorbe desigualmente |
| Epoxi en paredes | Difícil aplicación, muy duradero, reservado a zonas especiales (garajes, duchas sin baldosa) |

### Instalaciones

| Regla | Detalle |
|---|---|
| Multicapa PEX para fontanería | ✅ Estándar actual; evitar cobre nuevo (caro, no aporta ventajas) |
| Acero galvanizado en fontanería | ❌ Obsoleto en vivienda, corrosión |
| Plomo en fontanería | ❌ Prohibido (sanidad) — si aparece en demolición de piso antiguo, sustituir obligatoriamente |
| PVC para saneamiento interior | ✅ Estándar, pendiente 2% mínima |
| Cableado en tubo corrugado | ✅ Obligatorio REBT |

### Aislamientos

| Tipo | Uso | Notas |
|---|---|---|
| Lana mineral (roca o vidrio) | Trasdosados, cubiertas inclinadas | Absorbe acústico y térmico, requiere cámara ventilada si humedad |
| Poliestireno extruido XPS | Suelos, cubiertas, fachada ventilada | No absorbe agua, rígido |
| Poliuretano proyectado | Cubiertas planas, puentes térmicos | Gran aislamiento, pero cuidado con el fuego (reacción B-s1,d0 obligatoria) |
| Corcho | Alto valor ecológico, caro | Sustituto natural de lana mineral |
| Lana mineral + barrera de vapor | Cubierta inclinada con espacio habitable | La barrera evita condensaciones |

### Electricidad

| Regla | Detalle |
|---|---|
| Cuadro con IGA + diferenciales por circuito | ✅ REBT vivienda grado 1: 5 circuitos mínimo |
| Mecanismos de gama económica vs media vs alta | Diferencia estética y durabilidad. Blanco estándar gama media 2-3 € la unidad, premium 8-15 € |
| Iluminación empotrada dicroica halógena | ❌ Obsoleto, reemplazar por LED GU10 |
| Iluminación LED downlight 6W vs 9W | 6W para pasillo, 9W para cocina/baño (iluminancia ≥ 300 lux en cocina) |

### Climatización

| Combinación | Notas |
|---|---|
| Suelo radiante eléctrico | Fácil instalación, consumo alto |
| Suelo radiante hidrónico (tubería con agua) | Mejor eficiencia, más inversión inicial |
| Split 1×1 vs aire por conductos | Split para habitación puntual; conductos para vivienda completa con falsos techos |
| Caldera gas natural condensación | Estándar actual, eficiencia > 90% |
| Aerotermia | Mejor opción CTE HE4 (renovable), mayor coste inicial, recomendada en obra nueva |

## Reglas específicas del arquitecto técnico

Damián: rellena aquí tus reglas personales. Ejemplo:

```
## Mis reglas (Damián)

- Siempre granito negro Zimbabwe en encimera de cocina (resistencia, no se raya).
- Nunca carpintería de PVC en exterior: prefiero aluminio RPT por estética.
- Siempre grifería de palanca monomando (Grohe Concetto o similar), más ergonómica.
- Nunca pintura satinada en dormitorios, siempre mate o sedosa.
- En baños pequeños, siempre mampara corredera, nunca batiente.
```

(Sustituir por tus reglas reales cuando tengas tiempo.)

## Cómo se usa

- `agent_materials` consulta este archivo al proponer materiales — evita incompatibilidades.
- `agent_design` al proponer opciones, ya considera estas reglas para no sugerir combinaciones imposibles.
- Los prompts de los agentes reciben las reglas relevantes según la categoría del material.
