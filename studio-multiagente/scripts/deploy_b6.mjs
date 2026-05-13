#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const N8N = 'https://n8n-n8n.zzeluw.easypanel.host';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PATH = path.resolve(__dirname, '..', 'workflows', 'api', 'api_regulatory_ask.json');

const headers = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };

async function main() {
  const j = JSON.parse(await readFile(PATH, 'utf-8'));
  const payload = { name: j.name, nodes: j.nodes, connections: j.connections, settings: j.settings || { executionOrder: 'v1' } };
  let id = j._n8n_id;

  if (id) {
    console.log(`[deploy] PUT /api/v1/workflows/${id}`);
    const r = await fetch(`${N8N}/api/v1/workflows/${id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) { console.error('FAIL update', r.status, JSON.stringify(d).slice(0, 1000)); process.exit(1); }
    console.log('[deploy] UPDATED', d.id);
  } else {
    console.log('[deploy] POST /api/v1/workflows');
    const r = await fetch(`${N8N}/api/v1/workflows`, { method: 'POST', headers, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) { console.error('FAIL create', r.status, JSON.stringify(d).slice(0, 1500)); process.exit(1); }
    id = d.id;
    console.log('[deploy] CREATED', id);
    j._n8n_id = id;
    await writeFile(PATH, JSON.stringify(j, null, 2), 'utf-8');
  }

  const ra = await fetch(`${N8N}/api/v1/workflows/${id}/activate`, { method: 'POST', headers });
  const da = await ra.json();
  if (!ra.ok) { console.error('FAIL activate', ra.status, JSON.stringify(da)); process.exit(1); }
  console.log('[deploy] ACTIVATED active=', da.active);
  console.log(`\nWebhook: ${N8N}/webhook/api/v1/regulatory/ask`);
}

main().catch(e => { console.error(e); process.exit(1); });
