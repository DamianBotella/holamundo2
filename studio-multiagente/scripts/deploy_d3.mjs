import { readFile, writeFile } from 'node:fs/promises';

const N8N_API_URL = 'https://n8n-n8n.zzeluw.easypanel.host';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';

const TARGETS = [
  { path: 'studio-multiagente/workflows/agent_proposal_moodboard.json',           label: 'moodboard' },
  { path: 'studio-multiagente/workflows/agent_proposal_render.json',              label: 'render' },
  { path: 'studio-multiagente/workflows/api/api_proposal_public_view.json',       label: 'public_view' },
  { path: 'studio-multiagente/workflows/api/api_proposal_public_accept.json',     label: 'public_accept' }
];

const HEADERS = { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' };

async function deployOne(t) {
  const json = JSON.parse(await readFile(t.path, 'utf-8'));
  const payload = {
    name: json.name,
    nodes: json.nodes,
    connections: json.connections,
    settings: json.settings || { executionOrder: 'v1' }
  };
  const r = await fetch(`${N8N_API_URL}/api/v1/workflows`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok) {
    console.error(`[${t.label}] CREATE FAIL`, r.status, JSON.stringify(data, null, 2).slice(0, 800));
    return null;
  }
  const id = data.id;
  console.log(`[${t.label}] CREATED id=${id}`);

  const ra = await fetch(`${N8N_API_URL}/api/v1/workflows/${id}/activate`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  const da = await ra.json();
  if (!ra.ok) {
    console.error(`[${t.label}] ACTIVATE FAIL`, ra.status, JSON.stringify(da, null, 2).slice(0, 800));
    return { id, active: false };
  }
  console.log(`[${t.label}] ACTIVE=${da.active}`);

  // Save id back in the file (_n8n_id)
  json._n8n_id = id;
  await writeFile(t.path, JSON.stringify(json, null, 2) + '\n', 'utf-8');
  return { id, active: da.active };
}

const results = {};
for (const t of TARGETS) {
  results[t.label] = await deployOne(t);
}

console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(results, null, 2));
