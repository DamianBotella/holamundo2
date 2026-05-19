#!/usr/bin/env node
/**
 * PLAN V1.0 Bloque 1 - fix 2 al workflow agent_proposal_render.
 *
 * Bug: el nodo 'Eval Poll' busca image_url en 9 campos posibles del
 * response de GET /v1/status/{id} pero NO contempla el campo `message`
 * que es el real que devuelve mnml.ai cuando status=success.
 *
 * Respuesta real de mnml.ai cuando termina:
 *   { "status": "success",
 *     "message": ["https://api.mnmlai.dev/api/v1/images/.../MNMLAI_INTERIORAI_00001_.png"],
 *     "seed": 1000 }
 *
 * El Eval Poll busca: output_url, image_url, result_url, url, render_url,
 * imageUrl, outputUrl, output, image, images[], outputs[].
 * NO busca message[]. Por eso is_done queda en false aunque el render exista.
 * El polling sigue hasta poll_count >= 20 -> Mark Failed (timeout_polls).
 *
 * Fix: anadir parseo de r.message[] al Eval Poll.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const N8N = 'https://n8n-n8n.zzeluw.easypanel.host';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';
const ID = '3C0IyRkz48VnFdky';
const headers = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_PATH = path.resolve(__dirname, '..', 'workflows', 'agent_proposal_render.json');

const NEW_EVAL_POLL_JS = `const r = $input.first()?.json || {};
const parsed = $('Parse Submit').first().json;
const status = (r.status || r.state || '').toLowerCase();
const doneStatuses = ['success','succeeded','completed','done','finished'];
const failStatuses = ['failed','error','rejected'];
const possibleUrlFields = ['output_url','image_url','result_url','url','render_url','imageUrl','outputUrl','output','image'];
let imageUrl = null;
for (const f of possibleUrlFields) {
  if (typeof r[f] === 'string' && r[f].startsWith('http')) { imageUrl = r[f]; break; }
}
// mnml.ai devuelve la URL en r.message (array). Parseamos despues de los strings.
if (!imageUrl && Array.isArray(r.message) && r.message.length) {
  const m = r.message[0];
  if (typeof m === 'string' && m.startsWith('http')) imageUrl = m;
  else if (m && typeof m.url === 'string') imageUrl = m.url;
}
if (!imageUrl && Array.isArray(r.images) && r.images.length) {
  const it = r.images[0];
  imageUrl = typeof it === 'string' ? it : (it?.url || it?.image_url || null);
}
if (!imageUrl && Array.isArray(r.outputs) && r.outputs.length) {
  const it = r.outputs[0];
  imageUrl = typeof it === 'string' ? it : (it?.url || it?.image_url || null);
}
const isDone = doneStatuses.includes(status) && !!imageUrl;
const isFail = failStatuses.includes(status);
return [{ json: {
  ...parsed,
  poll_count: (parsed.poll_count || 0) + 1,
  mnml_status: status || 'pending',
  image_url: imageUrl,
  is_done: isDone,
  is_failed: isFail,
  raw_keys: Object.keys(r).slice(0, 12),
  raw_excerpt: JSON.stringify(r).slice(0, 600)
}}];`;

async function main() {
  console.log('[1] GET workflow', ID);
  const r = await fetch(N8N + '/api/v1/workflows/' + ID, { headers });
  if (!r.ok) { console.error('FAIL get', r.status); process.exit(1); }
  const wf = await r.json();
  const evalPoll = wf.nodes.find(n => n.name === 'Eval Poll');
  if (!evalPoll) { console.error('Eval Poll no encontrado'); process.exit(1); }
  evalPoll.parameters.jsCode = NEW_EVAL_POLL_JS;
  console.log('[2] Eval Poll actualizado con parseo de r.message');
  const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings || { executionOrder: 'v1' } };
  const r2 = await fetch(N8N + '/api/v1/workflows/' + ID, { method: 'PUT', headers, body: JSON.stringify(payload) });
  if (!r2.ok) { console.error('FAIL update', r2.status, (await r2.text()).slice(0,500)); process.exit(1); }
  console.log('[3] UPDATED');
  const r3 = await fetch(N8N + '/api/v1/workflows/' + ID + '/activate', { method: 'POST', headers });
  console.log('[4] ACTIVATED active=', (await r3.json()).active);

  // Persistir local
  const local = JSON.parse(await readFile(LOCAL_PATH, 'utf-8'));
  const localEval = local.nodes.find(n => n.name === 'Eval Poll');
  if (localEval) {
    localEval.parameters.jsCode = NEW_EVAL_POLL_JS;
    local._description = (local._description || '') + ' [PATCH 2026-05-19 b: Eval Poll parsea r.message array]';
    await writeFile(LOCAL_PATH, JSON.stringify(local, null, 2), 'utf-8');
    console.log('[5] JSON local actualizado');
  }
  console.log('\\nOK. Run: node studio-multiagente/scripts/smoke_proposal_render.mjs');
}

main().catch(e => { console.error(e); process.exit(1); });
