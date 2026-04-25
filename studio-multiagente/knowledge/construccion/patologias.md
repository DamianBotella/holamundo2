# Patologías típicas en reforma de vivienda

## Estado

- **Mantiene:** Claude (clasificación tipo) + Damián (casos reales que haya visto)
- **Última revisión:** 2026-04-24

## Uso

Sirve de referencia para `agent_pathology` (visión por IA sobre fotos) y para la visita previa del arquitecto. Clasifica patologías por severidad y sugiere la intervención habitual.

## Clasificación por familia

### 1. Humedades

Causa más frecuente de reclamaciones y la más subestimada al principio.

| Tipo | Síntomas | Causa | Intervención |
|---|---|---|---|
| **Humedad por capilaridad** | Manchas a ras de suelo (hasta 1-1.5 m de altura), salitre, desprendimiento de pintura | Agua ascendente desde cimentación (terreno). Común en piso bajo | Inyección de barrera hidrófuga en muro base + revoco transpirable |
| **Humedad por filtración** | Manchas horizontales o sectorizadas, sin patrón ascendente | Agua entrando desde exterior (fachada, cubierta, ventana) | Impermeabilización exterior + reparación origen |
| **Humedad por condensación** | Manchas localizadas en rincones, moho, ventanas con agua | Mala ventilación, puente térmico | Mejora ventilación (DB-HS3), aislamiento térmico, trasdosado |
| **Humedad por fuga de fontanería** | Mancha localizada + aumento progresivo | Tubería oculta rota | Termografía o apertura → sustituir tubería + sanear |

**Criterio de gravedad**:
- Capilaridad: **intervención obligatoria** antes de reforma (si no, la reforma se estropeará).
- Filtración: **intervención obligatoria** antes de reforma.
- Condensación: a veces se soluciona con mejor ventilación y aislamiento en la misma reforma.
- Fuga: **intervención inmediata**, no esperar a reforma.

### 2. Fisuras

#### 2.1. Fisuras no estructurales (en acabados)

| Tipo | Síntomas | Gravedad |
|---|---|---|
| Fisura de retracción en yeso | Fisura fina, recta, en tabique | Cosmética — sellar con masilla + pintar |
| Fisura de acabado en junta | Línea fina en encuentro de material | Cosmética — enmasillar |
| Microfisuras en pintura | Red fina, generalmente por aplicación deficiente | Cosmética — repintar |

#### 2.2. Fisuras estructurales

| Tipo | Síntomas | Gravedad |
|---|---|---|
| Fisura vertical en muro portante | Línea vertical ≥ 1 mm ancho, continua en altura | **ALTA — intervención técnica urgente** |
| Fisura horizontal a altura de forjado | Línea horizontal en encuentro muro-forjado | Posible asiento diferencial. **Revisión cimentación**. |
| Fisura en diagonal "escalera" en muro | Diagonal siguiendo ladrillos | **Movimiento estructural**. Requiere estudio. |
| Rotura de arco sobre hueco | Grieta alrededor de ventana/puerta | Revisión dintel + refuerzo |
| Fisura en vigueta de forjado | Visible en techo | **CRÍTICA** — proyecto de refuerzo estructural |

**Criterio**: toda fisura > 1 mm de ancho o con evolución (se abre con el tiempo) requiere **evaluación técnica por arquitecto superior**. En reforma, **NO ejecutar** nada hasta evaluación.

### 3. Ataques bióticos

| Tipo | Visible en | Intervención |
|---|---|---|
| Termitas | Galerías en madera, excrementos (tipo serrín fino), madera hueca | Tratamiento antixilófago completo (pulverización + gel o inyección) |
| Carcoma | Agujeros circulares pequeños en madera + serrín | Tratamiento antixilófago; sustitución si pieza estructural |
| Moho / hongos | Manchas verdosas o negras en superficies húmedas | Limpieza + corrección humedad + fungicida |
| Salitre / eflorescencias | Polvo blanco cristalino en muros con humedad | Limpieza + solución humedad |

### 4. Oxidación / corrosión

| Elemento | Síntomas | Intervención |
|---|---|---|
| Barras de armadura de hormigón visibles oxidadas | Manchas rojizas, desprendimiento de hormigón | **Proyecto refuerzo estructural** — armaduras con < 2 cm de recubrimiento |
| Viguetas de acero en forjado | Corrosión visible en viguetas | Evaluación estructural + refuerzo/sustitución |
| Tubería de acero galvanizado | Manchas rojizas, fugas | Sustituir por multicapa |

### 5. Aluminosis (forjados años 50-70)

**Grave** — aparece en edificios construidos con cemento aluminoso (prohibido desde 1977 en España). Síntomas:
- Viguetas con manchas rojizas y blancas.
- Pérdida de sección de las viguetas.
- En casos avanzados, hundimiento del forjado.

Intervención: **refuerzo o sustitución de forjado completo** — obra mayor, requiere proyecto técnico y visado.

**En reforma de piso de los 60-70**: preguntar siempre al cliente si el edificio ha sido inspeccionado por aluminosis. Si no, recomendar inspección técnica de un arquitecto superior.

### 6. Problemas en instalaciones

| Problema | Cómo detectar | Intervención |
|---|---|---|
| Cuadro eléctrico antiguo (fusibles o pastillas) | Inspección visual | Sustitución completa (ver `electrica_REBT.md`) |
| Ausencia de toma de tierra | Medidor en enchufe + visual del cuadro | Ejecución obligatoria |
| Tubería de plomo en fontanería | Inspección + test sanitario del agua | **Sustitución obligatoria** (prohibida) |
| Fibrocemento (amianto) en bajantes o cubierta | Inspección visual por especialista | **Retirada con empresa RERA autorizada** — obligatorio |
| Canalizaciones de gas antigua (hierro sin certificación) | Inspección por empresa autorizada | Sustitución |

### 7. Aislamiento térmico/acústico deficiente

Muy frecuente en pisos previos a 1980:
- Fachada de 1 hoja de ladrillo macizo sin aislamiento → transmisión térmica alta.
- Muro medianero con vecino sin aislamiento acústico → ruido transmitido.

**Intervención**: trasdosado con aislamiento de lana mineral 40-60 mm + placa de pladur. Pierde 5-7 cm de pared pero mejora drásticamente aislamiento.

## Protocolo de inspección visual en visita previa

### Lo mínimo a mirar (sin herramientas)

- [ ] Paredes y techos: fisuras, humedades, desconchado.
- [ ] Suelos: nivelación (con canica o plomada visual), holguras entre piezas.
- [ ] Ventanas y puertas: funcionamiento, sellado, vidrios rotos o simples (monolíticos).
- [ ] Baños: pavimento roto, alicatado con juntas deterioradas, olor a humedad o atasco, sifones secos.
- [ ] Cocina: salida de humos, condensaciones, olor a gas.
- [ ] Cuadro eléctrico: tipo, edad aparente (si hay fusibles o pastillas → viejo).
- [ ] Fontanería: presión de grifo, color del agua (rojizo → corrosión en tubería de acero).
- [ ] Desagües: velocidad de evacuación, olor.
- [ ] Ventilación: salidas al exterior, rejillas.

### Con termocámara (opcional)

- Detecta humedades ocultas.
- Detecta puentes térmicos.
- Detecta fugas en tuberías ocultas.

Coste orientativo termografía profesional: 150-400 € una inspección de vivienda.

## Clasificación para `agent_pathology`

Cuando el arquitecto suba fotos al sistema (futuro), Claude Vision clasificará:

```json
{
  "pathology_type": "humedad_capilaridad | humedad_filtracion | humedad_condensacion | fuga_fontaneria | fisura_estructural | fisura_acabado | ataque_biotico | corrosion | otros",
  "location": "string - habitación y posición",
  "severity": "critica | alta | media | baja",
  "structural_impact": true | false,
  "requires_technical_evaluation": true | false,
  "suggested_intervention": "string",
  "normativa_afectada": ["string - DB aplicable o normativa"],
  "blocks_reform": true | false  // si es crítica, bloquea avance del pipeline hasta validación
}
```

## Espacio para Damián

Casos reales que hayas visto:

```
## Mis casos (Damián)

### Caso 1 - Proyecto X
- Patología: ...
- Diagnóstico: ...
- Intervención: ...
- Lección aprendida: ...

### Caso 2 - Proyecto Y
...
```

Estos casos reales son oro para que `agent_pathology` aprenda tus criterios específicos.

## Referencias

- Manual de Patología de la Edificación (Enrique Alarcón, UPM).
- Guías del IETcc (Instituto Eduardo Torroja).
- Normas UNE específicas por patología.
