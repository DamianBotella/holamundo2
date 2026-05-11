import { readFile, writeFile } from 'node:fs/promises';

const N8N_API_URL = 'https://n8n-n8n.zzeluw.easypanel.host';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';

const TARGETS = [
  { path: 'studio-multiagente/workflows/api/api_billing_subscription_status.json',  label: 'status' },
  { path: 'studio-multiagente/workflows/api/api_billing_checkout_session.json',     label: 'checkout' },
  { path: 'studio-multiagente/workflows/api/api_billing_portal_session.json',       label: 'portal' },
  { path: 'studio-multiagente/workflows/webhook_stripe.json',                       label: 'webhook' }
];

const H = { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json' };

for (const t of TARGETS) {
  const j = JSON.parse(await readFile(t.path, 'utf-8'));
  const payload = { name: j.name, nodes: j.nodes, connections: j.connections, settings: j.settings || { executionOrder: 'v1' } };
  const r = await fetch(`${N8N_API_URL}/api/v1/workflows`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
  const d = await r.json();
  if (!r.ok) { console.error(`[${t.label}] FAIL`, r.status, JSON.stringify(d, null, 2).slice(0, 600)); continue; }
  const id = d.id;
  console.log(`[${t.label}] CREATED ${id}`);
  const ra = await fetch(`${N8N_API_URL}/api/v1/workflows/${id}/activate`, { method: 'POST', headers: { 'X-N8N-API-KEY': N8N_API_KEY } });
  const da = await ra.json();
  console.log(`[${t.label}] ACTIVE=${da.active}`);
  j._n8n_id = id;
  await writeFile(t.path, JSON.stringify(j, null, 2) + '\n', 'utf-8');
}
