// Script para generar los 35 sprites de agentes con PixelLab.ai.
//
// Ejecutar:
//   PIXELLAB_API_KEY="..." node scripts/generate_pixellab_sprites.mjs [--only sprite_id]
//
// Genera PNG 48x64 transparente isometrico para cada agente, los guarda en
// foxhole-ui/src/studio/assets/sprites/{sprite_id}.png y reporta progreso.
//
// La API key se lee del entorno (NO se commitea). 1.5s de pausa entre llamadas
// para evitar rate-limit. Si una llamada falla, sigue con la siguiente.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = path.resolve(__dirname, '../foxhole-ui/src/studio/assets/sprites');

const API_KEY = process.env.PIXELLAB_API_KEY;
if (!API_KEY) {
  console.error('Falta PIXELLAB_API_KEY en el entorno.');
  process.exit(1);
}

// Prompts segun X7_CAMBIO_TEMATICA_VISUAL.pdf (sec 3): estudio de arquitectura
// tecnica profesional, NO militar. Cada agente reconocible por funcion solo con
// verlo. Paleta calida (navy blue, white, beige, naranja casco constructor).
const PROMPT_BASE =
  'top-down isometric pixel art character, 48x64 pixels, transparent background, ' +
  'spanish architecture studio professional, civilian office worker, ' +
  'warm professional colors palette (navy blue, white, beige, brown), ' +
  'painterly outline, single full-body figure standing centered, ' +
  'no military uniform, no soldier elements, no weapons, no combat gear, ' +
  'no construction helmet unless explicitly mentioned in role, ' +
  'profession clearly identifiable by clothing and tools, ';

const SPRITES = [
  // Tier 1 — caracteres clave del estudio
  ['director_v1',                  'distinguished senior architect office boss, elegant dark navy three-piece business suit with white dress shirt and tie, silver grey hair styled back, holding large rolled blueprint scroll under one arm, authoritative confident posture, leather dress shoes, bare head no hat'],
  ['receptionist_v1',              'architecture office receptionist, professional white blouse and beige skirt, holding notepad and pen, headset on ear, standing at modern reception desk'],
  ['drafter_v1',                   'young architect drafter, white shirt with rolled-up sleeves, pencil behind ear, holding T-square and drafting tools, working posture at drawing desk'],
  ['accountant_v1',                'office accountant in white shirt and navy vest, reading glasses, holding calculator and budget spreadsheet papers'],
  ['normative_v1',                 'technical specialist in grey suit with reading glasses, holding thick CTE technical regulations book under arm, formal posture'],
  // Tier 2 — operativos de obra (construccion civil)
  ['foreman_v1',                   'construction foreman, yellow hard hat, orange high-visibility vest over white shirt, holding rolled construction blueprints, walkie-talkie on belt'],
  ['site_inspector_v1',            'site inspector on terrace, white hard hat, hi-vis vest over shirt, binoculars around neck, clipboard in hand, no military elements'],
  ['archivist_v1',                 'office archivist with neat appearance, beige cardigan over white shirt, holding labeled manila folder, neutral civilian office attire'],
  ['safety_v1',                    'construction safety officer, white hard hat, yellow hi-vis vest, holding safety inspection checklist, civilian PRL technician'],
  ['tramitador_v1',                'civilian government administrator in navy blue suit and tie, holding official ink stamp and document folder, glasses, bureaucratic professional'],
  // Tier 3 — RECEPCION
  ['agent_client_concierge_v1',    'client account executive in light grey business suit, holding tablet, attentive listening posture, friendly professional'],
  // MESA DIBUJO
  ['agent_sketch_to_scale_v1',     'technical drawing specialist with set square and triangle ruler, white shirt and tie, blueprints on table behind, civilian draftsman'],
  // BIBLIOTECA NORMATIVA
  ['agent_normativa_refresh_v1',   'technical updater with open laptop showing notification, navy shirt, holding pen, alert posture'],
  ['agent_accessibility_v1',       'accessibility auditor in beige work attire, holding measuring tape and technical specifications card, no helmet'],
  // CONTABLE (DESPACHO)
  ['agent_financial_tracker_v1',   'financial analyst with tablet showing graphs and bar charts, navy suit, holding paper invoices, business professional'],
  ['agent_anomaly_detector_v1',    'serious fraud inspector in dark suit with magnifying glass examining red-marked documents, civilian auditor not detective'],
  // SALA DE REUNIONES
  ['agent_proposal_v1',            'sales executive in well-tailored navy business suit, holding leather proposal folder, confident professional posture'],
  ['agent_contracts_v1',           'civilian lawyer in formal dark business suit with white shirt and tie, holding contract papers and fountain pen, professional not robed'],
  ['agent_collab_coordinator_v1',  'project coordinator in business casual attire holding gantt chart printout and mobile phone, coordinating gesture'],
  ['agent_planner_v1',             'project planner in navy shirt with sleeve garters, holding gantt chart and pencil, planning board with sticky notes behind'],
  // TERRAZA
  ['agent_qc_checklists_v1',       'quality control technician with clipboard checklist, white hard hat and bubble level, civilian construction inspector'],
  // TALLER GREMIOS
  ['agent_trade_comms_v1',         'subcontractor coordinator in navy shirt holding walkie-talkie and contact list folder, civilian site coordinator'],
  ['agent_materials_v1',           'materials specialist holding ceramic tile samples and material catalog, beige work shirt, building supplier professional'],
  ['agent_home_automation_v1',     'electronic systems technician in navy work shirt with tablet showing wiring diagram and electrical tools, civilian electrician'],
  // ARCHIVO
  ['agent_documents_v1',           'documentation specialist with large-format plotter printer behind, holding stack of documents and rolls of plans, white shirt'],
  ['agent_certificate_generator_v1','certifying technician in formal navy suit holding official embossing seal and signed certificate, civilian notary professional'],
  ['agent_energy_assessor_v1',     'energy efficiency specialist with thermometer device and energy rating card, miniature solar panel beside, green vest'],
  ['util_interop_bc3_v1',          'data interop technician with retro computer monitor showing BC3 file format printout, civilian office tech worker'],
  // CORREDOR DE URGENCIAS
  ['agent_aftercare_v1',           'after-sales technician with professional camera and incident report card, beige work shirt, customer service maintenance'],
  ['agent_compliance_audit_v1',    'rigorous auditor in formal dark grey three-piece suit with verification checklist and audit stamp, civilian regulator'],
  ['agent_pathology_v1',           'building pathology inspector with magnifying glass, professional camera and damage report card, white shirt, scientific civilian'],
  ['agent_grants_finder_v1',       'EU grants specialist holding european union forms and aid calculator, navy jacket with EU flag pin, civilian researcher'],
  ['agent_rcd_v1',                 'environmental waste technician with white hard hat, RCD waste form and miniature recycling bin, green vest, civilian'],
  ['agent_iee_v1',                 'building condition inspector with IEE form clipboard, professional camera and white hard hat, civilian assessor'],
  ['agent_telematic_filing_v1',    'electronic administration specialist with open laptop showing digital certificate icon, navy shirt, civilian e-government clerk'],
  // Generic fallback
  ['generic_v1',                   'neutral architecture office worker in beige business attire, professional civilian standing pose'],
];

async function generateOne(spriteId, rolePrompt) {
  const description = PROMPT_BASE + rolePrompt;
  const body = {
    description,
    image_size: { width: 48, height: 64 },
    no_background: true,
    isometric: true,
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
  const outPath = path.join(SPRITES_DIR, `${spriteId}.png`);
  fs.writeFileSync(outPath, buf);
  return { bytes: buf.length, usage: json.usage };
}

const onlyArgIdx = process.argv.indexOf('--only');
const onlyId = onlyArgIdx >= 0 ? process.argv[onlyArgIdx + 1] : null;

// --skip id1,id2,id3 (csv) para excluir sprites ya validados
const skipArgIdx = process.argv.indexOf('--skip');
const skipIds = skipArgIdx >= 0
  ? process.argv[skipArgIdx + 1].split(',').map((s) => s.trim())
  : [];

let list = onlyId ? SPRITES.filter(([id]) => id === onlyId) : SPRITES;
if (skipIds.length > 0) {
  list = list.filter(([id]) => !skipIds.includes(id));
  console.log(`Skipping ${skipIds.length}: ${skipIds.join(', ')}`);
}
console.log(`Generating ${list.length} sprite(s)...`);
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
  // Pausa entre llamadas (excepto la ultima)
  if (i < list.length - 1) {
    await new Promise((r) => setTimeout(r, 1500));
  }
}
console.log(`\nDone. Total cost: $${totalUsd.toFixed(4)}`);
