#!/usr/bin/env node
/**
 * Deploy PLAN V1.0 - 3 endpoints LIST para las paginas de ejecucion (parallel-execution-ui).
 *
 *   GET /api/v1/site-visit-acts
 *   GET /api/v1/project-incidents
 *   GET /api/v1/client-weekly-updates
 *
 * Reemplaza el acceso directo a Supabase desde el navegador (que daba
 * code 22023 "role 'super_admin' does not exist" via PostgREST).
 *
 * Patron estandar: webhook GET -> Decode JWT -> If auth -> Postgres (CTE
 * con set_session_context inline + JOIN projects) -> Format envelope ->
 * Respond 200/401. Gotcha-proof: webhookId UUID manual + alwaysOutputData
 * + CTE para set_session_context (B64).
 *
 * Uso: node studio-multiagente/scripts/deploy_v1_list_endpoints.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const N8N_API_URL = 'https://n8n-n8n.zzeluw.easypanel.host';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const TARGETS = [
  { path: path.join(ROOT, 'workflows', 'api', 'api_site_visit_acts_list.json'),       label: 'api_site_visit_acts_list',       smokePath: 'api/v1/site-visit-acts' },
  { path: path.join(ROOT, 'workflows', 'api', 'api_project_incidents_list.json'),     label: 'api_project_incidents_list',     smokePath: 'api/v1/project-incidents' },
  { path: path.join(ROOT, 'workflows', 'api', 'api_client_weekly_updates_list.json'), label: 'api_client_weekly_updates_list', smokePath: 'api/v1/client-weekly-updates' }
];

const HEADERS = { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' };

async function deployOne(t) {
  const json = JSON.parse(await readFile(t.path, 'utf-8'));

  if (json._n8n_id) {
    // UPDATE existing
    const payload = { name: json.name, nodes: json.nodes, connections: json.connections, settings: { executionOrder: 'v1' } };
    const r = await fetch(`${N8N_API_URL}/api/v1/workflows/${json._n8n_id}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(payload) });
    if (!r.ok) {
      console.error(`[${t.label}] PUT FAIL`, r.status, (await r.text()).slice(0, 1500));
      return null;
    }
    console.log(`[${t.label}] UPDATED id=${json._n8n_id}`);
    // PUT desactiva (gotcha CLAUDE.md 6.8). Reactivar.
    const ra = await fetch(`${N8N_API_URL}/api/v1/workflows/${json._n8n_id}/activate`, { method: 'POST', headers: { 'X-N8N-API-KEY': N8N_API_KEY } });
    const da = await ra.json().catch(() => ({}));
    console.log(`[${t.label}] ACTIVE=${da.active}`);
    return { id: json._n8n_id, active: da.active, mode: 'updated' };
  }

  // CREATE new
  const payload = { name: json.name, nodes: json.nodes, connections: json.connections, settings: { executionOrder: 'v1' } };
  const r = await fetch(`${N8N_API_URL}/api/v1/workflows`, { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
  const data = await r.json();
  if (!r.ok) {
    console.error(`[${t.label}] CREATE FAIL`, r.status, JSON.stringify(data).slice(0, 1500));
    return null;
  }
  console.log(`[${t.label}] CREATED id=${data.id}`);
  const ra = await fetch(`${N8N_API_URL}/api/v1/workflows/${data.id}/activate`, { method: 'POST', headers: { 'X-N8N-API-KEY': N8N_API_KEY } });
  const da = await ra.json().catch(() => ({}));
  console.log(`[${t.label}] ACTIVE=${da.active}`);

  // Persist id en el JSON local
  json._n8n_id = data.id;
  await writeFile(t.path, JSON.stringify(json, null, 2) + '\n', 'utf-8');
  return { id: data.id, active: da.active, mode: 'created' };
}

// Smoke: el endpoint sin JWT debe devolver 401, NO 404. Si da 404 -> webhookId manual no funciono.
async function smokeOne(t) {
  try {
    const r = await fetch(`${N8N_API_URL}/webhook/${t.smokePath}`, { method: 'GET' });
    const code = r.status;
    const expected = code === 401 ? 'OK' : (code === 404 ? 'FAIL_404_NO_WEBHOOK' : `WARN_${code}`);
    console.log(`[${t.label}] smoke ${t.smokePath} -> ${code} ${expected}`);
    return code;
  } catch (e) {
    console.error(`[${t.label}] smoke fetch error`, e.message);
    return null;
  }
}

const results = {};
for (const t of TARGETS) results[t.label] = await deployOne(t);

console.log('\n=== SMOKE (sin JWT, esperar 401 no 404) ===');
for (const t of TARGETS) {
  if (results[t.label]) await smokeOne(t);
}

console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(results, null, 2));
