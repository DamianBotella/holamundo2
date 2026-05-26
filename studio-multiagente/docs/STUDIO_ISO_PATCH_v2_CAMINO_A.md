# STUDIO ISO — PATCH v2.0 (CAMINO A: NAVEGACIÓN HABBO)

> Patch que REEMPLAZA la composición isométrica unificada del spec v1.0 por navegación sala-a-sala estilo Habbo. Una sala visible a la vez en pantalla, puertas como hotspots clickeables.
>
> Razón del cambio: las 11 PNGs se generaron como sprites standalone (paredes N+W full height + S+E cutaway). Esta decisión es incompatible con composición en mundo isométrico unificado — las paredes traseras de cada sala chocan con las salas adyacentes. La navegación sala-a-sala elimina el problema sin tirar ningún asset.

-----

## 0. CAMBIO DE PARADIGMA

|Aspecto                |v1.0 (deprecated)                        |v2.0 (Camino A)                    |
|-----------------------|-----------------------------------------|-----------------------------------|
|Renderizado            |11 salas en sus `worldOffset` isométricos|1 sala centrada en el canvas       |
|Vista global           |Mundo isométrico completo                |(Opcional) mini-map SVG esquemático|
|Doors                  |Tiles walkable con teleport interno      |Hotspots clickeables visibles      |
|Agentes visibles       |Todos los 39 a la vez                    |Solo los del `activeRoomId`        |
|Pathfinding entre salas|A* + teleport entre rooms                |Idéntico (el pathfinding no cambia)|

El backend (`rooms.ts`, `pathfinding.ts`, `agent-conflicts.ts`) NO se modifica. Solo cambia la capa de presentación.

-----

## 1. ESTADO CENTRAL DEL STUDIO

```typescript
interface StudioState {
  activeRoomId: string;          // sala actualmente en pantalla
  isTransitioning: boolean;      // true durante el fade
  agents: Record<string, Agent>; // los 39 — siempre tracked en background
}
```

Estado inicial: `activeRoomId = 'reception'`.

-----

## 2. RENDERIZADO DE LA SALA ACTIVA

- El PNG de la sala activa se carga como sprite único.
- Se centra en el canvas.
- Se escala para encajar con 90% del lado menor del canvas (mantiene aspect ratio).
- No hay `worldOffset` ni posicionamiento isométrico mundial.
- Fondo del canvas: gradiente cálido sutil (no gris #444 — eso era el background de generación).

-----

## 3. DOORS COMO HOTSPOTS INTERACTIVOS

Cada `door` en `rooms.ts` ya tiene su `tile` local. Conversión:

```typescript
function doorScreenPosition(door: Door, room: RoomDef, canvas: {w, h}): {x, y} {
  // 1. Local tile → local iso pixel (relativo al origen 0,0 de la sala)
  const localIso = tileToIso(door.tile.x, door.tile.y);

  // 2. Pixel offset desde el centro de la sala (tile bbox)
  const roomCenterIso = tileToIso(room.width / 2, room.height / 2);
  const offsetFromCenter = {
    x: localIso.x - roomCenterIso.x,
    y: localIso.y - roomCenterIso.y,
  };

  // 3. Aplicar escala global de la sala al canvas
  const scale = computeRoomFitScale(room, canvas);

  // 4. Posición en pantalla: centro del canvas + offset escalado
  return {
    x: canvas.w / 2 + offsetFromCenter.x * scale,
    y: canvas.h / 2 + offsetFromCenter.y * scale,
  };
}
```

Hotspot:

- Polígono/círculo invisible de 64×64px (escalado al fit) en cada posición de door.
- Hover → cursor `pointer` + tooltip "→ Dirección" (nombre del room destino).
- Click → ejecuta `navigateToRoom(door.to, door.toTile)`.

-----

## 4. NAVEGACIÓN ENTRE SALAS

```typescript
async function navigateToRoom(targetRoomId: string, arrivalTile?: Vec2) {
  setState({ isTransitioning: true });
  await fadeOut(150);  // 150ms
  setState({
    activeRoomId: targetRoomId,
    isTransitioning: false,
  });
  await fadeIn(150);   // 150ms
}
```

Total: 300ms transición.

-----

## 5. VISIBILIDAD DE AGENTES (fase posterior)

Solo los del `activeRoomId` se renderizan. Los demás siguen actualizándose en background.

-----

## 6. HUD MÍNIMO (recomendado)

Widget compacto arriba-derecha con sala activa + contador placeholder hasta integrar agentes reales.

-----

## 9. PROMPT PARA CLAUDE CODE (resumen ejecutado en este turno)

1. Guardar este patch en `docs/`.
2. Borrar lógica Pixi de `Studio.tsx` v1.
3. Crear arquitectura: `Studio.tsx` + `StudioNavigator.tsx` + `RoomView.tsx` + `DoorHotspot.tsx` + `HUD.tsx` + 3 hooks.
4. Implementar fit-scale + door hotspots + fade transitions.
5. Fondo gradiente cálido.
6. `npm run dev` y validar.

**Versión:** 2.0
**Fecha:** Mayo 2026
