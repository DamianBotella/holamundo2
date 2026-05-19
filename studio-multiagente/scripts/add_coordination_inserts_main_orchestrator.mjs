#!/usr/bin/env node
/**
 * PLAN V1.0 Bloque 5 - INSERTs message_type='coordination' en main_orchestrator.
 *
 * Estrategia anti-gotcha #4 (insertar nodos rompe $json refs aguas abajo):
 * Para cada "Run agent_X" (executeWorkflow), anadimos dos nodos Postgres
 * en RAMA PARALELA, no en medio del flujo:
 *   - Coord Before X: predecessor -> Coord Before X (parallel branch)
 *   - Coord After X:  Run agent_X -> Coord After X (parallel branch)
 *
 * Ambos se ejecutan en paralelo al flujo principal SIN tocarlo. Cero riesgo.
 *
 * El INSERT escribe en activity_log:
 *   - message_type='coordination'
 *   - from_agent='main_orchestrator' (antes) / agent_X (despues)
 *   - to_agent='agent_X' (antes) / 'main_orchestrator' (despues)
 *   - action: 'Pidiendo a Y que se encargue de Z' / 'Y termino con Z resultado'
 *
 * Idempotente: si ya existen nodos Coord Before/After, los actualiza
 * (mismo id). Reejecutable sin duplicar.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const N8N = 'https://n8n-n8n.zzeluw.easypanel.host';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';
const WF_ID = 'EF5lPbSNlmA3Upt1';
const headers = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_PATH = path.resolve(__dirname, '..', 'workflows', 'main_orchestrator.json');

// Mapeo nombre nodo -> {agent_name, descripcion humana breve}
const DELEGATIONS = [
  { node: 'Run agent_briefing',           agent_name: 'agent_briefing',     short: 'estructurar el briefing del cliente' },
  { node: 'Run agent_design',             agent_name: 'agent_design',       short: 'proponer opciones de distribucion' },
  { node: 'Run agent_regulatory',         agent_name: 'agent_regulatory',   short: 'revisar la normativa aplicable' },
  { node: 'Run agent_materials',          agent_name: 'agent_materials',    short: 'seleccionar materiales' },
  { node: 'Run agent_costs',              agent_name: 'agent_costs',        short: 'calcular el presupuesto' },
  { node: 'Run agent_documents (diseño)', agent_name: 'agent_documents',    short: 'preparar la documentacion de diseno' },
  { node: 'Run agent_documents (propuesta)', agent_name: 'agent_documents', short: 'preparar la documentacion de propuesta' },
  { node: 'Run agent_trades',             agent_name: 'agent_trades',       short: 'organizar los gremios' },
  { node: 'Run agent_proposal',           agent_name: 'agent_proposal',     short: 'redactar la propuesta comercial' },
  { node: 'Run agent_planner',            agent_name: 'agent_planner',      short: 'planificar la obra' },
  { node: 'Run agent_memory',             agent_name: 'agent_memory',       short: 'archivar el proyecto cerrado' },
];

const POSTGRES_CREDS = { id: 'cfxNZdzy0NB3xkYC', name: 'Postgres account' };

function buildCoordBeforeNode(d, position) {
  return {
    id: 'coord-before-' + d.agent_name.replace(/[^a-z0-9]/g, ''),
    name: 'Coord Before ' + d.agent_name,
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position,
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO activity_log (tenant_id, project_id, agent_name, action, message_type, from_agent, to_agent, status)
SELECT p.tenant_id, p.id, 'main_orchestrator', $2::text, 'coordination', 'main_orchestrator', $3::text, 'success'
FROM projects p WHERE p.id = $1::uuid`,
      options: {
        queryReplacement: `={{ [$json.project_id || $('Decode JWT').first().json.project_id || null, 'Pidiendo a ${d.agent_name} que se encargue de: ${d.short}', '${d.agent_name}'] }}`,
      },
    },
    credentials: { postgres: POSTGRES_CREDS },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  };
}

function buildCoordAfterNode(d, position) {
  return {
    id: 'coord-after-' + d.agent_name.replace(/[^a-z0-9]/g, '') + '-' + d.node.replace(/[^a-z0-9]/gi, '').slice(-12),
    name: 'Coord After ' + d.node.replace('Run ', ''),
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position,
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO activity_log (tenant_id, project_id, agent_name, action, message_type, from_agent, to_agent, status)
SELECT p.tenant_id, p.id, $3::text, $2::text, 'coordination', $3::text, 'main_orchestrator', 'success'
FROM projects p WHERE p.id = $1::uuid`,
      options: {
        queryReplacement: `={{ [$json.project_id || $('Decode JWT').first().json.project_id || null, '${d.agent_name} ha terminado: ${d.short}', '${d.agent_name}'] }}`,
      },
    },
    credentials: { postgres: POSTGRES_CREDS },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  };
}

function findPredecessor(connections, targetName) {
  for (const [src, edges] of Object.entries(connections)) {
    for (const branch of (edges.main || [])) {
      for (const c of branch) {
        if (c.node === targetName) return { src, branchIndex: edges.main.indexOf(branch) };
      }
    }
  }
  return null;
}

async function main() {
  console.log('[1] GET workflow', WF_ID);
  const r = await fetch(N8N + '/api/v1/workflows/' + WF_ID, { headers });
  if (!r.ok) { console.error('FAIL', r.status); process.exit(1); }
  const wf = await r.json();
  console.log('   nodes inicial:', wf.nodes.length);

  let coordBeforeAdded = 0;
  let coordAfterAdded = 0;

  for (const d of DELEGATIONS) {
    const runNode = wf.nodes.find(n => n.name === d.node);
    if (!runNode) {
      console.log(`   SKIP: nodo "${d.node}" no encontrado`);
      continue;
    }
    const [rx, ry] = runNode.position;

    // 1. Coord Before: rama paralela DESDE el predecesor del runNode
    const beforeNode = buildCoordBeforeNode(d, [rx - 120, ry + 200]);
    // Si ya existe, lo actualizamos in-place
    const existingBefore = wf.nodes.find(n => n.id === beforeNode.id);
    if (existingBefore) {
      Object.assign(existingBefore, beforeNode);
    } else {
      wf.nodes.push(beforeNode);
      coordBeforeAdded++;
    }

    // Conectar predecesor -> Coord Before X (en paralelo a flujo existente)
    const pred = findPredecessor(wf.connections, d.node);
    if (pred) {
      const branch = wf.connections[pred.src].main[pred.branchIndex];
      const alreadyConnected = branch.some(c => c.node === beforeNode.name);
      if (!alreadyConnected) {
        branch.push({ node: beforeNode.name, type: 'main', index: 0 });
      }
    }

    // 2. Coord After: rama paralela DESDE el runNode
    const afterNode = buildCoordAfterNode(d, [rx + 240, ry + 200]);
    const existingAfter = wf.nodes.find(n => n.id === afterNode.id);
    if (existingAfter) {
      Object.assign(existingAfter, afterNode);
    } else {
      wf.nodes.push(afterNode);
      coordAfterAdded++;
    }
    // Conectar runNode -> Coord After X (en paralelo a flujo existente)
    if (!wf.connections[d.node]) wf.connections[d.node] = { main: [[]] };
    if (!wf.connections[d.node].main[0]) wf.connections[d.node].main[0] = [];
    const branch = wf.connections[d.node].main[0];
    const alreadyConnected = branch.some(c => c.node === afterNode.name);
    if (!alreadyConnected) {
      branch.push({ node: afterNode.name, type: 'main', index: 0 });
    }
  }

  console.log(`   Coord Before nuevos: ${coordBeforeAdded}, Coord After nuevos: ${coordAfterAdded}`);
  console.log('   nodes final:', wf.nodes.length);

  // PUT update - sanear settings (n8n API rechaza props extra como callerPolicy)
  const cleanSettings = { executionOrder: wf.settings?.executionOrder || 'v1' };
  const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: cleanSettings };
  const r2 = await fetch(N8N + '/api/v1/workflows/' + WF_ID, { method: 'PUT', headers, body: JSON.stringify(payload) });
  if (!r2.ok) { console.error('FAIL update', r2.status, (await r2.text()).slice(0, 1500)); process.exit(1); }
  console.log('[2] UPDATED');
  const r3 = await fetch(N8N + '/api/v1/workflows/' + WF_ID + '/activate', { method: 'POST', headers });
  console.log('[3] ACTIVATED active=', (await r3.json()).active);

  // Persistir JSON local
  try {
    const local = JSON.parse(await readFile(LOCAL_PATH, 'utf-8'));
    local.nodes = wf.nodes;
    local.connections = wf.connections;
    local._description = (local._description || '') + ' [PATCH 2026-05-19 Bloque5: 22 nodos coord (11 before + 11 after) en rama paralela]';
    await writeFile(LOCAL_PATH, JSON.stringify(local, null, 2), 'utf-8');
    console.log('[4] JSON local actualizado');
  } catch (e) {
    console.log('[4] no se pudo persistir JSON local:', e.message);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
