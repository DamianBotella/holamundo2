# CTE — Índice navegable de los 6 Documentos Básicos

## Estado

- **Mantiene:** Claude (base) + Damián (reglas específicas que use)
- **Última revisión:** 2026-04-24
- **Fuente oficial:** https://www.codigotecnico.org — texto actualizado del Ministerio
- **Nota crítica:** las cifras citadas son de la versión oficial. Siempre que se use en una decisión real, verificar en el PDF oficial por si ha habido una modificación por RD.

## Qué es el CTE

Código Técnico de la Edificación (RD 314/2006 con modificaciones posteriores). Marco normativo español para la edificación. Estructurado en 6 Documentos Básicos (DB) + Parte 1 general.

Cuando se aplica (art. 2 LOE + art. 2 CTE):
- **Obligatorio**: obra nueva, ampliación, modificación o reforma que afecte a elementos cubiertos por los DB.
- **Reformas parciales**: aplica solo a los elementos intervenidos, no al edificio completo, pero con **mejoras razonables** obligatorias cuando el cumplimiento íntegro es técnicamente inviable.

## Los 6 Documentos Básicos

### DB-SE — Seguridad Estructural

**Ámbito:** estabilidad y resistencia estructural.

**Documentos que lo desarrollan:**
- DB-SE (general)
- DB-SE-AE (Acciones en la Edificación)
- DB-SE-C (Cimientos)
- DB-SE-A (Acero)
- DB-SE-F (Fábrica)
- DB-SE-M (Madera)
- NCSE-02 (sismo) — separada

**Cuándo aplica en reforma:** si se interviene estructura (modificar, demoler o añadir elementos estructurales). Si la reforma NO toca estructura, no aplica.

**Pregunta clave al arquitecto para cada proyecto:**
- ¿La intervención modifica muros portantes, forjados, vigas, pilares, cimentación?
- Si sí → requiere proyecto visado con cálculo estructural.

### DB-SI — Seguridad en caso de Incendio

**Ámbito:** evacuación, compartimentación, resistencia al fuego, instalaciones de protección.

**Secciones:**
- SI 1: Propagación interior (compartimentación en sectores, REI, EI)
- SI 2: Propagación exterior (distancia de medianeras)
- SI 3: Evacuación (recorridos, puertas, señalización)
- SI 4: Instalaciones de protección contra incendios (extintores, BIE, alumbrado emergencia)
- SI 5: Intervención bomberos (accesos)
- SI 6: Resistencia al fuego de la estructura

**Cifras clave (valor típico vivienda unifamiliar / residencial vivienda):**
- Resistencia al fuego estructura portante: **R 60** en vivienda unifamiliar, **R 90-120** en residencial vivienda en altura.
- Compartimentación vivienda: **EI 60** separando con zona común.
- Puerta entrada vivienda: **EI2 30-C5**.
- Recorrido de evacuación máximo en vivienda: **25 m** hasta zona segura.

**En reforma de vivienda existente:**
- Puerta blindada de entrada: mantener o mejorar EI2 30-C5.
- Si se modifica la distribución, revisar recorrido de evacuación.
- La sectorización no suele aplicar en reforma interior de vivienda completa.

### DB-SUA — Seguridad de Utilización y Accesibilidad

**Ámbito:** riesgos de caída, impacto, atrapamiento, iluminación, vehículos, rayo, y **accesibilidad**.

**Secciones críticas en reforma de vivienda:**
- SUA 1: Resbaladicidad y caídas
- SUA 2: Impacto (vidrios) y atrapamiento
- SUA 4: Iluminación adecuada
- SUA 9: **Accesibilidad** (detalle en `accesibilidad/DB-SUA_checklist.md`)

**Cifras típicas:**
- Clase de resbaladicidad en baño (interior húmedo): mínimo clase 2 (15 < Rd ≤ 35).
- Altura barandillas: 90 cm hasta 6 m altura caída, 110 cm por encima.
- Distancia máxima entre barrotes: 10 cm.
- Vidrio en bañera/ducha: vidrio de seguridad templado o laminar.

**En reforma de baño (típica en tu ámbito):**
- Solado del baño debe ser clase 2 o superior.
- Si hay desnivel > 55 cm en terraza o similar, barandilla obligatoria.

### DB-HE — Ahorro de Energía

**Ámbito:** eficiencia energética.

**Secciones:**
- HE 0: Limitación del consumo energético (nueva edificación y rehabilitación relevante)
- HE 1: Condiciones para el control de la demanda energética (envolvente térmica)
- HE 2: Condiciones para las instalaciones térmicas
- HE 3: Condiciones de las instalaciones de iluminación
- HE 4: Contribución mínima de energía renovable para ACS (hoy: fotovoltaica o aerotermia en obra nueva)
- HE 5: Generación mínima de electricidad renovable

**En reforma:**
- Aplica **mejora de la envolvente** cuando se sustituya >25% de superficie de fachada o cubierta.
- Aplicar HE 1 proporcionalmente al alcance de la reforma.
- Si se cambia carpintería exterior (típico en reforma integral), la nueva debe cumplir el valor límite de transmitancia U de la zona climática correspondiente.

**Valores típicos de transmitancia (zona climática D — Madrid):**
- U huecos (ventanas, puertas exteriores): ≤ 1.8 W/m²K
- U opacos (fachada): ≤ 0.27 W/m²K
- Estos valores están en `knowledge/instalaciones/climatizacion_RITE.md`.

### DB-HR — Protección frente al Ruido

**Ámbito:** aislamiento acústico.

**Cifras clave:**
- Aislamiento a ruido aéreo entre unidades de uso: DnT,A ≥ 50 dB
- Aislamiento a ruido aéreo con zona común (pasillo, escalera): DnT,A ≥ 50 dB
- Aislamiento a ruido de impactos entre unidades superpuestas: L'nT,w ≤ 65 dB

**En reforma:**
- Si se modifican particiones que separan unidades de uso diferentes, aplicar.
- Demoler un tabique interior y rehacerlo generalmente NO activa DB-HR (misma unidad de uso).
- Nueva partición medianera con local comercial inferior o vecino sí activa.

### DB-HS — Salubridad

**Ámbito:** agua, residuos, aire.

**Secciones:**
- HS 1: Protección frente a la humedad
- HS 2: Recogida y evacuación de residuos
- HS 3: Calidad del aire interior (ventilación)
- HS 4: Suministro de agua
- HS 5: Evacuación de aguas

**En reforma de vivienda:**
- HS 3 (ventilación): crítico si se modifica tabiquería o se cambia uso de estancias. Cocinas necesitan extractor + renovación de aire. Baños sin ventana necesitan extractor mecánico al exterior.
- HS 4 (fontanería): si se desplaza baño/cocina, revisar trazado y presiones.
- HS 5 (saneamiento): pendientes mínimas (desagües ≥ 2%, colectores ≥ 1%).

## Tablas de referencia rápida

### Reforma integral de vivienda — qué DB aplicar siempre

| Intervención típica | DB que aplica |
|---|---|
| Apertura de muro no portante (cocina-salón) | DB-HS 3 (ventilación), DB-HR si separa unidades |
| Apertura de muro portante | DB-SE completo, DB-SI 6 |
| Cambio de carpintería exterior | DB-HE 1 |
| Sustitución de bañera por ducha | DB-SUA 1, DB-HS 4 |
| Nueva distribución interior | DB-HS 3, DB-HR (si afecta medianeras) |
| Suelo radiante | DB-HE 2, DB-SI (aislamiento eléctrico si es eléctrico) |
| Actualización instalación eléctrica | REBT (no CTE), DB-SI 1 (canalizaciones) |

## Fuentes siempre actualizadas

- [codigotecnico.org](https://www.codigotecnico.org) — oficial, siempre la última versión.
- [BOE](https://www.boe.es) — buscar por "Real Decreto" + año para modificaciones.
- Colegios profesionales (COAM, CSCAE, CGAT) publican notas técnicas cuando hay modificaciones relevantes.

## Lo que este archivo NO cubre (aún)

- Artículos literales del CTE (están en los PDFs de `knowledge/normativa/cte/`).
- Normativa autonómica específica (pendiente en `knowledge/normativa/autonomica/`).
- Jurisprudencia.

Cuando un agente necesite un artículo concreto, debe referir al PDF oficial. Este archivo es un **mapa** para navegar el CTE, no una sustitución del mismo.
