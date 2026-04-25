# DB-SUA Sección 9 — Accesibilidad — Checklist técnico

## Estado

- **Mantiene:** Claude
- **Fuente oficial:** CTE DB-SUA (Seguridad de utilización y accesibilidad) + Orden VIV/561/2010 (condiciones básicas accesibilidad urbana).
- **Última revisión:** 2026-04-24
- **Nota:** verificar valores contra el PDF oficial, estos son extractos orientativos.

## Cuándo aplica en reforma de vivienda

### Vivienda unifamiliar o piso de uso privado

DB-SUA 9 aplica con **matices**: los requisitos de itinerarios accesibles, ascensores, etc. están pensados para edificios con más de 12 viviendas o con local de uso público. En una vivienda unifamiliar o un piso individual **la mayoría de DB-SUA 9 NO es de aplicación obligatoria**.

**EXCEPTO cuando se trate de:**
- Reforma que cambie el uso a turístico o colaborativo (supone uso público).
- Vivienda adaptada por solicitud expresa del cliente (persona con movilidad reducida).
- Obra en edificio con acceso común a ≥ 12 viviendas (entonces las zonas comunes sí aplican, no la vivienda interior).

### Accesibilidad por "buenas prácticas" (siempre recomendable)

Aunque no sea obligatorio, aplicar criterios de accesibilidad en reforma de vivienda:
- **Aumenta valor de reventa** (el inmueble sirve a mayor demografía).
- **Previene adaptaciones futuras** cuando la familia envejece o tiene un problema de movilidad temporal.

Es un **argumento comercial** en la propuesta.

## Parámetros verificables (checklist)

### Puertas de paso

| Parámetro | Valor mínimo | Notas |
|---|---|---|
| Ancho libre de paso | **≥ 80 cm** (accesible: 80 cm) | Valor de la hoja, no del vano |
| Altura libre | ≥ 210 cm | |
| Espacio libre a ambos lados de la puerta | Círculo ∅ 120 cm | Para giro de silla |
| Resistencia a apertura (mecanismos) | ≤ 25 N | Que abra fácilmente |
| Altura de tirador | 80-120 cm | Alcance cómodo |

**En reforma** — si sustituyes puertas, el hueco de obra suele ya estar definido. Si la puerta existente es de 70 cm (común en pisos antiguos), **explicar al cliente el trade-off**: mantener hueco (más barato, menos accesible) vs. ampliar hueco (requiere cargadero nuevo si es muro portante).

### Pasillos y recorridos interiores

| Parámetro | Valor mínimo (accesible) |
|---|---|
| Ancho libre de pasillo | ≥ 100 cm (ideal 120 cm) |
| Altura libre | ≥ 220 cm |
| Espacio de maniobra en extremos y cruces | ∅ 120 cm |
| Pendiente transversal | ≤ 2% |
| Desniveles con pendiente | ≤ 10% si longitud < 3 m; ≤ 8% si 3-6 m; ≤ 6% si > 6 m |

### Baño accesible (si aplica)

| Parámetro | Valor |
|---|---|
| Espacio libre para maniobra | ∅ 150 cm |
| Altura inodoro (borde) | 42-45 cm |
| Altura lavabo (borde) | 82-85 cm |
| Grifo | Monomando o sensor, palanca ≥ 10 cm |
| Bañera | Borde ≤ 45 cm (si hay bañera) |
| Ducha | Sin plato / plato enrasado con pendiente 2% |
| Barras de apoyo | A 70-75 cm del suelo |
| Ancho puerta | ≥ 80 cm (apertura hacia afuera) |

**En reforma de baño pequeño (< 4 m²)**, el baño accesible completo es raramente factible. Lo que sí se puede hacer:
- Plato de ducha enrasado.
- Mampara retirable o puerta corredera.
- Barras de apoyo discretas.
- Grifería termostática tipo palanca.
- Pavimento antideslizante.

### Cocina

La cocina accesible estándar (altura regulable, espacio inferior libre) es poco común en reforma convencional. Pero sí es útil:

- Espacio de maniobra ∅ 150 cm frente a zona de trabajo.
- Encimera a 85 cm (estándar).
- Cajones extraíbles en lugar de puertas bajo encimera (los eleva frecuentemente).

### Mecanismos (interruptores, enchufes)

| Tipo | Altura recomendada |
|---|---|
| Interruptores | 80-120 cm |
| Enchufes | 40-120 cm |
| Timbres, telefonillo | 90-120 cm |
| Termostato, panel domótica | 100-140 cm |

### Resbaladicidad de solados (DB-SUA 1)

| Zona | Clase mínima |
|---|---|
| Zonas secas interiores (dormitorio, salón) | Clase 1 (Rd ≥ 15) |
| Zonas húmedas (baño, cocina) | **Clase 2** (15 < Rd ≤ 35) |
| Ducha, zona piscina | Clase 3 (Rd > 35) |
| Exterior cubierto (terraza, patio) | Clase 2 |
| Exterior descubierto | Clase 3 |

En reforma, al elegir pavimento para baño, **pedir siempre la ficha técnica con la Rd (resistencia al deslizamiento)** — los porcelánicos muy pulidos de efecto mármol pueden ser clase 1 y no cumplen.

## Chequeo automático recomendado (para agent_accessibility futuro)

Con el `briefing` y el `design_option` aprobados, un agente futuro podría validar:

```
Para cada room en design_option.rooms_layout:
  Si room.type == 'bath':
    Verificar puerta.ancho >= 80 cm → Flag si no
    Verificar pavimento.resbaladicidad == 'clase 2' → Flag si no
    Verificar si hay bañera → Sugerir plato ducha
  Si room.type == 'corridor':
    Verificar ancho >= 100 cm → Flag si es menos
  Para cada puerta:
    Verificar ancho libre paso >= 80 cm → Flag si no
```

Esto reduce errores de "diseñamos sobre plano, lo ejecutamos, nos damos cuenta en obra de que el baño no cumple".

## Argumentario comercial al cliente

Si el cliente descarta accesibilidad: "Entiendo, lo mantenemos. Pero quiero dejarlo anotado: si en 10 años la familia cambia o se alquila, será más caro adaptarlo entonces que hacerlo ahora con X € adicionales en [ducha enrasada / puerta + ancha / pavimento antideslizante]."

Esto genera valor percibido y cubre al arquitecto ante reclamaciones futuras.

## Referencias

- [CTE DB-SUA (PDF oficial)](https://www.codigotecnico.org/pdf/Documentos/SUA/DccSUA.pdf)
- Orden VIV/561/2010 de condiciones básicas de accesibilidad.
- Guías técnicas del Ministerio de Fomento (documento básico).
