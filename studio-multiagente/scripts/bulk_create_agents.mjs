// Genera + deploy a n8n + activa los 8 agentes AUX pendientes (B72-fase-C).
// Patron compacto basado en agent_trades.json (17 nodos): webhook + JWT decode +
// auth check + session ctx + load project + 1-2 loads tabla aux + build prompt
// + start_execution + LLM call + format + INSERT en tabla destino + finish_exec
// + respond 201.
//
// Cada agente define: id_prefix, path, prompt_system, prompt_user_builder,
// load_queries[], insert_query, response_summary.

import fs from 'node:fs';

const ROOT = 'c:\\Users\\Damian Martinez\\Desktop\\holamundo2';
const apiKey = fs.readFileSync(`${ROOT}\\.mcp.json`, 'utf8').match(/"N8N_API_KEY":\s*"([^"]+)"/)[1];
const PG_CRED = { id: 'cfxNZdzy0NB3xkYC', name: 'Postgres account' };
const LLM_CRED = { id: 'gE1jXO133xEHS5JJ', name: 'orquestador ArquiAI' };

/**
 * Construye un workflow estandar de agente con N nodos:
 *  webhook -> decode -> auth-if -> set_session -> load_project -> [extra_loads]
 *  -> build_prompt -> prompt-if -> start_exec -> LLM -> format -> insert_target
 *  -> finish_exec -> respond_201
 *
 * @param {object} cfg
 * @param {string} cfg.name              agent_*  (sin prefijo agent_)
 * @param {string} cfg.path              api/v1/agents/<x>/<verb>
 * @param {string} cfg.idPrefix          prefijo unico 2-3 chars para los id nodes
 * @param {string} cfg.systemPrompt      prompt system base (multilinea ok)
 * @param {string} cfg.userPromptTpl     plantilla JS interpolada con ${project},${rows0},...
 * @param {Array<{name,query}>} cfg.extraLoads  consultas adicionales tras Load Project
 * @param {string} cfg.insertQuery       INSERT INTO ... RETURNING id (param: $1=project_id, $2 onwards)
 * @param {string} cfg.insertParams      array JS para queryReplacement del INSERT (string del expr)
 * @param {string} cfg.dataSummary       expresion JS para crear resumen 'data' en respond_201
 * @param {string} cfg.execSummary       expresion JS para resumen output de Finish Execution
 * @param {string} cfg.outputShape       JS para construir 'output' de Format Response (de parsed)
 */
function buildWorkflow(cfg) {
  const p = cfg.idPrefix;
  const extras = cfg.extraLoads || [];
  // Posiciones
  let x = 240, y = 200;
  const STEP_X = 240;
  const nodes = [];
  const conns = {};

  // Webhook
  nodes.push({
    parameters: { httpMethod: 'POST', path: cfg.path, responseMode: 'responseNode', options: {} },
    type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [x, y+100],
    id: `${p}-webhook`, name: `POST /${cfg.path.split('/').slice(-2).join('/')}`,
    webhookId: cfg.webhookUuid,
    onError: 'continueRegularOutput'
  });

  // Decode JWT
  x += STEP_X;
  nodes.push({
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const auth = $input.first().json.headers?.authorization || '';\nif (!auth.startsWith('Bearer ')) return [{ json: { _error: 'AUTH_MISSING_TOKEN', _status: 401 } }];\nconst token = auth.slice(7);\ntry {\n  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));\n  if (!payload.sub) throw new Error('No sub');\n  if (payload.exp && Date.now()/1000 > payload.exp) throw new Error('JWT expired');\n  if (!payload.tenant_id) throw new Error('No tenant_id');\n  const body = $input.first().json.body || {};\n  const projectId = (body.project_id || '').trim();\n  if (!projectId) return [{ json: { _error: 'VALIDATION_FAILED', _status: 400, _details: 'project_id requerido' } }];\n  return [{ json: { user_id: payload.sub, tenant_id: payload.tenant_id, role: payload.role || 'architect', project_id: projectId, body: body, request_id: 'req_' + Math.random().toString(36).slice(2, 10) }}];\n} catch (e) { return [{ json: { _error: 'AUTH_INVALID_TOKEN', _status: 401, _details: e.message }}]; }`
    },
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [x, y+100],
    id: `${p}-decode`, name: 'Decode JWT + Body'
  });

  // Auth IF
  x += STEP_X;
  nodes.push({
    parameters: { conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{id:`${p}-c1`,leftValue:'={{ $json._error }}',rightValue:'',operator:{type:'string',operation:'exists',singleValue:true}}], combinator: 'and' } },
    type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [x, y+100],
    id: `${p}-if-auth`, name: 'Auth OK?'
  });

  // Respond Error (rama true de Auth IF)
  nodes.push({
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ error: { code: $json._error, message: $json._details || $json._error } }) }}', options: { responseCode: '={{ $json._status || 401 }}' } },
    type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [x+240, y+260],
    id: `${p}-respond-error`, name: 'Respond Error'
  });

  // Set Session
  x += STEP_X;
  nodes.push({
    parameters: { operation: 'executeQuery', query: 'SELECT set_session_context($1::uuid, $2::uuid, $3)', options: { queryReplacement: '={{ [$json.user_id, $json.tenant_id, $json.role] }}' } },
    credentials: { postgres: PG_CRED },
    type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [x, y],
    id: `${p}-set-session`, name: 'Set Session Context'
  });

  // Load Project
  x += STEP_X;
  nodes.push({
    parameters: { operation: 'executeQuery', query: 'SELECT id, name, project_type, location_province, location_city, property_type, property_area_m2, budget_target, urgency, current_phase, metadata FROM projects WHERE id = $1::uuid LIMIT 1', options: { queryReplacement: "={{ [$('Decode JWT + Body').first().json.project_id] }}" } },
    credentials: { postgres: PG_CRED },
    type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [x, y],
    id: `${p}-load-project`, name: 'Load Project', alwaysOutputData: true
  });

  // Extra loads (en cadena)
  let prevLoadName = 'Load Project';
  const extraNames = [];
  for (const ex of extras) {
    x += STEP_X;
    const nm = ex.name;
    extraNames.push(nm);
    nodes.push({
      parameters: { operation: 'executeQuery', query: ex.query, options: { queryReplacement: ex.params || "={{ [$('Decode JWT + Body').first().json.project_id] }}" } },
      credentials: { postgres: PG_CRED },
      type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [x, y],
      id: `${p}-load-${nm.toLowerCase().replace(/\s+/g, '-')}`, name: nm, alwaysOutputData: true
    });
    prevLoadName = nm;
  }

  // Build Prompt
  x += STEP_X;
  const promptCode = `const sess = $('Decode JWT + Body').first().json;\nconst projectRows = $('Load Project').all().map(i => i.json).filter(p => p && p.id);\nif (projectRows.length === 0) return [{ json: { _error: 'PROJECT_NOT_FOUND', _status: 404, _details: 'project_id no existe', request_id: sess.request_id }}];\nconst project = projectRows[0];\n${extras.map((e,i) => `const rows_${i} = $('${e.name}').all().map(it => it.json).filter(r => r);`).join('\\n')}\n\n${cfg.userPromptTpl}\n\nreturn [{ json: { user_id: sess.user_id, tenant_id: sess.tenant_id, project_id: project.id, request_id: sess.request_id, body: sess.body, ${cfg.extraReturnFields || ''} llm_payload: { model: 'gpt-4o', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.2, max_tokens: 2000, response_format: { type: 'json_object' }}}}];`;
  nodes.push({
    parameters: { mode: 'runOnceForAllItems', jsCode: promptCode },
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [x, y],
    id: `${p}-build-prompt`, name: 'Build Prompt'
  });

  // Prompt IF
  x += STEP_X;
  nodes.push({
    parameters: { conditions: { options: { caseSensitive: false, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{id:`${p}-c2`,leftValue:'={{ $json._error }}',rightValue:'',operator:{type:'string',operation:'exists',singleValue:true}}], combinator: 'and' } },
    type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [x, y],
    id: `${p}-if-prompt`, name: 'Prompt OK?'
  });

  // Respond Error Project (rama true)
  nodes.push({
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify({ error: { code: $json._error, message: $json._details } }) }}', options: { responseCode: '={{ $json._status || 422 }}' } },
    type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [x+240, y+160],
    id: `${p}-respond-422`, name: 'Respond 422'
  });

  // Start Execution
  x += STEP_X;
  nodes.push({
    parameters: { operation: 'executeQuery', query: `INSERT INTO agent_executions (project_id, agent_name, status, started_at, input, metadata)\nVALUES ($1::uuid, 'agent_${cfg.name}', 'running', now(), $2::jsonb, $3::jsonb) RETURNING id`, options: { queryReplacement: `={{ [$('Build Prompt').first().json.project_id, JSON.stringify({ project_id: $('Build Prompt').first().json.project_id }), JSON.stringify({ request_id: $('Build Prompt').first().json.request_id, source: 'api_${cfg.name}' })] }}` } },
    credentials: { postgres: PG_CRED },
    type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [x, y-100],
    id: `${p}-start-exec`, name: 'Start Execution', alwaysOutputData: true
  });

  // Call LLM
  x += STEP_X;
  nodes.push({
    parameters: { method: 'POST', url: 'https://api.openai.com/v1/chat/completions', authentication: 'predefinedCredentialType', nodeCredentialType: 'httpHeaderAuth', sendHeaders: true, headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] }, sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify($('Build Prompt').first().json.llm_payload) }}", options: { timeout: 90000 } },
    credentials: { httpHeaderAuth: LLM_CRED },
    type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [x, y-100],
    id: `${p}-llm`, name: 'Call LLM'
  });

  // Format Response
  x += STEP_X;
  const formatCode = `const llm = $input.first()?.json;\nconst built = $('Build Prompt').first().json;\nconst raw = llm?.choices?.[0]?.message?.content || '{}';\nlet parsed; try { parsed = JSON.parse(raw); } catch (e) { return [{ json: { _error: 'LLM_INVALID_JSON', _status: 502, _details: e.message, _raw: raw.slice(0,500), request_id: built.request_id }}]; }\nconst usage = llm?.usage || {};\n${cfg.outputShape}\nreturn [{ json: { user_id: built.user_id, tenant_id: built.tenant_id, project_id: built.project_id, request_id: built.request_id, body: built.body, output: outputObj, summary: summaryObj, model: llm?.model || 'gpt-4o', tokens_in: usage.prompt_tokens || 0, tokens_out: usage.completion_tokens || 0 }}];`;
  nodes.push({
    parameters: { mode: 'runOnceForAllItems', jsCode: formatCode },
    type: 'n8n-nodes-base.code', typeVersion: 2, position: [x, y-100],
    id: `${p}-format`, name: 'Format Response'
  });

  // Insert target
  x += STEP_X;
  nodes.push({
    parameters: { operation: 'executeQuery', query: cfg.insertQuery, options: { queryReplacement: cfg.insertParams } },
    credentials: { postgres: PG_CRED },
    type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [x, y-100],
    id: `${p}-insert-target`, name: 'Insert Target', alwaysOutputData: true
  });

  // Finish Execution
  x += STEP_X;
  nodes.push({
    parameters: { operation: 'executeQuery', query: 'UPDATE agent_executions SET status = $4::text, finished_at = now(), output = $2::jsonb, metadata = COALESCE(metadata, \'{}\'::jsonb) || $3::jsonb WHERE id = $1::uuid', options: { queryReplacement: `={{ [$('Start Execution').first().json.id, JSON.stringify($('Format Response').first().json.summary), JSON.stringify({ model: $('Format Response').first().json.model, tokens_in: $('Format Response').first().json.tokens_in, tokens_out: $('Format Response').first().json.tokens_out, eu_ai_act: 'asistencia profesional supervisada' }), 'completed'] }}` } },
    credentials: { postgres: PG_CRED },
    type: 'n8n-nodes-base.postgres', typeVersion: 2.5, position: [x, y-100],
    id: `${p}-finish-exec`, name: 'Finish Execution', alwaysOutputData: true, onError: 'continueRegularOutput'
  });

  // Respond 201
  x += STEP_X;
  nodes.push({
    parameters: { respondWith: 'json', responseBody: `={{ JSON.stringify({ data: ${cfg.dataSummary}, meta: { request_id: $('Format Response').first().json.request_id, model: $('Format Response').first().json.model, tokens_in: $('Format Response').first().json.tokens_in, tokens_out: $('Format Response').first().json.tokens_out, timestamp: new Date().toISOString() }}) }}`, options: { responseCode: 201, responseHeaders: { entries: [{ name: 'Cache-Control', value: 'no-cache' }] } } },
    type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: [x, y-100],
    id: `${p}-respond-201`, name: 'Respond 201'
  });

  // Connections
  const webhookName = `POST /${cfg.path.split('/').slice(-2).join('/')}`;
  conns[webhookName] = { main: [[{ node: 'Decode JWT + Body', type: 'main', index: 0 }]] };
  conns['Decode JWT + Body'] = { main: [[{ node: 'Auth OK?', type: 'main', index: 0 }]] };
  conns['Auth OK?'] = { main: [[{ node: 'Respond Error', type: 'main', index: 0 }], [{ node: 'Set Session Context', type: 'main', index: 0 }]] };
  conns['Set Session Context'] = { main: [[{ node: 'Load Project', type: 'main', index: 0 }]] };

  const loadChain = ['Load Project', ...extraNames];
  for (let i = 0; i < loadChain.length - 1; i++) conns[loadChain[i]] = { main: [[{ node: loadChain[i+1], type: 'main', index: 0 }]] };
  conns[loadChain[loadChain.length-1]] = { main: [[{ node: 'Build Prompt', type: 'main', index: 0 }]] };

  conns['Build Prompt'] = { main: [[{ node: 'Prompt OK?', type: 'main', index: 0 }]] };
  conns['Prompt OK?'] = { main: [[{ node: 'Respond 422', type: 'main', index: 0 }], [{ node: 'Start Execution', type: 'main', index: 0 }]] };
  conns['Start Execution'] = { main: [[{ node: 'Call LLM', type: 'main', index: 0 }]] };
  conns['Call LLM'] = { main: [[{ node: 'Format Response', type: 'main', index: 0 }]] };
  conns['Format Response'] = { main: [[{ node: 'Insert Target', type: 'main', index: 0 }]] };
  conns['Insert Target'] = { main: [[{ node: 'Finish Execution', type: 'main', index: 0 }]] };
  conns['Finish Execution'] = { main: [[{ node: 'Respond 201', type: 'main', index: 0 }]] };

  return {
    name: `agent_${cfg.name}`,
    _description: cfg.description || `Agente ${cfg.name} (B72-fase-C)`,
    _status: 'B72-fase-C AUX',
    nodes,
    connections: conns,
    settings: { executionOrder: 'v1' },
    pinData: {}
  };
}

// =============================================================================
// CONFIG DE LOS 8 AUX
// =============================================================================

const AGENTS = [
  {
    name: 'client_concierge',
    path: 'api/v1/agents/client-concierge/respond',
    idPrefix: 'acc',
    webhookUuid: 'e4f5a6b7-c8d9-4e0f-1a2b-3c4d5e6f7a8b',
    description: 'Chatbot del cliente con escalado al arquitecto. Recibe mensaje del cliente, responde lo que pueda y escala consultas tecnicas/decisiones.',
    extraLoads: [
      { name: 'Load Briefing', query: "SELECT id, summary FROM briefings WHERE project_id = $1::uuid AND status = 'approved' ORDER BY created_at DESC LIMIT 1" },
      { name: 'Load Conversation', query: "SELECT role, message, created_at FROM client_conversations WHERE project_id = $1::uuid ORDER BY created_at DESC LIMIT 10" }
    ],
    userPromptTpl: `const briefing = rows_0[0] || null;\nconst recentMsgs = rows_1.reverse();\nconst userMessage = (sess.body?.message || '').trim();\nif (!userMessage) return [{ json: { _error: 'NO_MESSAGE', _status: 400, _details: 'falta body.message', request_id: sess.request_id }}];\nconst systemPrompt = \`Eres el Asesor de Cliente de un estudio de arquitectura. Hablas con el CLIENTE del proyecto (no con el arquitecto). Tu rol:\\n- Responder dudas generales del cliente sobre su proyecto (estado, fechas, decisiones tomadas).\\n- NUNCA tomar decisiones tecnicas, legales o economicas — eso es del arquitecto.\\n- Escalar (escalate=true) cuando el cliente pida cambios al briefing/contrato/presupuesto, o cuando pregunte algo tecnico.\\n- Tono cercano, profesional, en espanol.\\n- DEVUELVE SOLO JSON: { \"reply\": \"...\", \"escalate\": bool, \"escalate_reason\": \"...\" }\`;\nconst userPrompt = \`PROYECTO: \${project.name}\\nBRIEFING: \${briefing?.summary?.slice(0,300) ?? '(sin briefing)'}\\n\\nULTIMOS 10 MENSAJES:\\n\${recentMsgs.map(m => '- ['+m.role+']: '+m.message.slice(0,200)).join('\\\\n')}\\n\\nMENSAJE DEL CLIENTE: \${userMessage}\\n\\nResponde y decide si escalar.\`;`,
    extraReturnFields: 'user_message: $json.body?.message || null,',
    outputShape: `const outputObj = { reply: parsed.reply || '', escalate: !!parsed.escalate, escalate_reason: parsed.escalate_reason || null };\nconst summaryObj = { escalate: outputObj.escalate, reply_len: outputObj.reply.length };`,
    insertQuery: "INSERT INTO client_conversations (project_id, role, message, metadata) VALUES ($1::uuid, 'assistant', $2::text, $3::jsonb) RETURNING id",
    insertParams: "={{ [$json.project_id, $json.output.reply, JSON.stringify({ escalate: $json.output.escalate, escalate_reason: $json.output.escalate_reason, request_id: $json.request_id })] }}",
    dataSummary: "{ project_id: $('Format Response').first().json.project_id, reply: $('Format Response').first().json.output.reply, escalate: $('Format Response').first().json.output.escalate, escalate_reason: $('Format Response').first().json.output.escalate_reason }"
  },
  {
    name: 'sketch_to_scale',
    path: 'api/v1/agents/sketch-to-scale/process',
    idPrefix: 'ass',
    webhookUuid: 'f5a6b7c8-d9e0-4f1a-2b3c-4d5e6f7a8b9c',
    description: 'Convierte un croquis/foto del cliente en notas tecnicas escaladas. Lee body.sketch_url (foto), genera medidas estimadas y observaciones.',
    extraLoads: [],
    userPromptTpl: `const sketchUrl = (sess.body?.sketch_url || '').trim();\nconst clientNotes = sess.body?.notes || '';\nconst systemPrompt = \`Eres agent_sketch_to_scale, dibujante tecnico que procesa croquis del cliente.\\nRECIBES: una URL de foto/croquis + notas opcionales.\\nGENERAS: notas tecnicas con medidas estimadas, escala probable, elementos detectados (paredes, puertas, ventanas, muebles), recomendacion de plano formal a generar (cota acotacion).\\nNO inventes medidas que no puedas estimar. Si la imagen es ambigua, marcalo en open_questions.\\nDEVUELVE SOLO JSON.\`;\nconst userPrompt = \`PROYECTO: \${project.name} (\${project.property_area_m2 ?? '?'} m2)\\nCROQUIS URL: \${sketchUrl || '(no proporcionado — solo procesar notas)'}\\nNOTAS CLIENTE: \${clientNotes || '(sin notas)'}\\n\\nTAREA: extrae info tecnica del croquis para que el delineante genere el plano formal.\\n\\nOUTPUT JSON:\\n{ \"scale_estimated\": \"1:50\", \"detected_elements\": [{ \"type\": \"...\", \"qty\": 1, \"size\": \"...\" }], \"measurements\": { ... }, \"recommended_plan_type\": \"planta|alzado|seccion\", \"open_questions\": [\"...\"], \"confidence\": 0.7 }\`;`,
    outputShape: `const outputObj = parsed;\nconst summaryObj = { confidence: parsed.confidence || 0, elements_count: (parsed.detected_elements || []).length, questions_count: (parsed.open_questions || []).length };`,
    insertQuery: "INSERT INTO project_notes (project_id, author, content, metadata) VALUES ($1::uuid, 'agent_sketch_to_scale', $2::text, $3::jsonb) RETURNING id",
    insertParams: "={{ [$json.project_id, JSON.stringify($json.output, null, 2), JSON.stringify({ request_id: $json.request_id, type: 'sketch_processed' })] }}",
    dataSummary: "{ project_id: $('Format Response').first().json.project_id, ...$('Format Response').first().json.output }"
  },
  {
    name: 'anomaly_detector',
    path: 'api/v1/agents/anomaly-detector/scan',
    idPrefix: 'aad',
    webhookUuid: 'a6b7c8d9-e0f1-4a2b-3c4d-5e6f7a8b9c0d',
    description: 'Inspector de Fraude: 8 heuristicas sobre invoices+cost_estimates+trade_quotes para detectar anomalias economicas (precio fuera de rango, duplicados, ramos sin presupuesto, etc.).',
    extraLoads: [
      { name: 'Load Invoices', query: "SELECT id, amount, vendor, invoice_date, status, project_id FROM invoices WHERE project_id = $1::uuid ORDER BY invoice_date DESC LIMIT 50" },
      { name: 'Load Cost Estimate', query: "SELECT id, version, total_estimated, breakdown FROM cost_estimates WHERE project_id = $1::uuid ORDER BY version DESC LIMIT 1" },
      { name: 'Load Quotes', query: "SELECT id, trade_type, amount_eur, vendor_name, status FROM trade_quotes WHERE project_id = $1::uuid LIMIT 30" }
    ],
    userPromptTpl: `const invoices = rows_0;\nconst costRow = rows_1[0] || null;\nconst quotes = rows_2;\nconst systemPrompt = \`Eres agent_anomaly_detector. Aplicas 8 heuristicas sobre los datos economicos del proyecto para detectar anomalias:\\n1. Factura > 30% sobre coste estimado de su partida\\n2. Facturas duplicadas (mismo vendor + amount + fecha proxima)\\n3. Ramo de presupuesto sin facturacion pasado 50% del plazo\\n4. Quote rechazado pero factura del mismo vendor\\n5. Suma facturas > 110% del total_estimated\\n6. Factura sin proyecto/categoria asignada\\n7. Vendor nuevo (no aparece en quotes previos) con factura > 5000 EUR\\n8. Variacion vendor mismo trade > 40%\\nDEVUELVE SOLO JSON con anomalies (max 20) y risk_score 0-100.\`;\nconst userPrompt = \`PROYECTO: \${project.name}\\nCOST ESTIMATE: \${costRow ? 'v'+costRow.version+', total '+costRow.total_estimated+' EUR' : '(sin estimate)'}\\nBREAKDOWN: \${JSON.stringify((costRow?.breakdown || []).slice(0,15))}\\n\\nINVOICES (\${invoices.length}):\\n\${JSON.stringify(invoices.slice(0,20))}\\n\\nQUOTES (\${quotes.length}):\\n\${JSON.stringify(quotes.slice(0,20))}\\n\\nAplica las 8 heuristicas.\\n\\nOUTPUT JSON:\\n{ \"risk_score\": 35, \"anomalies\": [{ \"heuristic\": 1, \"severity\": \"high\", \"description\": \"...\", \"evidence\": { ... }, \"recommendation\": \"...\" }], \"summary\": \"...\" }\`;`,
    outputShape: `const outputObj = parsed;\nconst summaryObj = { risk_score: parsed.risk_score || 0, anomalies_count: (parsed.anomalies || []).length };`,
    insertQuery: "INSERT INTO anomalies_detected (project_id, risk_score, anomalies, summary) VALUES ($1::uuid, $2::numeric, $3::jsonb, $4::text) RETURNING id",
    insertParams: "={{ [$json.project_id, $json.output.risk_score || 0, JSON.stringify($json.output.anomalies || []), $json.output.summary || ''] }}",
    dataSummary: "{ project_id: $('Format Response').first().json.project_id, risk_score: $('Format Response').first().json.output.risk_score, anomalies_count: ($('Format Response').first().json.output.anomalies || []).length, summary: $('Format Response').first().json.output.summary, anomalies: $('Format Response').first().json.output.anomalies }"
  },
  {
    name: 'collab_coordinator',
    path: 'api/v1/agents/collab-coordinator/assign',
    idPrefix: 'acl',
    webhookUuid: 'b7c8d9e0-f1a2-4b3c-4d5e-6f7a8b9c0d1e',
    description: 'Coordinador de Colaboradores Externos. Asigna tareas (calculo estructural, decoracion, geotecnia, etc.) a colaboradores registrados segun la fase del proyecto.',
    extraLoads: [
      { name: 'Load Collaborators', query: "SELECT id, name, specialty, email, status FROM collaborators WHERE status = 'active' ORDER BY specialty", params: "={{ [] }}" },
      { name: 'Load Existing Assignments', query: "SELECT id, collaborator_id, task_type, status FROM collab_assignments WHERE project_id = $1::uuid" }
    ],
    userPromptTpl: `const collaborators = rows_0;\nconst existing = rows_1;\nconst phase = project.current_phase;\nconst systemPrompt = \`Eres agent_collab_coordinator. Decides que colaboradores externos asignar al proyecto segun su fase y necesidades.\\nFASES Y TIPICOS COLABS:\\n- briefing_done/design_done: arquitecto tecnico (si necesita calculo estructural)\\n- analysis_done: calculista, geotecnico (segun complejidad)\\n- costs_done: aparejador\\n- approved: decorador (opcional, comercial)\\nNUNCA dupliques una asignacion ya existente.\\nDEVUELVE SOLO JSON.\`;\nconst userPrompt = \`PROYECTO: \${project.name} (\${project.project_type}, \${project.property_area_m2 ?? '?'} m2, fase \${phase})\\nUBICACION: \${project.location_city}, \${project.location_province}\\n\\nCOLABORADORES DISPONIBLES (\${collaborators.length}):\\n\${JSON.stringify(collaborators)}\\n\\nASIGNACIONES EXISTENTES:\\n\${JSON.stringify(existing)}\\n\\nTAREA: lista de NUEVAS asignaciones recomendadas (no dupliques las existentes).\\n\\nOUTPUT JSON:\\n{ \"assignments\": [{ \"collaborator_id\": \"uuid\", \"task_type\": \"calculo_estructural|decoracion|geotecnia|otro\", \"description\": \"...\", \"deadline_days\": 14, \"priority\": \"high|medium|low\" }], \"notes\": \"...\" }\`;`,
    outputShape: `const outputObj = parsed;\nconst summaryObj = { new_assignments: (parsed.assignments || []).length };`,
    insertQuery: "INSERT INTO collab_assignments (project_id, collaborator_id, task_type, description, status)\nSELECT $1::uuid, (a->>'collaborator_id')::uuid, (a->>'task_type')::text, (a->>'description')::text, 'open'\nFROM jsonb_array_elements($2::jsonb) AS a\nWHERE (a->>'collaborator_id') IS NOT NULL\nRETURNING id, task_type",
    insertParams: "={{ [$json.project_id, JSON.stringify($json.output.assignments || [])] }}",
    dataSummary: "{ project_id: $('Format Response').first().json.project_id, new_assignments: ($('Format Response').first().json.output.assignments || []).length, assignments: $('Format Response').first().json.output.assignments, notes: $('Format Response').first().json.output.notes }"
  },
  {
    name: 'permit_tracker',
    path: 'api/v1/agents/permit-tracker/check',
    idPrefix: 'apt',
    webhookUuid: 'c8d9e0f1-a2b3-4c4d-5e6f-7a8b9c0d1e2f',
    description: 'Tramitador de Licencias. Revisa permit_applications del proyecto, detecta estados estancados (>30 dias sin avance), genera proximas acciones.',
    extraLoads: [
      { name: 'Load Permits', query: "SELECT id, permit_type, status, submitted_at, expected_resolution, notes FROM permit_applications WHERE project_id = $1::uuid" },
      { name: 'Load Permit History', query: "SELECT permit_id, status, changed_at, notes FROM permit_status_history WHERE permit_id IN (SELECT id FROM permit_applications WHERE project_id = $1::uuid) ORDER BY changed_at DESC LIMIT 30" }
    ],
    userPromptTpl: `const permits = rows_0;\nconst history = rows_1;\nconst systemPrompt = \`Eres agent_permit_tracker. Tu trabajo: dado el estado actual de los permits municipales del proyecto, detectar:\\n- Permits estancados > 30 dias sin cambio\\n- Permits proximos a expirar resolucion\\n- Documentacion adicional probable a aportar\\n- Recomendar siguiente accion (esperar / reclamar / aportar X)\\nDEVUELVE SOLO JSON.\`;\nconst userPrompt = \`PROYECTO: \${project.name} (\${project.location_city}, \${project.location_province})\\n\\nPERMITS (\${permits.length}):\\n\${JSON.stringify(permits)}\\n\\nHISTORY ultimos 30:\\n\${JSON.stringify(history)}\\n\\nFecha hoy: \${new Date().toISOString().slice(0,10)}\\n\\nGenera analisis + recomendaciones.\\n\\nOUTPUT JSON:\\n{ \"stuck_permits\": [{ \"permit_id\": \"uuid\", \"days_stuck\": 45, \"recommended_action\": \"reclamar\" }], \"upcoming_expirations\": [...], \"next_actions\": [\"...\"], \"summary\": \"...\" }\`;`,
    outputShape: `const outputObj = parsed;\nconst summaryObj = { stuck_count: (parsed.stuck_permits || []).length, upcoming_count: (parsed.upcoming_expirations || []).length };`,
    insertQuery: "INSERT INTO project_notes (project_id, author, content, metadata) VALUES ($1::uuid, 'agent_permit_tracker', $2::text, $3::jsonb) RETURNING id",
    insertParams: "={{ [$json.project_id, $json.output.summary || JSON.stringify($json.output), JSON.stringify({ request_id: $json.request_id, type: 'permit_analysis', stuck_count: ($json.output.stuck_permits || []).length })] }}",
    dataSummary: "{ project_id: $('Format Response').first().json.project_id, ...$('Format Response').first().json.output }"
  },
  {
    name: 'qc_checklists',
    path: 'api/v1/agents/qc-checklists/generate',
    idPrefix: 'aqc',
    webhookUuid: 'd9e0f1a2-b3c4-4d5e-6f7a-8b9c0d1e2f3a',
    description: 'Controlador QC. Genera checklists de calidad ad-hoc segun la fase y tipo de obra (8-15 items por fase).',
    extraLoads: [
      { name: 'Load Design', query: "SELECT id, title, intervention_logic FROM design_options WHERE project_id = $1::uuid AND status = 'selected' LIMIT 1" },
      { name: 'Load Trades', query: "SELECT trade_type, description FROM trade_requests WHERE project_id = $1::uuid" }
    ],
    userPromptTpl: `const design = rows_0[0] || null;\nconst trades = rows_1;\nconst phase = sess.body?.phase || project.current_phase;\nconst systemPrompt = \`Eres agent_qc_checklists. Generas checklists de control de calidad para una fase concreta de obra.\\nFASES Y FOCOS:\\n- demolicion: residuos, certificado RCD, integridad estructural\\n- albanileria: alineamientos, niveles, ventilaciones\\n- instalaciones: pruebas estanqueidad fontaneria, aislamiento electrico, gas\\n- pavimentos: nivelacion, juntas, transiciones materiales\\n- pintura: imprimacion, capas, repasos\\n- entrega: documentacion, certificados, fotos as-built\\n8-15 items por checklist, con criterio aprobacion y herramienta verificacion.\\nDEVUELVE SOLO JSON.\`;\nconst userPrompt = \`PROYECTO: \${project.name}\\nFASE OBJETIVO: \${phase}\\nDESIGN: \${design ? design.title + ' — ' + (design.intervention_logic || '').slice(0,300) : '(sin design)'}\\nTRADES: \${JSON.stringify(trades.map(t => t.trade_type))}\\n\\nGenera checklist QC para fase \\\"\${phase}\\\".\\n\\nOUTPUT JSON:\\n{ \"phase\": \"\${phase}\", \"items\": [{ \"id\": 1, \"description\": \"...\", \"criteria\": \"...\", \"tool\": \"vista|medicion|prueba\", \"critical\": true }], \"notes\": \"...\" }\`;`,
    outputShape: `const outputObj = parsed;\nconst summaryObj = { phase: parsed.phase, items_count: (parsed.items || []).length, critical_count: (parsed.items || []).filter(i => i.critical).length };`,
    insertQuery: "INSERT INTO qc_checks (project_id, phase, items, status) VALUES ($1::uuid, $2::text, $3::jsonb, 'pending') RETURNING id",
    insertParams: "={{ [$json.project_id, $json.output.phase, JSON.stringify($json.output.items || [])] }}",
    dataSummary: "{ project_id: $('Format Response').first().json.project_id, phase: $('Format Response').first().json.output.phase, items_count: ($('Format Response').first().json.output.items || []).length, items: $('Format Response').first().json.output.items, notes: $('Format Response').first().json.output.notes }"
  },
  {
    name: 'trade_comms',
    path: 'api/v1/agents/trade-comms/request-quote',
    idPrefix: 'atc',
    webhookUuid: 'e0f1a2b3-c4d5-4e6f-7a8b-9c0d1e2f3a4b',
    description: 'Comunicador con Gremios. Genera mensaje formal de solicitud de presupuesto para un trade_request concreto, incluye webhook_token para que el gremio devuelva su quote.',
    extraLoads: [
      { name: 'Load Trade Request', query: "SELECT id, trade_type, description, quantity_units, expected_budget_eur, urgency FROM trade_requests WHERE id = $1::uuid LIMIT 1", params: "={{ [$json.body?.trade_request_id || '00000000-0000-0000-0000-000000000000'] }}" }
    ],
    userPromptTpl: `const tradeReq = rows_0[0] || null;\nif (!tradeReq) return [{ json: { _error: 'TRADE_REQUEST_NOT_FOUND', _status: 404, _details: 'body.trade_request_id no existe', request_id: sess.request_id }}];\nconst systemPrompt = \`Eres agent_trade_comms. Generas un mensaje formal y educado al gremio para pedir su presupuesto.\\nTono: profesional, claro, sin tecnicismos innecesarios. Espanol.\\nESTRUCTURA: 1) saludo, 2) descripcion obra, 3) detalle especifico de su especialidad, 4) plazos, 5) instrucciones para enviar quote, 6) firma del estudio.\\nDEVUELVE SOLO JSON.\`;\nconst userPrompt = \`PROYECTO: \${project.name}\\nUBICACION: \${project.location_city}, \${project.location_province}\\nTRADE REQUEST:\\n- Tipo: \${tradeReq.trade_type}\\n- Descripcion: \${tradeReq.description}\\n- Cantidades: \${JSON.stringify(tradeReq.quantity_units)}\\n- Budget esperado: \${tradeReq.expected_budget_eur} EUR\\n- Urgencia: \${tradeReq.urgency}\\n\\nGenera mensaje formal.\\n\\nOUTPUT JSON:\\n{ \"subject\": \"...\", \"message\": \"...\", \"deadline_days\": 7 }\`;`,
    outputShape: `const outputObj = parsed;\nconst summaryObj = { trade_type: $('Build Prompt').first().json.body?.trade_request_id ? 'present' : 'missing', message_len: (parsed.message || '').length };`,
    insertQuery: "INSERT INTO trade_quotes (project_id, trade_request_id, status, request_message, webhook_token) VALUES ($1::uuid, $2::uuid, 'requested', $3::text, encode(gen_random_bytes(16), 'hex')) RETURNING id, webhook_token",
    insertParams: "={{ [$json.project_id, $json.body?.trade_request_id, $json.output.message] }}",
    dataSummary: "{ project_id: $('Format Response').first().json.project_id, trade_quote_id: $('Insert Target').first().json.id, webhook_token: $('Insert Target').first().json.webhook_token, subject: $('Format Response').first().json.output.subject, message: $('Format Response').first().json.output.message, deadline_days: $('Format Response').first().json.output.deadline_days }"
  },
  {
    name: 'aftercare',
    path: 'api/v1/agents/aftercare/triage',
    idPrefix: 'aac',
    webhookUuid: 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
    description: 'Postventa. Triaje de incidencias post-entrega LOE (1 ano acabados, 3 anos habitabilidad, 10 anos estructura). Clasifica gravedad y responsable.',
    extraLoads: [],
    userPromptTpl: `const incidentText = (sess.body?.incident_description || '').trim();\nconst monthsSinceDelivery = sess.body?.months_since_delivery || null;\nif (!incidentText) return [{ json: { _error: 'NO_INCIDENT', _status: 400, _details: 'falta body.incident_description', request_id: sess.request_id }}];\nconst systemPrompt = \`Eres agent_aftercare. Procesas incidencias post-entrega segun LOE espanola:\\n- LOE 1 ano: acabados (pintura, rodapies, sellados)\\n- LOE 3 anos: habitabilidad (humedades, aislamiento, instalaciones)\\n- LOE 10 anos: estructura (grietas estructurales, asentamientos)\\nDecide: cubierto_por_LOE (true/false), garantia_aplicable (1y|3y|10y|none), gravedad (low/medium/high/critical), responsable (estudio|gremio|cliente|seguro), accion_inmediata.\\nDEVUELVE SOLO JSON.\`;\nconst userPrompt = \`PROYECTO: \${project.name}\\nMESES DESDE ENTREGA: \${monthsSinceDelivery ?? '?'}\\n\\nINCIDENCIA REPORTADA POR EL CLIENTE:\\n\${incidentText}\\n\\nTriajea.\\n\\nOUTPUT JSON:\\n{ \"cubierto_por_loe\": true, \"garantia_aplicable\": \"3y\", \"gravedad\": \"medium\", \"responsable\": \"gremio\", \"accion_inmediata\": \"...\", \"plazo_respuesta_dias\": 7, \"summary\": \"...\" }\`;`,
    extraReturnFields: 'incident_description: $json.body?.incident_description || null, months_since_delivery: $json.body?.months_since_delivery || null,',
    outputShape: `const outputObj = parsed;\nconst summaryObj = { gravedad: parsed.gravedad, cubierto_por_loe: parsed.cubierto_por_loe, responsable: parsed.responsable };`,
    insertQuery: "INSERT INTO aftercare_incidents (project_id, incident_description, cubierto_por_loe, garantia_aplicable, gravedad, responsable, accion_inmediata, status) VALUES ($1::uuid, $2::text, $3::boolean, $4::text, $5::text, $6::text, $7::text, 'triaged') RETURNING id",
    insertParams: "={{ [$json.project_id, $json.body?.incident_description || '', $json.output.cubierto_por_loe ?? false, $json.output.garantia_aplicable || 'none', $json.output.gravedad || 'low', $json.output.responsable || 'estudio', $json.output.accion_inmediata || ''] }}",
    dataSummary: "{ project_id: $('Format Response').first().json.project_id, incident_id: $('Insert Target').first().json.id, ...$('Format Response').first().json.output }"
  }
];

// =============================================================================
// EJECUTAR: generar JSON + POST a n8n + activar
// =============================================================================

const results = [];
for (const cfg of AGENTS) {
  const wf = buildWorkflow(cfg);
  fs.writeFileSync(`${ROOT}\\studio-multiagente\\workflows\\agent_${cfg.name}.json`, JSON.stringify(wf, null, 2));
  try {
    const r = await fetch('https://n8n-n8n.zzeluw.easypanel.host/api/v1/workflows', {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings || {} })
    });
    const d = await r.json();
    if (d.id) {
      // Activar
      const r2 = await fetch(`https://n8n-n8n.zzeluw.easypanel.host/api/v1/workflows/${d.id}/activate`, {
        method: 'POST', headers: { 'X-N8N-API-KEY': apiKey }
      });
      const d2 = await r2.json().catch(() => ({}));
      results.push({ name: cfg.name, id: d.id, active: d2.active ?? '?', error: null });
    } else {
      results.push({ name: cfg.name, id: null, active: false, error: d.message || JSON.stringify(d).slice(0, 200) });
    }
  } catch (e) {
    results.push({ name: cfg.name, id: null, active: false, error: e.message });
  }
  // Pausa breve entre llamadas
  await new Promise(r => setTimeout(r, 500));
}

console.log('\n=== RESULTS ===');
for (const r of results) {
  console.log(`${r.name.padEnd(25)} id=${(r.id || 'FAIL').padEnd(20)} active=${r.active}${r.error ? ' err=' + r.error : ''}`);
}
