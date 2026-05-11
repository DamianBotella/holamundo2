import { readFile } from 'node:fs/promises';

const N8N_API_URL = 'https://n8n-n8n.zzeluw.easypanel.host';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';

async function main() {
  const json = JSON.parse(await readFile('studio-multiagente/workflows/agent_client_translator.json', 'utf-8'));

  // POST: strip metadata keys
  const payload = {
    name: json.name,
    nodes: json.nodes,
    connections: json.connections,
    settings: json.settings || { executionOrder: 'v1' }
  };

  console.log('[deploy] POST /api/v1/workflows ...');
  const r = await fetch(`${N8N_API_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok) {
    console.error('[deploy] FAILED', r.status, JSON.stringify(data, null, 2));
    process.exit(1);
  }
  const id = data.id;
  console.log('[deploy] CREATED id=', id);

  console.log('[deploy] POST /api/v1/workflows/:id/activate ...');
  const ra = await fetch(`${N8N_API_URL}/api/v1/workflows/${id}/activate`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  const da = await ra.json();
  if (!ra.ok) {
    console.error('[deploy] ACTIVATE FAILED', ra.status, JSON.stringify(da, null, 2));
    process.exit(1);
  }
  console.log('[deploy] ACTIVE=', da.active);
  console.log('[deploy] DONE. id=', id);
}

main().catch(e => { console.error(e); process.exit(1); });
