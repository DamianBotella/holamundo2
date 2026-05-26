// Sync de los 3 workflows util creados durante el seed extendido de 43
// municipios PGOU (mayo 2026). Trae el live desde n8n a disco.
import { readFile, writeFile } from 'node:fs/promises';

const N8N_API_URL = 'https://n8n-n8n.zzeluw.easypanel.host';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';

const WORKFLOWS = [
  {
    path: 'studio-multiagente/workflows/util_pgou_embeddings_backfill.json',
    id: 'lcE2P00Wad0FUZTo',
    description: 'One-shot job que rellena searchable_text y genera embeddings text-embedding-3-small (1536d) para las filas de municipal_pgou_rules con embedding IS NULL. Disparado durante el seed extendido de mayo 2026 (43 municipios nuevos = 615 reglas a embedder). Gate Once garantiza que Load Pending corre solo una vez tras Backfill (evita OOM 615^2 items). Idempotente: re-ejecuciones solo cubren los huecos.',
    endpoint: 'POST /webhook/util/pgou-embeddings-backfill',
    body_shape: '{} (sin payload; lee toda la cola WHERE embedding IS NULL LIMIT 1500)',
    response: '{ ok: true, status: "started", request_id }',
    deps: 'Postgres cfxNZdzy0NB3xkYC, OpenAI gE1jXO133xEHS5JJ, mig 086 (columna embedding + funcion search_pgou_rules)',
  },
  {
    path: 'studio-multiagente/workflows/util_pgou_stats.json',
    id: 'IFWlwrvfZlpTdZ11',
    description: 'GET stats agregadas de municipal_pgou_rules: total_rules, total_municipios, rules_with_embedding, rules_pending_embedding, rules_pending_searchable + breakdown por municipio_slug. Usado para verificar progreso del backfill.',
    endpoint: 'GET /webhook/util/pgou-stats',
    body_shape: '(sin body)',
    response: '{ stats: {...}, per_municipio: [...] }',
    deps: 'Postgres cfxNZdzy0NB3xkYC',
  },
  {
    path: 'studio-multiagente/workflows/util_pgou_rag_smoke.json',
    id: 'CrPX1y749HUUYUOa',
    description: 'Smoke test directo del path RAG sin necesidad de JWT/project_id. Recibe {municipio, question}, embedea la pregunta con text-embedding-3-small y llama search_pgou_rules(municipio, embedding, 5). Devuelve top 5 reglas con similarity. Util para validar que un municipio recien sembrado responde correctamente.',
    endpoint: 'POST /webhook/util/pgou-rag-smoke',
    body_shape: '{ municipio: string (slug), question: string }',
    response: '{ ok: true, municipio, question, results: [{rule_title, rule_category, normative_reference, normative_url, severity, similarity}] }',
    deps: 'Postgres cfxNZdzy0NB3xkYC, OpenAI gE1jXO133xEHS5JJ, mig 086 (search_pgou_rules)',
  },
];

let allOk = true;
for (const wf of WORKFLOWS) {
  const r = await fetch(`${N8N_API_URL}/api/v1/workflows/${wf.id}`, { headers: { 'X-N8N-API-KEY': N8N_API_KEY } });
  const live = await r.json();
  if (!r.ok) {
    console.error(`FAIL ${wf.id} - ${live?.message || JSON.stringify(live).slice(0, 200)}`);
    allOk = false;
    continue;
  }
  const merged = {
    name: live.name,
    _description: wf.description,
    _status: 'seed-extended-may-2026',
    _n8n_id: wf.id,
    _endpoint: wf.endpoint,
    _body_shape: wf.body_shape,
    _response_success: wf.response,
    _dependencies: wf.deps,
    nodes: live.nodes,
    connections: live.connections,
    settings: live.settings || { executionOrder: 'v1' },
    pinData: live.pinData || {},
  };
  await writeFile(wf.path, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  console.log(`[sync] OK ${wf.path} - ${live.nodes.length} nodes`);
}

process.exit(allOk ? 0 : 1);
