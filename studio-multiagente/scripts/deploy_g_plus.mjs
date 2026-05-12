import { readFile, writeFile } from 'node:fs/promises';

const N8N_API_URL = 'https://n8n-n8n.zzeluw.easypanel.host';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';

const PATH = 'studio-multiagente/workflows/cron_trial_expiry_alert.json';
const j = JSON.parse(await readFile(PATH, 'utf-8'));
const payload = { name: j.name, nodes: j.nodes, connections: j.connections, settings: j.settings || { executionOrder: 'v1' } };
const r = await fetch(`${N8N_API_URL}/api/v1/workflows`, { method: 'POST', headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
const d = await r.json();
if (!r.ok) { console.error('FAIL', r.status, JSON.stringify(d, null, 2)); process.exit(1); }
console.log('CREATED id=', d.id);
const ra = await fetch(`${N8N_API_URL}/api/v1/workflows/${d.id}/activate`, { method: 'POST', headers: { 'X-N8N-API-KEY': N8N_API_KEY } });
const da = await ra.json();
console.log('ACTIVE=', da.active);
j._n8n_id = d.id;
await writeFile(PATH, JSON.stringify(j, null, 2) + '\n', 'utf-8');
