# Climatización — RITE, CTE DB-HE, DB-HS3

## Estado

- **Mantiene:** Claude
- **Fuentes:** RITE (RD 1027/2007 + modificaciones), CTE DB-HE 2 (instalaciones térmicas), CTE DB-HS 3 (ventilación).
- **Última revisión:** 2026-04-24

## RITE — Reglamento de Instalaciones Térmicas en Edificios

Aplica a:
- Instalaciones térmicas de > 5 kW en vivienda.
- Instalaciones de climatización (calor + frío) de cualquier potencia.
- Instalaciones de ACS de > 70 L/h.

**En reforma**: si se sustituye caldera o se instala aire acondicionado, RITE aplica. El técnico de la empresa instaladora emite certificado de instalación térmica.

## Calefacción

### Opciones en reforma

| Sistema | Uso | Inversión inicial | Consumo |
|---|---|---|---|
| Radiadores hidráulicos (agua caliente, caldera gas) | Estándar antiguo, habitable | Medio | Medio-alto |
| Suelo radiante eléctrico | Viviendas pequeñas, cuartos de baño | Bajo | Alto |
| Suelo radiante hidráulico (agua caliente de caldera o bomba) | Casi óptimo en confort | Alto | Bajo-medio |
| Radiador eléctrico emisor térmico | Sin obra, rápida sustitución | Bajo | Alto |
| Bomba de calor aerotérmica (aire-agua) | Alta eficiencia, uso combinado clima + ACS | Muy alto | Bajo |
| Split aire acondicionado (frío-calor) | Puntual, eficiente | Medio | Bajo-medio |

### En reforma típica piso 70-90 m²

Dos escenarios habituales:

**Escenario A — conservar caldera + radiadores**:
- Cambiar caldera (sustituir por condensación si es atmosférica): 1.800-3.200 €.
- Sustituir radiadores si antiguos (hierro fundido → aluminio moderno): 100-180 € ud.
- Total ~2.500-4.500 €.

**Escenario B — cambio a suelo radiante**:
- Retirar radiadores.
- Ejecutar recrecido con tubería suelo radiante.
- Mantener la caldera (compatible) o cambiar a bomba de calor (más eficiente).
- Total ~35-55 €/m² (incluye materiales + ejecución).

**Trade-off**: el suelo radiante es más confortable y eficiente, pero pierde ~5 cm de altura y requiere recrecer.

### Temperaturas de consigna (RITE)

Según IT 3.8.2 — límites para uso eficiente:
- **Invierno**: temperatura ambiente ≤ 21°C (verano).
- **Verano**: temperatura ambiente ≥ 26°C.

Son límites legales para edificios públicos; en vivienda son recomendación.

## Aire acondicionado

### Tipos

| Tipo | Cuándo elegir |
|---|---|
| Split 1×1 | Una habitación puntual, climatizar solo salón |
| Multi-split 1x2 o 1x3 | Varias habitaciones, una máquina exterior |
| Conductos | Climatización central para toda la vivienda — requiere falsos techos |
| Cassette de techo | Cuando se quiere estética mejor que split pared |

### Potencia frigorífica estimada

Regla rápida: **~100 W/m²** en zona D (Madrid). Para vivienda 70 m², ~7 kW (o 6000 frigorías) divididos por estancias.

- Salón 30 m² → 3 kW (split 1 unidad de 3.5 kW)
- Dormitorio 12 m² → 1.2 kW
- Dormitorio 10 m² → 1 kW
- Total compartido en multi-split 1x3: máquina exterior 7-8 kW.

### Gas refrigerante

- R-32 es el estándar actual (menor GWP que R-410A).
- R-410A todavía se comercializa en equipos existentes.
- **Prohibidos en nueva instalación**: R-22, R-404A (muy contaminantes).

## Ventilación (CTE DB-HS 3)

### Obligación

Toda vivienda debe tener ventilación continua controlada que garantice calidad del aire interior.

### Caudales mínimos

| Estancia | Caudal mínimo |
|---|---|
| Dormitorio individual | 5 L/s |
| Dormitorio doble | 8 L/s |
| Sala de estar / comedor | 3 L/s por ocupante (mín 12 L/s) |
| Cocina | 2 L/s por m², mín 8 L/s (extracción) |
| Baño / aseo | 15 L/s (extracción) |

### Sistemas

**Sistema general**: admisión de aire en salón y dormitorios + extracción en cocina y baños + paso de aire entre estancias (por holgura de puerta o rejilla).

**En reforma de piso antiguo**:
- Verificar que sigue habiendo extracción mecánica (shunts) en cocina y baños.
- Si no hay, ejecutar: extractor eléctrico en baño con conducto al patio o patinillo.
- Cocina: campana extractora con salida al exterior (preferible) o recirculación con filtros (aceptable en viviendas sin shunt).
- Sin salida externa en cocina: verificar DB-HS 3 — la reforma puede exigir ventilación adicional.

## Aislamiento de tuberías

En instalaciones térmicas (calefacción, ACS, climatización):
- **Obligatorio aislamiento** de tuberías de agua caliente en zonas no calefactadas (garajes, patinillos, huecos comunes).
- Grosor del aislante según diámetro tubería y temperatura (tabla RITE IT 1.2.4.2):
  - Tubería ≤ DN25 agua caliente: aislamiento 20 mm
  - DN32-DN50: 25 mm
  - DN ≥ 65: 30 mm

En reforma **siempre** aislar tuberías nuevas de calefacción y ACS — las pérdidas pueden llegar al 30% sin aislar.

## Eficiencia energética (CTE DB-HE)

### Envolvente térmica (DB-HE 1)

Valores límite de transmitancia U (Madrid, zona D3):

| Elemento | U máxima (W/m²K) |
|---|---|
| Muros exteriores | 0.60 |
| Cubierta | 0.40 |
| Suelo | 0.65 |
| Huecos (vidrio + marco, conjunto) | 1.80 |

En reforma:
- Si se sustituye ≥ 25% de envolvente → aplicar valores límite a lo renovado.
- Carpintería exterior nueva: obligatorio cumplir U ≤ 1.80 W/m²K → aluminio RPT + vidrio 4+16+4 low-e + marco eficiente.

### Instalación térmica (DB-HE 2)

Rendimiento mínimo de generadores:
- Calderas de gas de condensación: ≥ 92% (valor de emisión térmica útil).
- Bombas de calor aire-agua: COP mínimo en función de zona climática y modo (calor/frío).

## Mantenimiento

Obligaciones del usuario (RITE IT 3.3):
- Revisión anual por empresa mantenedora autorizada para instalaciones > 70 kW.
- Revisión cada 4 años para calderas gas < 70 kW (IT 4.2.3).
- Limpieza anual de filtros del aire acondicionado.

En reforma: entregar al cliente el **manual de uso y mantenimiento** del sistema instalado (aire acondicionado, caldera) como parte de la documentación final.

## Cómo usa ArquitAI

- `agent_costs` consulta partidas de climatización de `price_references`.
- `agent_energy_assessor` (futuro) calcula demanda y huella con estos valores.
- `agent_design` verifica que la propuesta de climatización encaja en la distribución (falsos techos para conductos, salidas al exterior).
- `agent_materials` propone equipos compatibles con el dimensionado.

## Espacio para notas específicas de Damián

```
## Mis preferencias (Damián)

- Marca de caldera preferida: ...
- Integrador de clima de confianza: ...
- Sistemas a evitar: ...
```
