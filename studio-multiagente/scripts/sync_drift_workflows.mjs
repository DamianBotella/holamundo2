// Identifica workflows activos en n8n live que NO existen en disco y los descarga.
// Para cada workflow nuevo:
//   - sanitiza el JSON (quita id, versionId, settings_internal, etc)
//   - guarda en workflows/<name>.json o workflows/api/<name>.json (segun nombre)
//   - imprime resumen
import { readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const N8N_API_URL = 'https://n8n-n8n.zzeluw.easypanel.host';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';
const H = { 'X-N8N-API-KEY': N8N_API_KEY };

const ROOT = 'studio-multiagente/workflows';
const API_DIR = ROOT + '/api';

async function listAllActive() {
  const out = [];
  let cursor = null;
  do {
    const url = `${N8N_API_URL}/api/v1/workflows?limit=100&active=true` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
    const r = await fetch(url, { headers: H });
    const j = await r.json();
    out.push(...(j.data || []));
    cursor = j.nextCursor || null;
  } while (cursor);
  return out;
}

async function listDiskFiles() {
  const root = (await readdir(ROOT, { withFileTypes: true }))
    .filter(d => d.isFile() && d.name.endsWith('.json'))
    .map(d => d.name.replace(/\.json$/, ''));
  const api = (await readdir(API_DIR, { withFileTypes: true }))
    .filter(d => d.isFile() && d.name.endsWith('.json'))
    .map(d => d.name.replace(/\.json$/, ''));
  return new Set([...root, ...api]);
}

async function fetchOne(id) {
  const r = await fetch(`${N8N_API_URL}/api/v1/workflows/${id}`, { headers: H });
  return await r.json();
}

function targetPath(name) {
  // api_* y los proposal_public_* van a workflows/api/, los demás a workflows/
  if (name.startsWith('api_') || name.startsWith('util_jwt_verify')) return `${API_DIR}/${name}.json`;
  return `${ROOT}/${name}.json`;
}

function isValidName(name) {
  // Saltar workflows temporales/test que NO queremos versionar
  const skip = [
    /^_TEMP_/i,
    /^test_/i,
    /^METEORIHUELA$/i,
    /^SUB-WORKFLOW AEMET$/i,
    /^Agente Icebreaker/i,
    /^orquestador arqui$/i,
    /\//,
    /\\/
  ];
  return !skip.some(re => re.test(name));
}

function sanitize(live) {
  return {
    name: live.name,
    _description: live.description || undefined,
    _n8n_id: live.id,
    nodes: live.nodes,
    connections: live.connections,
    settings: live.settings || { executionOrder: 'v1' },
    pinData: live.pinData || {}
  };
}

const liveActive = await listAllActive();
const diskNames = await listDiskFiles();
const missing = liveActive.filter(w => isValidName(w.name) && !diskNames.has(w.name));

console.log(`live active: ${liveActive.length}`);
console.log(`disk files:  ${diskNames.size}`);
console.log(`missing:     ${missing.length}`);
console.log('');

let saved = 0;
for (const w of missing) {
  const live = await fetchOne(w.id);
  if (!live.nodes) { console.error(`[skip] ${w.name} (${w.id}): no nodes returned`); continue; }
  const p = targetPath(w.name);
  if (existsSync(p)) { console.log(`[exists already] ${p}`); continue; }
  const clean = sanitize(live);
  // Remove undefined keys
  if (!clean._description) delete clean._description;
  await writeFile(p, JSON.stringify(clean, null, 2) + '\n', 'utf-8');
  console.log(`[saved] ${p}  (${live.nodes.length} nodes)`);
  saved++;
}

console.log(`\nDONE. Saved ${saved}/${missing.length}`);
