# Detalles constructivos — TU biblioteca técnica

## Estado

- **Pendiente:** Damián aportará detalles específicos cuando quiera estandarizarlos.
- **Consumido por:** `agent_design`, `agent_documents`.

---

## Propósito

Cada detalle constructivo recurrente (fachada ventilada, cubierta invertida, medianera mejorada acústicamente, dintel de apertura en muro portante, etc.) vive en su propio archivo. Los agentes los citan y aplican a cada proyecto específico.

## Estructura propuesta

```
detalles_constructivos/
├── README.md                                    ← este archivo
├── tabiques/
│   ├── tabique_pladur_15_70_15_aislamiento.md
│   ├── tabique_ladrillo_7cm.md
│   └── medianera_acustica.md
├── suelos/
│   ├── solado_porcelanico_sobre_recrecido.md
│   ├── suelo_radiante_hidraulico.md
│   └── tarima_flotante_sobre_acustico.md
├── baño/
│   ├── plato_ducha_extraplano.md
│   └── ventilación_baño_sin_ventana.md
├── cocina/
│   ├── campana_con_salida_exterior.md
│   └── encimera_con_anclaje_a_tabiqueria.md
├── carpinteria/
│   ├── ventana_aluminio_RPT_con_cajon_persiana.md
│   └── puerta_corredera_empotrada.md
├── estructura/
│   ├── apertura_muro_portante_con_dintel.md
│   └── apeo_provisional_derribo_muro.md
└── aislamiento/
    ├── trasdosado_fachada_existente.md
    └── refuerzo_acustico_medianera.md
```

## Plantilla por detalle

Cada archivo debe contener:

```markdown
# [Nombre del detalle]

## Cuándo usarlo

Situaciones en las que aplicas este detalle.

## Descripción técnica

Explicación 3-5 líneas.

## Componentes

- Material 1: especificación
- Material 2: especificación
- ...

## Normativa aplicable

- CTE DB-X sección Y
- Otra norma

## Dibujo / esquema

Enlace al archivo gráfico (Google Drive, Figma, DWG) o imagen embebida.

## Mediciones típicas

- Precio m² / ud orientativo
- Tiempo ejecución

## Gremios implicados

- Gremio principal
- Gremio auxiliar

## Errores clásicos a evitar

- ...

## Casos donde NO usarlo

- ...
```

## Cómo añadir un detalle

Tras cada proyecto donde pongas en práctica un detalle, si te ha funcionado y lo quieres estandarizar:

1. Crea un `.md` en la subcarpeta correspondiente.
2. Rellena la plantilla.
3. Adjunta (o linkea) el dibujo técnico.
4. Me avisas: "he añadido `detalles_constructivos/tabiques/medianera_acustica.md`, úsalo en agent_design".

Yo integro la referencia al detalle en el prompt_system de `agent_design` para que cuando haya situación compatible, lo proponga.

## Lo importante

**No hace falta que crees 50 detalles**. Con 5-10 que tú uses frecuentemente es suficiente. Son los "ladrillos" con los que el sistema construye propuestas consistentes.
