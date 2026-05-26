/**
 * Mapeo de cada room_id al sprite_id de su suelo de tarima.
 *
 * Tres tiles disponibles (PixelLab, top-down planos seamless):
 *   - floor_tile_oak_warm   -> tarima de roble calida (oficinas calidas)
 *   - floor_tile_oak_dark   -> tarima de nogal oscura (zonas formales)
 *   - floor_tile_oak_light  -> tarima de pino clara (zonas tecnicas/exteriores)
 *
 * Si el sprite no esta cargado, StudioRoom hace fallback al floorColor de
 * roomVisualIdentity.
 */

export const ROOM_FLOOR_TILE: Record<string, string> = {
  reception:         'floor_tile_oak_warm',
  drawing_room:      'floor_tile_oak_warm',
  normative_library: 'floor_tile_oak_dark',
  accounting_office: 'floor_tile_oak_warm',
  main_office:       'floor_tile_oak_dark',
  meeting_room:      'floor_tile_oak_warm',
  site_terrace:      'floor_tile_oak_light',
  trades_workshop:   'floor_tile_oak_light',
  archive:           'floor_tile_oak_dark',
  urgency_corridor:  'floor_tile_oak_warm',
};
