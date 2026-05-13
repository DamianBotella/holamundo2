#!/usr/bin/env node
/**
 * ADDENDUM 2 Bloque 5 - deploy agent_normativa_fetch a n8n live.
 *
 * Idempotente: si el workflow ya existe (_n8n_id presente), hace PUT update
 * + reactivate. Si no, POST create + activate.
 *
 * Uso: node studio-multiagente/scripts/deploy_b5.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const N8N_API_URL = 'https://n8n-n8n.zzeluw.easypanel.host';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PATH = path.resolve(__dirname, '..', 'workflows', 'agent_normativa_fetch.json');

const headers = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json',
};

async function main() {
  const json = JSON.parse(await readFile(PATH, 'utf-8'));
  const existingId = json._n8n_id || null;

  const payload = {
    name: json.name,
    nodes: json.nodes,
    connections: json.connections,
    settings: json.settings || { executionOrder: 'v1' },
  };

  let workflowId;
  if (existingId) {
    console.log(`[deploy] PUT /api/v1/workflows/${existingId} (update)`);
    const r = await fetch(`${N8N_API_URL}/api/v1/workflows/${existingId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) {
      console.error('FAIL update', r.status, JSON.stringify(d, null, 2).slice(0, 1000));
      process.exit(1);
    }
    console.log('[deploy] UPDATED id=', d.id);
    workflowId = d.id;
  } else {
    console.log('[deploy] POST /api/v1/workflows (create)');
    const r = await fetch(`${N8N_API_URL}/api/v1/workflows`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) {
      console.error('FAIL create', r.status, JSON.stringify(d, null, 2).slice(0, 1500));
      process.exit(1);
    }
    console.log('[deploy] CREATED id=', d.id);
    workflowId = d.id;

    // Persistir el id en el JSON local
    json._n8n_id = workflowId;
    await writeFile(PATH, JSON.stringify(json, null, 2), 'utf-8');
    console.log(`[deploy] _n8n_id persistido en ${PATH}`);
  }

  // Activar (PUT desactiva el workflow, asi que activar siempre)
  console.log(`[deploy] POST /api/v1/workflows/${workflowId}/activate`);
  const ra = await fetch(`${N8N_API_URL}/api/v1/workflows/${workflowId}/activate`, {
    method: 'POST',
    headers,
  });
  const da = await ra.json();
  if (!ra.ok) {
    console.error('FAIL activate', ra.status, JSON.stringify(da, null, 2).slice(0, 500));
    process.exit(1);
  }
  console.log('[deploy] ACTIVATED id=', workflowId, 'active=', da.active);
  console.log('\n=== Deploy OK ===');
  console.log(`Webhook: ${N8N_API_URL}/webhook/api/v1/agents/normativa-fetch/run`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
