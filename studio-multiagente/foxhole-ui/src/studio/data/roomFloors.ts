/**
 * Mapeo de cada room_id al sprite_id de su suelo de tarima (B72c).
 *
 * Los tres tiles disponibles (PixelLab, top-down planos seamless):
 *   - floor_tile_oak_warm   -> tarima de roble calida (default)
 *   - floor_tile_oak_dark   -> tarima de nogal oscura (zonas formales)
 *   - floor_tile_oak_light  -> tarima de pino clara (zonas tecnicas/abiertas)
 *
 * Si el sprite no esta cargado todavia (script PixelLab no ejecutado),
 * StudioRoom hace fallback al `floor_color` plano de la BD.
 */

export const ROOM_FLOOR_TILE: Record<string, string> = {
  reception:         'floor_tile_oak_warm',
  drawing_room:      'floor_tile_oak_warm',
  normative_library: 'floor_tile_oak_dark',   // biblioteca = madera oscura formal
  accounting_office: 'floor_tile_oak_warm',
  main_office:       'floor_tile_oak_dark',   // direccion = madera oscura formal
  meeting_room:      'floor_tile_oak_warm',
  site_terrace:      'floor_tile_oak_light',  // terraza = pino claro exterior
  trades_workshop:   'floor_tile_oak_light',  // taller = pino claro tecnico
  archive:           'floor_tile_oak_dark',   // archivo = madera oscura
  urgency_corridor:  'floor_tile_oak_warm',
};
