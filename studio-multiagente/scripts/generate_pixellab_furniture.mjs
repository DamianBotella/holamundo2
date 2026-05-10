// Genera los sprites de mobiliario para B72 — La Oficina Viva.
//
// Ejecutar:
//   PIXELLAB_API_KEY="..." node scripts/generate_pixellab_furniture.mjs [--only id]
//
// Cada PNG se guarda en foxhole-ui/src/studio/assets/sprites/furniture/{id}.png
// y el componente StudioFurniture lo carga automaticamente via Vite glob (igual
// que spriteRegistry hace con los personajes).
//
// Mismo patron que generate_pixellab_sprites.mjs (caracteres). 1.5s entre
// llamadas para evitar rate-limit. Coste estimado: ~$0.04 x 28 = ~$1.12.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FURNITURE_DIR = path.resolve(__dirname, '../foxhole-ui/src/studio/assets/sprites/furniture');

const API_KEY = process.env.PIXELLAB_API_KEY;
if (!API_KEY) {
  console.error('Falta PIXELLAB_API_KEY en el entorno.');
  process.exit(1);
}

if (!fs.existsSync(FURNITURE_DIR)) {
  fs.mkdirSync(FURNITURE_DIR, { recursive: true });
}

// PROMPT_BASE pegado al estilo de los character sprites: paleta calida,
// arquitectura tecnica profesional, NO militar, fondo transparente, top-down iso.
const PROMPT_BASE =
  'top-down isometric pixel art furniture, 64x64 pixels, transparent background, ' +
  'spanish architecture studio professional office theme, ' +
  'warm muted color palette (cream, wood brown, beige, slate blue), ' +
  'painterly outline, single object centered, no characters, no people, ' +
  'isometric 30 degree angle viewed from above, clean pixel edges, ';

const FURNITURE = [
  // RECEPCION
  ['furniture_reception_desk',     'wooden reception counter desk in light oak wood, papers and notepad on top, civilian office front desk, no military elements'],
  ['furniture_reception_chair',    'single waiting room chair in muted blue grey upholstery with wooden legs, civilian office'],
  ['furniture_reception_plant',    'large potted office plant with broad green leaves in terracotta planter, indoor decorative'],

  // MESA DE DIBUJO (drawing_room)
  ['furniture_drafting_table',     'tilted architect drafting table in dark wood with rolled blueprints and t-square on top, civilian'],
  ['furniture_drafting_lamp',      'articulated metal desk lamp in matte black with green shade, professional drafting lamp'],
  ['furniture_blueprint_roll',     'stack of rolled architectural blueprints in beige paper tied with string, leaning'],

  // BIBLIOTECA NORMATIVA
  ['furniture_bookshelf_tall',     'tall wooden bookshelf full of thick technical CTE regulation books in red brown blue spines, civilian library'],
  ['furniture_bookshelf_small',    'short wide wooden bookshelf with manila folders and binders organized by color tag'],
  ['furniture_reading_desk',       'small wooden reading desk with open book and reading lamp, civilian library furniture'],

  // DESPACHO CONTABLE
  ['furniture_office_desk',        'standard office desk in beige laminate with desktop computer monitor and keyboard on top, civilian'],
  ['furniture_filing_cabinet',     'three drawer metal filing cabinet in light grey with label tags on each drawer, civilian office'],
  ['furniture_desk_chair',         'ergonomic black office swivel chair with five wheel base, modern civilian office'],

  // DIRECCION
  ['furniture_director_desk',      'large executive desk in dark mahogany wood with leather inlay top, papers and laptop and pen holder, civilian executive'],
  ['furniture_meeting_chairs_2',   'pair of two visitor chairs in dark leather facing forward side by side, civilian meeting'],
  ['furniture_bookcase_director',  'tall wall bookcase in dark wood with books awards diplomas and small trophies on shelves'],

  // SALA DE REUNIONES
  ['furniture_conference_table',   'rectangular conference table in light oak wood with carafe and water glasses on top, civilian boardroom'],
  ['furniture_conference_chair',   'single conference room chair in dark fabric upholstery with metal frame, modern civilian'],
  ['furniture_whiteboard',         'large white wall mounted whiteboard with marker tray and faint diagram lines, civilian office'],

  // TERRAZA - INSPECCION (site_terrace)
  ['furniture_terrace_chair',      'outdoor patio chair in natural rattan wicker weave with cushion seat, no military'],
  ['furniture_terrace_table',      'small round outdoor cafe table in natural wicker with glass top, civilian terrace'],
  ['furniture_potted_cactus',      'tall green cactus in large terracotta pot with small pebbles on soil, decorative outdoor plant'],

  // TALLER GREMIOS (trades_workshop)
  ['furniture_workbench',          'wooden carpenter workbench with hammer wrench screwdriver and pliers on top, civilian workshop tools'],
  ['furniture_tool_rack',          'wall mounted pegboard tool rack with hanging hammer saw screwdrivers wrenches in shadow outlines'],
  ['furniture_plans_table',        'low wide table with large unrolled construction blueprints and ruler and pencil on top, civilian'],

  // ARCHIVO
  ['furniture_archive_shelf',      'tall metal industrial archive shelving unit with labeled cardboard storage boxes on each shelf'],
  ['furniture_archive_cabinet',    'wooden card catalog index cabinet with many small drawers each labeled, library archive'],
  ['furniture_ladder_shelf',       'wooden rolling library ladder leaning against tall bookshelf, civilian library'],

  // CORREDOR DE URGENCIAS (urgency_corridor)
  ['furniture_alarm_light',        'ceiling mounted red rotating emergency alarm light with metal grill cover, small 32x32 pixel size, civilian'],
  ['furniture_monitor_stand',      'wall mounted security monitoring panel with multiple small screens showing site cameras, civilian'],

  // ---- B72b extras: decoracion ambiental para que las salas se sientan habitadas ----

  // Decoracion compartida varias salas
  ['furniture_floor_lamp',                  'tall standing floor lamp with beige fabric drum lampshade and brass base, civilian office decor'],
  ['furniture_wall_artframe_blueprint',     'framed architectural blueprint poster on wall in dark wood frame, technical drawing decor'],
  ['furniture_small_plant',                 'small green leafy houseplant in white ceramic pot on table or floor, decorative civilian'],
  ['furniture_corner_plant_tall',           'tall ficus tree houseplant in dark wicker basket pot, decorative corner office plant'],
  ['furniture_office_clock',                'classic round wall mounted analog office clock with white face and roman numerals, civilian'],
  ['furniture_recycling_bin',               'small office recycling bin with three compartments paper plastic glass, blue green yellow lids'],
  ['furniture_filing_papers_pile',          'untidy pile of stacked manila folders papers and binders on the floor in corner, civilian office'],

  // Cafeteria / descanso (terraza ampliada)
  ['furniture_coffee_machine',              'professional espresso coffee machine in chrome and black with steam wand and portafilter, cafe style'],
  ['furniture_coffee_bar',                  'small wooden cafe bar counter with light oak surface and front panel, civilian coffee corner'],
  ['furniture_bar_stool',                   'tall wooden bar stool with footrest and circular seat, cafe style civilian'],
  ['furniture_water_dispenser',             'standalone office water cooler dispenser with large blue water jug on top and small cups holder'],

  // ---- B72c: ambientacion completa (suelos + props densos) ----

  // Suelos de tarima parquet — texturas planas top-down (NO isometric).
  // El frontend las aplica como TilingSprite sobre el rombo iso de cada room.
  // Estos sprites NO usan el flag isometric (override en generateOne).
  ['floor_tile_oak_warm',                   'flat top down view of seamless tileable warm oak wood plank floor texture, horizontal wood planks aligned in straight rows, soft warm brown wood grain, repeating pattern, no perspective, no shadows, no objects, just floor texture'],
  ['floor_tile_oak_dark',                   'flat top down view of seamless tileable dark walnut wood plank floor texture, horizontal wood planks aligned in straight rows, deep brown wood grain, repeating pattern, no perspective, no shadows, no objects, just floor texture'],
  ['floor_tile_oak_light',                  'flat top down view of seamless tileable light pine wood plank floor texture, horizontal wood planks aligned in straight rows, pale beige wood grain, repeating pattern, no perspective, no shadows, no objects, just floor texture'],

  // Mesas con cosas encima (densidad oficina real)
  ['furniture_monitor_on_desk',             'standalone computer monitor with stand on small desk, modern flat screen with desktop wallpaper, civilian office'],
  ['furniture_keyboard_mouse_set',          'small mechanical keyboard and computer mouse pair on a desk surface, civilian office accessories'],
  ['furniture_coffee_cup',                  'small ceramic coffee cup with saucer and steam, beige and brown, civilian office desk item'],
  ['furniture_pencil_holder',               'small cylindrical pencil holder cup full of colored pencils and pens, wooden or ceramic, civilian'],
  ['furniture_table_lamp_small',            'small table desk lamp with green banker glass shade and brass base, classic civilian study lamp'],

  // Lounge / descanso / utilidades
  ['furniture_lounge_sofa',                 'comfortable two seat office lounge sofa in mustard yellow fabric with wooden legs, civilian rest area'],
  ['furniture_vending_machine',             'tall office vending machine with glass front showing snacks and drinks, red and white, civilian'],
  ['furniture_printer_multifunction',       'office multifunction laser printer in light grey with paper tray and small display, civilian'],

  // Decoracion calida (alfombras, cuadros, libros, plantas)
  ['furniture_carpet_round_warm',           'round area rug with warm beige and rust orange concentric pattern, civilian office decor, top down view'],
  ['furniture_carpet_rect_persian',         'small rectangular persian style area rug with warm red and gold ornate pattern, civilian decor'],
  ['furniture_painting_landscape',          'small framed landscape oil painting on wall in dark wood frame, mountain countryside scene, civilian decor'],
  ['furniture_books_stacked_horizontal',    'small horizontal stack of three thick hardcover books on a surface, mixed warm leather covers, civilian'],
  ['furniture_plant_hanging_wall',          'small hanging wall planter with pothos vine cascading green leaves, civilian indoor plant decor'],
];

async function generateOne(id, rolePrompt) {
  const isFloorTile = id.startsWith('floor_tile_');
  // Para floor tiles NO usamos PROMPT_BASE (que tiene "isometric pixel art
  // furniture"). Generamos textura plana repetible que el frontend tilea sobre
  // el rombo iso. Para muebles, prompt habitual.
  const description = isFloorTile ? rolePrompt : PROMPT_BASE + rolePrompt;
  // Tamano por tipo: tiles de suelo cuadrados 64x64 para mejor tiling planar;
  // alarma pequena en 32x32; resto de muebles en 64x64.
  let size = { width: 64, height: 64 };
  if (id === 'furniture_alarm_light') size = { width: 32, height: 32 };
  const body = {
    description,
    image_size: size,
    no_background: !isFloorTile, // los floors tienen fondo (es la propia textura)
    isometric: !isFloorTile,     // los floors NO son isometricos (top-down plano)
    text_guidance_scale: 9,
  };
  const res = await fetch('https://api.pixellab.ai/v2/create-image-pixflux', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json?.image?.base64) {
    throw new Error('respuesta sin image.base64: ' + JSON.stringify(json).slice(0, 200));
  }
  const buf = Buffer.from(json.image.base64, 'base64');
  const outPath = path.join(FURNITURE_DIR, `${id}.png`);
  fs.writeFileSync(outPath, buf);
  return { bytes: buf.length, usage: json.usage };
}

const onlyArgIdx = process.argv.indexOf('--only');
const onlyId = onlyArgIdx >= 0 ? process.argv[onlyArgIdx + 1] : null;

const skipArgIdx = process.argv.indexOf('--skip');
const skipIds = skipArgIdx >= 0
  ? process.argv[skipArgIdx + 1].split(',').map((s) => s.trim())
  : [];

let list = onlyId ? FURNITURE.filter(([id]) => id === onlyId) : FURNITURE;
if (skipIds.length > 0) {
  list = list.filter(([id]) => !skipIds.includes(id));
  console.log(`Skipping ${skipIds.length}: ${skipIds.join(', ')}`);
}
console.log(`Generating ${list.length} furniture sprite(s)...`);
let totalUsd = 0;
for (let i = 0; i < list.length; i++) {
  const [id, role] = list[i];
  const startedAt = Date.now();
  try {
    const r = await generateOne(id, role);
    const ms = Date.now() - startedAt;
    const usd = r.usage?.usd ?? 0;
    totalUsd += usd;
    console.log(`[${i + 1}/${list.length}] ${id}.png (${r.bytes}B, ${ms}ms, $${usd}, total $${totalUsd.toFixed(4)})`);
  } catch (err) {
    console.error(`[${i + 1}/${list.length}] FAIL ${id}: ${err.message}`);
  }
  if (i < list.length - 1) {
    await new Promise((r) => setTimeout(r, 1500));
  }
}
console.log(`\nDone. Total cost: $${totalUsd.toFixed(4)}`);
