#!/usr/bin/env node
/**
 * PLAN V1.0 Bloque 8 - Deploy de los 3 workflows agent_client_update.
 * Crea + activa + persiste _n8n_id en el JSON local.
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
  { path: path.join(ROOT, 'workflows', 'agent_client_update.json'),                     label: 'agent_client_update' },
  { path: path.join(ROOT, 'workflows', 'api', 'api_client_updates_approve.json'),       label: 'api_client_updates_approve' },
  { path: path.join(ROOT, 'workflows', 'cron_client_update_weekly.json'),               label: 'cron_client_update_weekly' }
];

const HEADERS = { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' };

async function deployOne(t) {
  const json = JSON.parse(await readFile(t.path, 'utf-8'));

  // Si ya tiene _n8n_id, actualiza via PUT
  if (json._n8n_id) {
    const payload = {
      name: json.name,
      nodes: json.nodes,
      connections: json.connections,
      settings: json.settings && Object.keys(json.settings).length ? { executionOrder: json.settings.executionOrder || 'v1' } : { executionOrder: 'v1' }
    };
    const r = await fetch(`${N8N_API_URL}/api/v1/workflows/${json._n8n_id}`, {
      method: 'PUT', headers: HEADERS, body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const t1 = await r.text();
      console.error(`[${t.label}] PUT FAIL`, r.status, t1.slice(0, 1500));
      return null;
    }
    console.log(`[${t.label}] UPDATED id=${json._n8n_id}`);
    const ra = await fetch(`${N8N_API_URL}/api/v1/workflows/${json._n8n_id}/activate`, {
      method: 'POST', headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    });
    const da = await ra.json();
    console.log(`[${t.label}] ACTIVE=${da.active}`);
    return { id: json._n8n_id, active: da.active, mode: 'updated' };
  }

  // Si no, crea
  const payload = {
    name: json.name,
    nodes: json.nodes,
    connections: json.connections,
    settings: { executionOrder: 'v1' }
  };
  const r = await fetch(`${N8N_API_URL}/api/v1/workflows`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok) {
    console.error(`[${t.label}] CREATE FAIL`, r.status, JSON.stringify(data).slice(0, 1500));
    return null;
  }
  const id = data.id;
  console.log(`[${t.label}] CREATED id=${id}`);

  const ra = await fetch(`${N8N_API_URL}/api/v1/workflows/${id}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  const da = await ra.json();
  console.log(`[${t.label}] ACTIVE=${da.active}`);

  json._n8n_id = id;
  await writeFile(t.path, JSON.stringify(json, null, 2) + '\n', 'utf-8');
  return { id, active: da.active, mode: 'created' };
}

const results = {};
for (const t of TARGETS) {
  results[t.label] = await deployOne(t);
}

console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(results, null, 2));
