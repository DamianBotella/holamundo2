# Instalación eléctrica — REBT

## Estado

- **Mantiene:** Claude
- **Fuente:** Reglamento Electrotécnico de Baja Tensión (RD 842/2002 + modificaciones), ITC-BT-01 a ITC-BT-52.
- **Última revisión:** 2026-04-24

## Cuándo aplica REBT en reforma

- Cuando la reforma incluye **cualquier modificación de la instalación eléctrica**: cambio de cuadro, ampliación de circuitos, nueva canalización, sustitución de cableado antiguo.
- En piso antiguo, la instalación existente habitualmente **no cumple REBT vigente** y hay que actualizarla completamente.

## Grado de electrificación de la vivienda (ITC-BT-25)

| Grado | Potencia prevista | Circuitos mínimos |
|---|---|---|
| Básico | 5.750 W (25 A) | 5 |
| Elevado | 9.200 W (40 A) | 9 |

**Recomendación** para reforma integral: **grado elevado** siempre. Incluye:
- Circuito 1 (C1): iluminación
- Circuito 2 (C2): tomas generales y frigorífico
- Circuito 3 (C3): cocina y horno
- Circuito 4 (C4): lavadora, lavavajillas, termo
- Circuito 5 (C5): baños y auxiliares de cocina
- Circuito 6: circuito adicional de iluminación (si superficie > 160 m² o ≥ 2 plantas)
- Circuito 7 (C7): tomas adicionales
- Circuito 8: circuito de climatización por aire acondicionado
- Circuito 9: circuito para suelo radiante o calefactores
- Más: tomas para vehículo eléctrico en garajes comunes (si aplica ITC-BT-52).

## Secciones de cableado (ITC-BT-25 Tabla 1)

| Circuito | Sección mínima cobre | Intensidad de protección |
|---|---|---|
| C1 iluminación | 1.5 mm² | 10 A |
| C2 tomas generales | 2.5 mm² | 16 A |
| C3 cocina/horno | 6 mm² | 25 A |
| C4 lavadora/termo | 4 mm² | 20 A |
| C5 baños/aux cocina | 2.5 mm² | 16 A |

## Cuadro general de mando y protección (CGMP)

Elementos obligatorios:
- **IGA** — Interruptor General Automático (protección general contra sobrecargas).
- **ICP** — Interruptor de Control de Potencia (contratado con la compañía).
- **Diferencial** — protección contra contactos directos e indirectos. Sensibilidad 30 mA en vivienda, 10 mA en baño si se quiere máxima protección.
- **Magnetotérmicos** — uno por circuito, protección contra sobrecargas y cortocircuitos.
- **Interruptor Automático Diferencial selectivo** si dos diferenciales en cascada.

**En reforma** — obligatorio sustituir cuadro completo si el existente es de pastillas de porcelana, de fusibles de cartucho, o sin diferencial. Cuadros modernos (DIN rail, pulsantes) pueden mantenerse si el resto cumple.

## Puesta a tierra (ITC-BT-18, ITC-BT-26)

- Valor máximo de resistencia de tierra: **< 50 Ω** (vivienda).
- Toma de tierra obligatoria en todos los enchufes y mecanismos.
- **En reforma de piso antiguo**: si no hay toma de tierra en la instalación existente, **obligatorio ejecutarla**. Se conecta al conductor de tierra principal del edificio (a través del cuadro de vivienda).
- Si el edificio no tiene tierra comunitaria (raro en edificios previos a 1980), la solución es compleja (tierra individual por zanja en planta baja) y requiere coordinación con administrador de finca.

## Volúmenes de protección en baño (ITC-BT-27)

| Volumen | Ubicación | Grado IP requerido | Qué se puede instalar |
|---|---|---|---|
| 0 | Dentro de la bañera/ducha | IPX7 | Nada salvo grifería adecuada |
| 1 | Hasta 2.25 m sobre bañera/ducha | IPX5 (exterior) / IPX4 | Iluminación empotrada fija MBTS |
| 2 | 0.60 m alrededor volumen 1 | IPX4 | Iluminación, calentador |
| Fuera | Resto | Estándar IP20 | Todo tipo |

**Práctico**: mecanismos (interruptor, enchufe) NO pueden estar dentro del volumen 1 o 2. Siempre a ≥ 60 cm del borde de bañera/ducha o fuera del baño.

## Domótica y previsiones

Si el proyecto tiene domótica (ver `domotica_KNX_Matter.md`), la instalación eléctrica debe prever:
- Canalización dedicada para bus KNX (si KNX).
- Alimentación auxiliar 24V.
- Cajas de mecanismos con profundidad mínima 50 mm (los mecanismos domóticos son más profundos).
- Cuadro con espacio para controladores.

## Iluminación típica en reforma

| Estancia | Iluminación recomendada |
|---|---|
| Salón | Luz central regulable + puntos auxiliares en mesas |
| Comedor | Luz zenital sobre mesa (suspendida) + ambiente |
| Dormitorio | Luz central + lámparas de mesa ambos lados cama |
| Cocina | Luz zenital + tira LED bajo muebles altos + luz focal sobre encimera |
| Baño | Luz zenital + iluminación frontal de espejo (CRI ≥ 80) |
| Pasillo | Puntos LED empotrados cada 1.5-2 m |

Nivel de iluminancia orientativo (luxes):
- Salón: 200-300 lux
- Cocina/baño: 300-500 lux
- Dormitorio: 150-200 lux
- Pasillo: 100-150 lux

## Coste típico en reforma integral (referencia)

Ver `price_references` tabla en Supabase para precios actualizados. Orientativo:

- Instalación eléctrica completa REBT grado elevado, vivienda 70-90 m²: **40-55 €/m²** (materiales + mano de obra).
- Cuadro eléctrico completo con diferenciales: **400-600 €**.
- Punto de luz (cableado + mecanismo): **45-65 € ud**.
- Toma corriente: **40-60 € ud**.

## Errores clásicos a evitar

- **Mecanismos en baño dentro del volumen 1/2** (peligro real de electrocución).
- **Circuito único para cocina + baño** (sobrecargas y diferencial que salta con horno y lavadora simultáneamente).
- **Cableado sin tubo corrugado empotrado** (no cumple REBT).
- **Sin etiquetado en cuadro** (problema para mantenimiento futuro).
- **Tomas bajo altura de 15 cm** en zonas húmedas (riesgo inundación).

## Certificación y legalización

Tras reforma:
- **Boletín eléctrico** emitido por el instalador autorizado (categoría IBTE).
- **Certificado de instalación eléctrica** — obligatorio si se cambia cuadro general.
- Presentación en industria de la CCAA (Madrid: Dirección General de Industria).

Ambos se adjuntan al expediente de obra.

## Cómo usa ArquitAI esta información

- `agent_costs` consulta precios de partidas eléctricas de `price_references`.
- `agent_design` verifica que la distribución cumple con volúmenes de protección en baño.
- `agent_materials` (futuro) propone mecanismos compatibles con REBT.
- `agent_regulatory` incluye en trámites la presentación del boletín.
