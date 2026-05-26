# STUDIO ISOMÉTRICO ARQUITAI — SPEC EJECUTABLE PARA CLAUDE CODE

> Versión derivada de `ESTUDIO_ISOMETRICO_SPEC_TECNICA.md` (Mayo 2026).
> Esta versión es **ejecutable**: matrices, coordenadas y código listos para implementar
> sin interpretación adicional. Stack: PixiJS v8 + TypeScript 5. Tile 64×32px.

-----

## 0. DECISIONES DE ARQUITECTURA (CONFIRMADAS POR DAMIÁN)

|#|Punto                                       |Decisión                                                                                    |
|-|--------------------------------------------|--------------------------------------------------------------------------------------------|
|1|**Corredor Central**                        |Sala real 4×25 tiles. Agentes `failed` la recorren físicamente (no teleport puro).          |
|2|**Taller Gremios — conflicto puertas norte**|2 puertas norte: `(5,0)` → Archivo, `(8,0)` → Terraza Inspección.                           |
|3|**Conflicto agente-agente en mismo tile**   |Prioridad por estado: `working > meeting > waiting_approval > idle > failed`. Empate → FIFO.|

### Inconsistencias del spec original resueltas

- **Dirección dice "Norte → Biblioteca", "Oeste → Mesa Dibujo"** pero geográficamente esos rooms no son adyacentes. **Resolución:** las puertas N, O y SO de Dirección teleportan al **Corredor Central** en tiles distintos (la conexión final con Biblioteca/Mesa Dibujo/Despacho es transitiva vía corredor). Las puertas E (Taller) y S (Sala Reuniones) sí son geográficamente directas.
- **Archivo dice "Oeste → Biblioteca"** pero hay un corredor entre ambos. **Resolución:** Archivo Oeste → Corredor (transitivo hacia Biblioteca).
- **Catalog_sync en tile `(9,6)` de Archivo**: tile en pared este. **Resolución:** se abre ese tile como walkable (estantería rebajada / ventana operativa).

-----

## 1. WORLD LAYOUT — OFFSETS EN TILES MUNDIALES

Todas las salas referencian su tile local `(0,0)` desde un `worldOffset` global en tiles.
Cada sala es self-contained para pathfinding; las **puertas teleportan** entre salas.

|Sala                |id                  |worldOffset (x,y)|size W×H|Iso px del origen|
|--------------------|--------------------|-----------------|--------|-----------------|
|Biblioteca Normativa|`library`           |(0, 0)           |10×8    |(0, 0)           |
|Mesa Dibujo         |`drawing_room`      |(0, 9)           |10×8    |(−288, 144)      |
|Recepción           |`reception`         |(0, 18)          |10×8    |(−576, 288)      |
|Corredor Central    |`corridor`          |(10, 0)          |4×25    |(320, 160)       |
|Archivo             |`archive`           |(14, 0)          |10×8    |(448, 224)       |
|Dirección           |`direction`         |(14, 9)          |12×10   |(160, 368)       |
|Sala Reuniones      |`meeting_room`      |(14, 19)         |10×8    |(−160, 528)      |
|Taller Gremios      |`workshop`          |(26, 9)          |10×8    |(544, 560)       |
|Despacho Contable   |`accounting`        |(26, 19)         |10×8    |(224, 720)       |
|Terraza Cafetería   |`cafe_terrace`      |(14, 27)         |14×6    |(−416, 656)      |
|Terraza Inspección  |`inspection_terrace`|(26, 0)          |8×5     |(832, 416)       |

**Tamaño total del mundo en tiles:** ~40 ancho × 33 alto. Iso pixel bounding box estimado: ~2560×1200px (a calcular en runtime, depende de camera).

-----

## 2. ISOMETRIC MATH — `iso-math.ts`

Proyección isométrica clásica para tile 64×32:

- `pixelX = (tileX - tileY) * 32`
- `pixelY = (tileX + tileY) * 16`

Ver el archivo `src/studio-v2/iso-math.ts` con el código completo.

-----

## 3. TYPES — `types.ts`

Ver `src/studio-v2/types.ts`.

-----

## 4. SALAS — `rooms.ts`

**Convención de matrices:** `collision[y][x]`. Fila 0 = norte, columna 0 = oeste.
Las puertas (`D`) son tiles walkable que disparan teleport al cruzarlas.

Ver `src/studio-v2/rooms.ts` con las 11 salas completas y sus puertas.

-----

## 5. PUESTOS DE TRABAJO — 36 AGENTES

Tabla pre-computada con `pixelX = (worldX - worldY) * 32`, `pixelY = (worldX + worldY) * 16`.

|Agente                       |Sala              |Tile local|World tile|Iso px (centro)|
|-----------------------------|------------------|----------|----------|---------------|
|`main_orchestrator`          |direction         |(6,5)     |(20,14)   |(192, 544)     |
|`agent_briefing`             |reception         |(5,4)     |(5,22)    |(−544, 432)    |
|`agent_client_concierge`     |reception         |(2,4)     |(2,22)    |(−640, 384)    |
|`agent_design`               |drawing_room      |(5,4)     |(5,13)    |(−256, 288)    |
|`agent_sketch_to_scale`      |drawing_room      |(3,4)     |(3,13)    |(−320, 256)    |
|`agent_proposal`             |drawing_room      |(7,5)     |(7,14)    |(−224, 336)    |
|`agent_regulatory`           |library           |(4,4)     |(4,4)     |(0, 128)       |
|`agent_normativa_refresh`    |library           |(7,2)     |(7,2)     |(160, 144)     |
|`agent_accessibility`        |library           |(2,5)     |(2,5)     |(−96, 112)     |
|`agent_iee`                  |library           |(6,5)     |(6,5)     |(32, 176)      |
|`agent_costs`                |accounting        |(4,4)     |(30,23)   |(224, 848)     |
|`agent_financial_tracker`    |accounting        |(7,3)     |(33,22)   |(352, 880)     |
|`agent_contracts`            |accounting        |(2,3)     |(28,22)   |(192, 800)     |
|`agent_grants_finder`        |accounting        |(5,6)     |(31,25)   |(192, 896)     |
|`agent_memory`               |direction         |(2,7)     |(16,16)   |(0, 512)       |
|`agent_collab_coordinator`   |direction         |(9,3)     |(23,12)   |(352, 560)     |
|`agent_decision_engine`      |direction         |(8,7)     |(22,16)   |(192, 608)     |
|`agent_trades`               |workshop          |(5,3)     |(31,12)   |(608, 688)     |
|`agent_trade_comms`          |workshop          |(3,5)     |(29,14)   |(480, 688)     |
|`agent_materials`            |workshop          |(7,4)     |(33,13)   |(640, 736)     |
|`agent_home_automation`      |workshop          |(8,6)     |(34,15)   |(608, 784)     |
|`agent_rcd`                  |workshop          |(2,6)     |(28,15)   |(416, 688)     |
|`agent_documents`            |archive           |(5,4)     |(19,4)    |(480, 368)     |
|`agent_certificate_generator`|archive           |(7,3)     |(21,3)    |(576, 384)     |
|`agent_permit_tracker`       |archive           |(3,2)     |(17,2)    |(480, 304)     |
|`agent_qc_checklists`        |archive           |(6,6)     |(20,6)    |(448, 416)     |
|`agent_compliance_audit`     |archive           |(2,5)     |(16,5)    |(352, 336)     |
|`agent_telematic_filing`     |archive           |(8,5)     |(22,5)    |(544, 432)     |
|`agent_catalog_sync`         |archive           |(9,6)     |(23,6)    |(544, 464)     |
|`agent_aftercare`            |cafe_terrace      |(3,3)     |(17,30)   |(−416, 752)    |
|`agent_site_monitor`         |inspection_terrace|(4,2)     |(30,2)    |(896, 512)     |
|`agent_client_translator`    |meeting_room      |(3,4)     |(17,23)   |(−192, 640)    |
|`agent_anomaly_detector`     |corridor          |(1,8)*    |(11,8)    |(96, 304)      |
|`agent_pathology`            |corridor          |(2,11)*   |(12,11)   |(32, 368)      |
|`agent_safety_plan`          |corridor          |(1,16)*   |(11,16)   |(−160, 432)    |
|`agent_energy_assessor`      |corridor          |(2,19)*   |(12,19)   |(−224, 496)    |

*Tiles "rest" — los 4 agentes del corredor patrullan tiles walkable.

-----

## 6. PATHFINDING — `pathfinding.ts`

A* dentro de cada sala, 4-direcciones (sin diagonales), heurística Manhattan.
Ver `src/studio-v2/pathfinding.ts`.

-----

## 7. CONFLICTOS AGENTE-AGENTE Y ESTADOS — `agent-conflicts.ts`

Ver `src/studio-v2/agent-conflicts.ts`.

-----

## 8. CASOS EDGE — RESUELTOS

### 8.1 Dos agentes quieren el mismo tile
Prioridad por estado. Empate → FIFO. Step-aside con `findNearestWalkable()`.

### 8.2 Cruce frontal (A→tile de B, B→tile de A)
`detectFrontalSwap()` → swap simultáneo vía `executeFrontalSwap()`.

### 8.3 Agente interrumpido a media ruta
`interruptAgent()` cambia estado pero NO cancela transición tile-a-tile en curso. Path se recalcula en próximo tick.

### 8.4 Sala Reuniones llena (>8 agentes)
Primero 8 asientos. Si llenos → tile cerca de puerta W. Si saturada → corredor (2,23).

### 8.5 Agentes failed en el corredor
`findCorridorWanderSpot()` re-elige cada 8–15s para crear efecto patrulla visual.

### 8.6 Tile destino inalcanzable
`findPath()` devuelve `[]`. Intentar `findNearestWalkable(target, occupied, 3)`. Si no hay, agente queda `idle`.

### 8.7 Puerta de destino ocupada
Puertas son walkable y reservables. Conflicto se resuelve con `resolveTileConflict()`.

-----

## 9. PROMPTS GEMINI (gemini-2.5-flash-image) — 11 SALAS

Plantilla base común:

```
Top-down isometric 2.5D interior view at 45 degrees, architecture studio in Madrid,
warm professional palette (cream, terracotta, navy, warm grey, oak wood),
natural daylight from north, no humans, no text, no labels,
clean architectural visualization style, soft realistic shadows,
furniture and materials clearly defined, transparent background or floor only.
Format: square 1024×1024, ready to use as room tile texture.
[ESPECÍFICO DE SALA]
```

(11 prompts específicos en el spec original — las imágenes ya están generadas y guardadas en `public/assets/rooms/`.)

-----

## 10. RESUMEN PARA EJECUCIÓN INMEDIATA

1. Archivos `iso-math.ts`, `types.ts`, `rooms.ts`, `pathfinding.ts`, `agent-conflicts.ts` en `src/studio-v2/`.
2. `Studio.tsx` que monta PIXI.Application v8 con las 11 PNGs como sprites en sus `worldOffset` con z-ordering isométrico (`isoZIndex(gx, gy)`). Cámara con paneo (click+drag) y zoom (wheel). **Sin agentes** todavía.
3. Validación visual antes de añadir agentes.

**Versión:** 1.0 ejecutable. **Fecha:** Mayo 2026.
