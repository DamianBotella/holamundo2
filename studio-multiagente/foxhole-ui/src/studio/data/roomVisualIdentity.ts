/**
 * Identidad visual de cada sala (B72 rediseno cutaway).
 *
 * Cada sala tiene:
 *   floorColor: color del suelo plano (sin textura — el suelo limpio se ve
 *     mejor con muebles densos encima)
 *   wallLeft:  pared trasera NW (mas oscura, sombra del lado izq)
 *   wallRight: pared trasera NE (mas clara, luz del lado der)
 *   floorAlpha: opacidad del relleno del suelo
 *
 * Paleta calida coherente: maderas, beiges, algun verde para terraza,
 * azul para reuniones, rojo desaturado para urgencias. Cada sala
 * reconocible por su color a primer vistazo.
 *
 * Los room_id usados aqui son los REALES de la BD (migracion 056b).
 */

export interface RoomVisualIdentity {
  floorColor: number;
  wallLeft: number;
  wallRight: number;
  floorAlpha: number;
}

export const ROOM_VISUAL_IDENTITY: Record<string, RoomVisualIdentity> = {
  // RECEPCION — beige calido, paredes ocre
  reception: {
    floorColor: 0xf5edd8,
    wallLeft:   0xb5946d,
    wallRight:  0xc4a882,
    floorAlpha: 1,
  },
  // MESA DE DIBUJO — verde muy suave (estudios suelen tener verde calmante)
  drawing_room: {
    floorColor: 0xeef0e4,
    wallLeft:   0x7a9a6a,
    wallRight:  0x8baf7a,
    floorAlpha: 1,
  },
  // BIBLIOTECA NORMATIVA — azul grisaceo libreria seria
  normative_library: {
    floorColor: 0xe4e8f0,
    wallLeft:   0x6a7f9e,
    wallRight:  0x7a8faf,
    floorAlpha: 1,
  },
  // DESPACHO CONTABLE — beige amaderado contable
  accounting_office: {
    floorColor: 0xf0ebe0,
    wallLeft:   0xa88a60,
    wallRight:  0xb89a70,
    floorAlpha: 1,
  },
  // DIRECCION (orquestador) — madera oscura formal
  main_office: {
    floorColor: 0xe8e4d8,
    wallLeft:   0x6a5a4a,
    wallRight:  0x7a6a5a,
    floorAlpha: 1,
  },
  // SALA DE REUNIONES — azul sereno
  meeting_room: {
    floorColor: 0xe0e8f0,
    wallLeft:   0x5a7a9a,
    wallRight:  0x6a8aaa,
    floorAlpha: 1,
  },
  // TERRAZA + CAFE — verde exterior calido (cafe + plantas)
  site_terrace: {
    floorColor: 0xd8ecc8,
    wallLeft:   0x4a7a3a,
    wallRight:  0x5a8a4a,
    floorAlpha: 1,
  },
  // TALLER GREMIOS — marron tipo workshop
  trades_workshop: {
    floorColor: 0xe0d8cc,
    wallLeft:   0x7a6050,
    wallRight:  0x8a7060,
    floorAlpha: 1,
  },
  // ARCHIVO — gris beige neutro
  archive: {
    floorColor: 0xe8e4dc,
    wallLeft:   0x9a9080,
    wallRight:  0xaaa090,
    floorAlpha: 1,
  },
  // CORREDOR DE URGENCIAS — rojo desaturado urgente pero no chillon
  urgency_corridor: {
    floorColor: 0xf0dada,
    wallLeft:   0x994040,
    wallRight:  0xaa5050,
    floorAlpha: 1,
  },
};

/** Altura de las paredes en pixeles iso (recomendado documento: 60-80) */
export const WALL_HEIGHT = 70;
