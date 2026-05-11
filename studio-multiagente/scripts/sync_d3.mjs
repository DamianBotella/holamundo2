import { readFile, writeFile } from 'node:fs/promises';

const N8N_API_URL = 'https://n8n-n8n.zzeluw.easypanel.host';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';

const TARGETS = [
  { path: 'studio-multiagente/workflows/agent_proposal_moodboard.json',           id: '7r3hVOHRaAFreBRy' },
  { path: 'studio-multiagente/workflows/agent_proposal_render.json',              id: '3C0IyRkz48VnFdky' },
  { path: 'studio-multiagente/workflows/api/api_proposal_public_view.json',       id: 'zCGPAolJN3HL19Qi' },
  { path: 'studio-multiagente/workflows/api/api_proposal_public_accept.json',     id: 'OtVoFzIWYwBNWJLX' }
];

for (const t of TARGETS) {
  const old = JSON.parse(await readFile(t.path, 'utf-8'));
  const r = await fetch(`${N8N_API_URL}/api/v1/workflows/${t.id}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  const live = await r.json();
  if (!r.ok) { console.error('FAIL', t.id, live); continue; }
  const merged = {
    name: live.name,
    _description: old._description,
    _status: old._status,
    _n8n_id: t.id,
    nodes: live.nodes,
    connections: live.connections,
    settings: live.settings || { executionOrder: 'v1' },
    pinData: live.pinData || {}
  };
  await writeFile(t.path, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  console.log(`[sync] ${t.path} - ${live.nodes.length} nodes`);
}
