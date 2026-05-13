#!/usr/bin/env node
/**
 * ADDENDUM 2 Bloque 4.1 parte 1 (no UI):
 * Enriquece el system prompt de studio_agent_chat (zjbVC1p7tW5MTJ6g) con:
 *  - display_name + room_display_name (via JOIN a studio_rooms)
 *  - last_action_text + state_es (via activity_log + agents catalogo)
 *  - architect_name del JWT
 *  - 6 reglas estrictas del ADDENDUM 2 (espaniol, 1a persona, no inventar
 *    normativa, no usar jerga tecnica, asumir correccion sin discutir).
 */

const N8N = 'https://n8n-n8n.zzeluw.easypanel.host';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';
const ID = 'zjbVC1p7tW5MTJ6g';
const headers = { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' };

const NEW_LOAD_AGENT_QUERY = `SELECT
  ac.agent_name,
  ac.display_name,
  ac.category,
  ac.room_id,
  ac.description,
  COALESCE(sr.display_name, ac.room_id) AS room_display_name,
  -- ultima accion del agente en este tenant: subquery para evitar duplicar filas
  (
    SELECT al.action
      FROM activity_log al
     WHERE al.agent_name = ac.agent_name
       AND al.message_type = 'action'
       AND al.created_at > now() - interval '2 hours'
     ORDER BY al.created_at DESC
     LIMIT 1
  ) AS last_action_text
FROM agents_catalog ac
LEFT JOIN studio_rooms sr ON sr.room_id = ac.room_id
WHERE ac.agent_name = $1
LIMIT 1`;

const NEW_BUILD_PROMPT_JS = `const agent = $input.first()?.json;
const sess = $('Decode JWT + Body').first().json;
if (!agent || !agent.agent_name) {
  return [{ json: { _error: 'AGENT_NOT_FOUND', _status: 404, _details: 'agente no existe en agents_catalog' } }];
}
// Load History devuelve filas DESC; reordenar a cronologico ascendente.
const histRows = $('Load History').all().map(i => i.json).filter(r => r.role && r.content);
const history = histRows.reverse();

// ADDENDUM 2 Bloque 4.1: system prompt enriquecido con contexto del agente.
// El agente trabaja para el arquitecto (no para el cliente final).
const architectName = sess.full_name || 'el arquitecto';
const projectCtx = sess.project_id
  ? \`Proyecto activo: \${sess.project_name || sess.project_id}\`
  : 'Sin proyecto activo (conversacion general del estudio)';

const lastActionLine = agent.last_action_text
  ? \`Tu ultima accion registrada: "\${agent.last_action_text}"\`
  : 'Sin actividad reciente en las ultimas 2 horas.';

const systemPrompt = [
  \`Eres \${agent.display_name}, integrante del estudio de arquitectura tecnica del arquitecto \${architectName}. Trabajas para el, no para el cliente final.\`,
  '',
  'Estado actual:',
  \`- \${projectCtx}\`,
  \`- Sala donde estas: \${agent.room_display_name}\`,
  \`- Tu rol: \${agent.description || agent.agent_name}\`,
  \`- \${lastActionLine}\`,
  '',
  'Reglas estrictas:',
  '1. Responde SIEMPRE en espaniol de Espania, tono profesional pero cercano.',
  '2. Habla en primera persona ("Estoy revisando...", "He calculado...").',
  '3. Si el arquitecto te corrige, asume la correccion sin discutir y explica brevemente como la vas a aplicar.',
  '4. Si te pregunta por que tomaste una decision, cita las fuentes concretas (CTE, PGOU local, briefing, decision en decision_log). Si no las recuerdas, dilo.',
  '5. NUNCA inventes normativa, valores numericos ni articulos. Si no tienes el dato, dilo claramente.',
  '6. NO uses jerga tecnica de implementacion ("workflow", "INSERT", "endpoint", "agent_X"). Tu eres un profesional del estudio, no software.',
  '7. Mantente breve: 3-5 frases por defecto. Si te piden detalle, ampliacion controlada.',
  '8. Si te piden algo fuera de tu rol, recomienda al agente correcto del estudio (por su rol en castellano, no por su agent_name).',
].join('\\n');

const messages = [{ role: 'system', content: systemPrompt }];
for (const h of history) {
  messages.push({ role: h.role === 'agent' ? 'assistant' : 'user', content: h.content });
}
messages.push({ role: 'user', content: sess.message });

return [{ json: {
  ...sess,
  agent: {
    agent_name: agent.agent_name,
    display_name: agent.display_name,
    category: agent.category,
    room_id: agent.room_id,
    room_display_name: agent.room_display_name,
    description: agent.description,
    last_action_text: agent.last_action_text
  },
  history_count: history.length,
  llm_payload: {
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.4,
    max_tokens: 350
  }
}}];`;

async function main() {
  console.log('[1] GET workflow ' + ID);
  let r = await fetch(N8N + '/api/v1/workflows/' + ID, { headers });
  if (!r.ok) { console.error('FAIL get', r.status, await r.text()); process.exit(1); }
  const wf = await r.json();
  console.log('    nodes:', wf.nodes.length);

  // Modificar nodos
  const loadAgent = wf.nodes.find(n => n.name === 'Load agent info');
  const buildPrompt = wf.nodes.find(n => n.name === 'Build prompt');
  if (!loadAgent || !buildPrompt) { console.error('FAIL nodes not found'); process.exit(1); }
  loadAgent.parameters.query = NEW_LOAD_AGENT_QUERY;
  buildPrompt.parameters.jsCode = NEW_BUILD_PROMPT_JS;
  console.log('[2] Modificados Load agent info + Build prompt');

  // PUT workflow
  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || { executionOrder: 'v1' },
  };
  r = await fetch(N8N + '/api/v1/workflows/' + ID, {
    method: 'PUT', headers, body: JSON.stringify(payload),
  });
  if (!r.ok) { console.error('FAIL update', r.status, (await r.text()).slice(0, 1000)); process.exit(1); }
  console.log('[3] UPDATED workflow');

  // Activate
  r = await fetch(N8N + '/api/v1/workflows/' + ID + '/activate', { method: 'POST', headers });
  console.log('[4] ACTIVATED active=', (await r.json()).active);

  // Persistir tambien JSON local si existe
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const localPath = path.resolve(import.meta.dirname || '.', '..', 'workflows', 'api', 'api_studio_agent_chat.json');
    let localExists = false;
    try { await fs.access(localPath); localExists = true; } catch {}
    if (localExists) {
      // Reescribir con la version live (sin metadata extra de n8n)
      const local = JSON.parse(await fs.readFile(localPath, 'utf-8'));
      const localLoadAgent = local.nodes.find(n => n.name === 'Load agent info');
      const localBuildPrompt = local.nodes.find(n => n.name === 'Build prompt');
      if (localLoadAgent && localBuildPrompt) {
        localLoadAgent.parameters.query = NEW_LOAD_AGENT_QUERY;
        localBuildPrompt.parameters.jsCode = NEW_BUILD_PROMPT_JS;
        await fs.writeFile(localPath, JSON.stringify(local, null, 2), 'utf-8');
        console.log('[5] JSON local actualizado:', localPath);
      }
    } else {
      console.log('[5] JSON local no existe (no es problema, source-of-truth es n8n live)');
    }
  } catch (e) {
    console.log('[5] No se pudo persistir JSON local:', e.message);
  }

  console.log('\\nOK. Smoke manual:');
  console.log('  curl -X POST ' + N8N + '/webhook/api/v1/studio/agent-chat \\\\');
  console.log('       -H "Authorization: Bearer <JWT>" \\\\');
  console.log('       -H "Content-Type: application/json" \\\\');
  console.log("       -d '{\\\"agent_name\\\":\\\"agent_costs\\\",\\\"project_id\\\":\\\"<pid>\\\",\\\"message\\\":\\\"hola\\\"}'");
}

main().catch(e => { console.error(e); process.exit(1); });
