#!/usr/bin/env node
/**
 * PLAN V1.0 Bloque 1 - fix bug D.3 en agent_proposal_render.
 *
 * Bug: el workflow envia image_url como form field, pero mnml.ai requiere
 * multipart con file en campo 'image'. Diagnostico confirmado via curl
 * directo (image_url -> 400, image=@file -> 200 con id).
 *
 * Fix:
 *  1. Anadir nodo HTTP Request "Download Source Image" (GET con
 *     responseFormat=file) entre "Prep OK?" branch true y "Submit MNML".
 *  2. Modificar "Submit MNML (URL form)" para usar formBinaryData en lugar
 *     de form field image_url. Renombrar a "Submit MNML (file)".
 *  3. Ajustar conexiones: Prep OK true -> Start Execution -> Download
 *     Source Image -> Submit MNML.
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

async function main() {
  console.log('[1] GET workflow', ID);
  const r = await fetch(N8N + '/api/v1/workflows/' + ID, { headers });
  if (!r.ok) { console.error('FAIL get', r.status, await r.text()); process.exit(1); }
  const wf = await r.json();
  console.log('   nodes:', wf.nodes.length);

  // Backup pre-fix
  const backupPath = LOCAL_PATH.replace('.json', '.backup-pre-bloque1-fix.json');
  await writeFile(backupPath, JSON.stringify(wf, null, 2), 'utf-8');
  console.log('[2] backup ->', backupPath);

  // Encontrar "Submit MNML (URL form)" para conocer su posicion y conexiones
  const submitOld = wf.nodes.find(n => n.name === 'Submit MNML (URL form)');
  if (!submitOld) { console.error('FAIL: Submit MNML (URL form) no existe'); process.exit(1); }
  const [oldX, oldY] = submitOld.position;

  // Nuevo nodo: Download Source Image (HTTP Request GET binary)
  const downloadNode = {
    parameters: {
      method: 'GET',
      url: "={{ $('Prepare MNML Request').first().json.source_image_url }}",
      options: {
        response: { response: { responseFormat: 'file', outputPropertyName: 'data' } },
        timeout: 20000,
      },
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [oldX - 240, oldY],
    id: 'rd-download-image',
    name: 'Download Source Image',
    onError: 'continueRegularOutput',
  };

  // Modificar Submit MNML para usar multipart con binary
  submitOld.name = 'Submit MNML (file)';
  submitOld.parameters = {
    method: 'POST',
    url: 'https://api.mnmlai.dev/v1/interior',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        {
          name: 'Authorization',
          value: "=Bearer {{ $('Prepare MNML Request').first().json.mnml_api_key }}",
        },
      ],
    },
    sendBody: true,
    contentType: 'multipart-form-data',
    bodyParameters: {
      parameters: [
        {
          parameterType: 'formBinaryData',
          name: 'image',
          inputDataFieldName: 'data',
        },
        { name: 'prompt',      value: "={{ $('Prepare MNML Request').first().json.prompt }}" },
        { name: 'imageType',   value: "={{ $('Prepare MNML Request').first().json.image_type }}" },
        { name: 'scenario',    value: "={{ $('Prepare MNML Request').first().json.scenario }}" },
        { name: 'styles',      value: "={{ $('Prepare MNML Request').first().json.style }}" },
        { name: 'renderspeed', value: "={{ $('Prepare MNML Request').first().json.renderspeed }}" },
      ],
    },
    options: { timeout: 60000 },
  };

  // Insertar el nuevo nodo en el array
  wf.nodes.push(downloadNode);

  // Conexiones: encontrar la conexion vieja "Start Execution" -> "Submit MNML (URL form)"
  // y sustituir por "Start Execution" -> "Download Source Image" -> "Submit MNML (file)"
  // (Reescribimos las claves que apuntaban al nombre viejo)
  const conns = wf.connections;
  // Renombrar la clave saliente
  if (conns['Submit MNML (URL form)']) {
    conns['Submit MNML (file)'] = conns['Submit MNML (URL form)'];
    delete conns['Submit MNML (URL form)'];
  }
  // Buscar nodo que conecta hacia Submit MNML (URL form) y redirigirlo al Download
  for (const [src, edges] of Object.entries(conns)) {
    for (const branch of (edges.main || [])) {
      for (const c of branch) {
        if (c.node === 'Submit MNML (URL form)') {
          c.node = 'Download Source Image';
        }
      }
    }
  }
  // Conectar Download Source Image -> Submit MNML (file)
  conns['Download Source Image'] = {
    main: [[{ node: 'Submit MNML (file)', type: 'main', index: 0 }]],
  };

  // PUT update
  const payload = { name: wf.name, nodes: wf.nodes, connections: conns, settings: wf.settings || { executionOrder: 'v1' } };
  console.log('[3] PUT workflow with', wf.nodes.length, 'nodes');
  let r2 = await fetch(N8N + '/api/v1/workflows/' + ID, { method: 'PUT', headers, body: JSON.stringify(payload) });
  if (!r2.ok) { console.error('FAIL update', r2.status, (await r2.text()).slice(0, 1500)); process.exit(1); }
  console.log('   UPDATED');

  // Reactivar
  let r3 = await fetch(N8N + '/api/v1/workflows/' + ID + '/activate', { method: 'POST', headers });
  console.log('[4] ACTIVATED active=', (await r3.json()).active);

  // Persistir JSON local
  const localWf = JSON.parse(await readFile(LOCAL_PATH, 'utf-8'));
  localWf.nodes = wf.nodes;
  localWf.connections = conns;
  localWf._description = (localWf._description || '') + ' [PATCH 2026-05-19: multipart con file via Download Source Image]';
  await writeFile(LOCAL_PATH, JSON.stringify(localWf, null, 2), 'utf-8');
  console.log('[5] JSON local actualizado');
  console.log('\nOK. Run: node studio-multiagente/scripts/smoke_proposal_render.mjs');
}

main().catch(e => { console.error(e); process.exit(1); });
