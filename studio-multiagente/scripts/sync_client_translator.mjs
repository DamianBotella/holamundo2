import { readFile, writeFile } from 'node:fs/promises';

const N8N_API_URL = 'https://n8n-n8n.zzeluw.easypanel.host';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';
const ID = 'Nr3Bk2x73bXrq98u';
const PATH = 'studio-multiagente/workflows/agent_client_translator.json';

const old = JSON.parse(await readFile(PATH, 'utf-8'));

const r = await fetch(`${N8N_API_URL}/api/v1/workflows/${ID}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});
const live = await r.json();
if (!r.ok) { console.error('FAIL', live); process.exit(1); }

const merged = {
  name: live.name,
  _description: old._description,
  _status: old._status,
  _n8n_id: ID,
  nodes: live.nodes,
  connections: live.connections,
  settings: live.settings || { executionOrder: 'v1' },
  pinData: live.pinData || {}
};

await writeFile(PATH, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
console.log(`[sync] OK - ${live.nodes.length} nodes written`);
