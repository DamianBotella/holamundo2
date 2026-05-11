import { readFile, writeFile } from 'node:fs/promises';

const N8N_API_URL = 'https://n8n-n8n.zzeluw.easypanel.host';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';

const TARGETS = [
  { path: 'studio-multiagente/workflows/api/api_billing_subscription_status.json',  id: 'gFlcNWjWbIASn52h' },
  { path: 'studio-multiagente/workflows/api/api_billing_checkout_session.json',     id: 'H5DE9FcG6xDR7M3Y' },
  { path: 'studio-multiagente/workflows/api/api_billing_portal_session.json',       id: 'CnnZmAywzVUE5jD5' },
  { path: 'studio-multiagente/workflows/webhook_stripe.json',                       id: 'eBHpiboasXzLzFDV' }
];

for (const t of TARGETS) {
  const old = JSON.parse(await readFile(t.path, 'utf-8'));
  const r = await fetch(`${N8N_API_URL}/api/v1/workflows/${t.id}`, { headers: { 'X-N8N-API-KEY': N8N_API_KEY } });
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
