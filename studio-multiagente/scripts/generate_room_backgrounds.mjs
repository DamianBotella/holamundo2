#!/usr/bin/env node
/**
 * ADDENDUM 2 Bloque 1 — generacion de fondos isometricos de habitaciones
 * via Gemini 2.5 flash image.
 *
 * Uso:
 *   GEMINI_API_KEY=AIza... node studio-multiagente/scripts/generate_room_backgrounds.mjs
 *
 * Flags:
 *   --placeholder-only   Salta Gemini y genera placeholders solidos de color suelo
 *                        (utilidad para no bloquear los Bloques 2-7 si Gemini esta caido).
 *   --only=reception     Genera solo una habitacion (acepta lista separada por coma).
 *   --force              Sobreescribe PNGs ya existentes.
 *
 * Salida: foxhole-ui/src/studio/assets/rooms/{room_id}_bg.png
 *
 * Plan B (Damian OK): si Gemini falla para una habitacion concreta, el script
 * genera un placeholder PNG de 16x16 con el color de su suelo (mig 056) en lugar
 * de abortar todo el lote. Los Bloques 2-7 pueden continuar sin bloqueo.
 *
 * Modelo: gemini-2.5-flash-image (alias "Nano Banana"). Si Google renombra,
 * editar GEMINI_MODEL en linea 23.
 */

import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { constants as FS_CONST } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GEMINI_MODEL = 'gemini-2.5-flash-image';
const GEMINI_ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.resolve(__dirname, '..', 'foxhole-ui', 'src', 'studio', 'assets', 'rooms');

// ============================================================
// Prompts isometricos por habitacion (layout v7 mig 056).
// Estilo coherente: "isometric cutaway architectural illustration",
// 2:1 isometric, warm cozy lighting, soft shadows, no people.
// ============================================================
const ROOM_PROMPTS = {
  reception: 'Isometric cutaway architectural illustration of a reception area inside a small modern architecture studio. Cozy warm tones (beige walls, oak wood floor), wooden reception desk with a laptop and a small plant, two leather guest armchairs, a folding portfolio on a side table, soft daylight from a high window. 2:1 isometric perspective, top-left light source, no people, no text. Painterly digital art, warm beige #3F3227 floor tone, transparent background.',
  drawing_room: 'Isometric cutaway architectural illustration of an architectural drawing studio room. Large drafting table with rolled blueprints and rulers, two adjustable architect lamps, a corkboard pinned with sketches, oak wood floor #3D3628. Warm afternoon light from a tall side window. 2:1 isometric, no people, painterly digital art, no text.',
  normative_library: 'Isometric cutaway architectural illustration of an architectural reference library. Floor-to-ceiling oak bookcases stacked with CTE, PGOU code volumes and binders, a reading lectern with an open book, a small ladder. Warm focused light, dark wood floor #352E25, scholarly atmosphere. 2:1 isometric, no people, no text, painterly digital art.',
  accounting_office: 'Isometric cutaway architectural illustration of a small accounting office. A modern wooden desk with a laptop displaying spreadsheets, a calculator, a folder labeled "BUDGET", a coffee mug, a filing cabinet on the side. Soft cool morning light, wooden floor #3D3628. 2:1 isometric, no people, no text, painterly digital art.',
  main_office: 'Isometric cutaway architectural illustration of an architecture firm director office. Large solid oak desk facing the viewer, a high-back leather chair, framed architecture certificates on the wall, a small bonsai, a green banker lamp. Warm authoritative atmosphere, oak floor #3A3530. 2:1 isometric, no people, no text, painterly digital art.',
  meeting_room: 'Isometric cutaway architectural illustration of a modern meeting room. Long oak conference table with six matching chairs, a projector screen on the far wall, glasses of water at each seat, soft pendant lighting, oak floor #3A3530. 2:1 isometric, no people, no text, painterly digital art.',
  site_terrace: 'Isometric cutaway architectural illustration of a rooftop technical inspection terrace at an architecture studio. Concrete floor with sage tint #3A4030, a few stacked safety helmets and a clipboard on a small metal table, a folded ladder, a folded blueprint roll, a green plant. Daylight, no people, no text, 2:1 isometric, painterly digital art.',
  trades_workshop: 'Isometric cutaway architectural illustration of an architecture workshop and trades coordination room. Wooden workbench with samples of tiles, paint chips and material swatches arranged neatly, hanging tools, oak floor #3D3628, warm work-light. 2:1 isometric, no people, no text, painterly digital art.',
  archive: 'Isometric cutaway architectural illustration of an architectural project archive room. Rows of labeled flat-file cabinets full of plans, rolled drawings, a small index desk with a desk lamp, dark wood floor #352E25, quiet focused atmosphere. 2:1 isometric, no people, no text, painterly digital art.',
  urgency_corridor: 'Isometric cutaway architectural illustration of a long monitoring corridor at an architecture studio for alerts and urgent matters. Two large wall-mounted screens showing dashboards, a small standing desk with a tablet, warm-amber accent lighting, brick-red floor #3A2520, urgent but professional atmosphere. 2:1 isometric, no people, no text, painterly digital art.',
};

// Color de suelo (mig 056) para placeholder si Gemini falla
const FLOOR_COLOR = {
  reception:         '#3F3227',
  drawing_room:      '#3D3628',
  normative_library: '#352E25',
  accounting_office: '#3D3628',
  main_office:       '#3A3530',
  meeting_room:      '#3A3530',
  site_terrace:      '#3A4030',
  trades_workshop:   '#3D3628',
  archive:           '#352E25',
  urgency_corridor:  '#3A2520',
};

// ============================================================
// PNG minimal encoder (sin deps) — para placeholder solido.
// ============================================================
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function pngSolidColor(hexColor, w = 16, h = 16) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8]  = 8;   // bit depth
  ihdr[9]  = 2;   // color type: RGB
  ihdr[10] = 0;   // compression
  ihdr[11] = 0;   // filter
  ihdr[12] = 0;   // interlace
  // raw image data: cada fila = 1 byte filter (0) + w * 3 bytes RGB
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) {
    row[1 + x * 3 + 0] = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw = Buffer.alloc(h * row.length);
  for (let y = 0; y < h; y++) row.copy(raw, y * row.length);
  const idat = deflateSync(raw);  // zlib stream (PNG necesita header zlib)
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ============================================================
// Gemini call
// ============================================================
async function callGemini(roomId, prompt, apiKey) {
  const res = await fetch(GEMINI_ENDPOINT(GEMINI_MODEL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status} ${roomId}: ${errBody.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const inline = parts.find((p) => p.inlineData?.data);
  if (!inline?.inlineData?.data) {
    throw new Error(`Gemini no devolvio imagen para ${roomId}`);
  }
  return Buffer.from(inline.inlineData.data, 'base64');
}

// ============================================================
// Main
// ============================================================
async function fileExists(p) {
  try { await access(p, FS_CONST.F_OK); return true; } catch { return false; }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const placeholderOnly = args.has('--placeholder-only');
  const force = args.has('--force');
  const onlyFlag = [...args].find((a) => a.startsWith('--only='));
  const onlyRooms = onlyFlag ? onlyFlag.replace('--only=', '').split(',') : null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!placeholderOnly && !apiKey) {
    console.error('[generate_room_backgrounds] ERROR: GEMINI_API_KEY no esta definida.');
    console.error('  Define la variable o pasa --placeholder-only para generar solo solidos.');
    process.exit(2);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const rooms = Object.keys(ROOM_PROMPTS).filter((r) => !onlyRooms || onlyRooms.includes(r));
  const summary = { ok: [], placeholder: [], skipped: [], failed: [] };

  for (const roomId of rooms) {
    const outPath = path.join(OUT_DIR, `${roomId}_bg.png`);

    if (!force && (await fileExists(outPath))) {
      console.log(`[skip] ${roomId} ya existe (usa --force para regenerar)`);
      summary.skipped.push(roomId);
      continue;
    }

    if (placeholderOnly) {
      const png = pngSolidColor(FLOOR_COLOR[roomId]);
      await writeFile(outPath, png);
      console.log(`[placeholder] ${roomId} -> ${outPath} (${png.length}b)`);
      summary.placeholder.push(roomId);
      continue;
    }

    try {
      const png = await callGemini(roomId, ROOM_PROMPTS[roomId], apiKey);
      await writeFile(outPath, png);
      console.log(`[ok] ${roomId} -> ${outPath} (${(png.length / 1024).toFixed(1)} KB)`);
      summary.ok.push(roomId);
      // Rate-limit defensivo Gemini (~1 req/sec)
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err) {
      console.error(`[gemini-fail] ${roomId}: ${err.message}`);
      console.error(`  -> escribiendo placeholder solido en su lugar`);
      try {
        const png = pngSolidColor(FLOOR_COLOR[roomId]);
        await writeFile(outPath, png);
        summary.placeholder.push(roomId);
      } catch (writeErr) {
        console.error(`[fatal] no se pudo escribir placeholder ${roomId}: ${writeErr.message}`);
        summary.failed.push(roomId);
      }
    }
  }

  console.log('\n=========================');
  console.log('Resumen generate_room_backgrounds:');
  console.log(`  OK Gemini    : ${summary.ok.length}  ${summary.ok.join(', ')}`);
  console.log(`  Placeholder  : ${summary.placeholder.length}  ${summary.placeholder.join(', ')}`);
  console.log(`  Skipped      : ${summary.skipped.length}  ${summary.skipped.join(', ')}`);
  console.log(`  Failed       : ${summary.failed.length}  ${summary.failed.join(', ')}`);
  console.log('=========================');

  if (summary.failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
