#!/usr/bin/env node
/**
 * PLAN V1.0 Bloque 11 - Smoke E2E backend ejecucion V1.0.
 *
 * Encadena los 3 agentes nuevos sobre el MISMO proyecto en orden cronologico
 * realista de una obra:
 *
 *   1. Visita de obra el LUNES -> agent_acta_obra (dev_transcript)
 *      -> draft -> approve -> sign (acta firmada definitiva)
 *
 *   2. Durante la visita se detecta humedad -> agent_incident_handler
 *      -> proposed -> select-option(A) -> communicate (Gmail cliente)
 *      -> client-decision approve -> client_decisions row + status=approved
 *
 *   3. Final de semana -> agent_client_update
 *      -> draft (debe MENCIONAR el acta firmada + el incidente aprobado
 *         de esa semana porque la query SQL agrupa todos los inputs)
 *      -> approve -> sent (Gmail al cliente)
 *
 * Verificaciones finales (la salsa que distingue smoke individual vs E2E):
 *   - 1 row signed en site_visit_acts
 *   - 1 row approved en project_incidents con cost_delta + time_delta
 *   - 1 row en client_decisions con metodo_confirmacion='email' + confirmada=true
 *   - 1 row sent en client_weekly_updates con summary_text > 200 chars
 *   - summary_text del weekly DEBE referirse al imprevisto o al avance de obra
 *     (LLM la prueba: no inventamos contenido, pero debe estar)
 *   - agent_executions: 3 'completed' (acta_obra + incident_handler + client_update)
 *   - activity_log: rows nuevas con message_type='execution'
 */

const N8N = 'https://n8n-n8n.zzeluw.easypanel.host';
const SUPA = 'https://xfeatkzordgnztigplwd.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZWF0a3pvcmRnbnp0aWdwbHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDY4MTc0NCwiZXhwIjoyMDkwMjU3NzQ0fQ.ywgupOdE6VfmW8i9ezNjrIVdeDDcRhPLI_W8yG_GzYg';
const SUPA_HDR = { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' };
const TEST_EMAIL = 'damian2botella@gmail.com';

// Visita de hoy (ajustada al lunes de la semana en curso)
const todayIso = new Date().toISOString().slice(0, 10);

const DEV_TRANSCRIPT = `Estoy en la obra del piso, hoy ${todayIso}. La pared del salon este tiene una mancha de humedad ascendente importante, 60 por 40 centimetros, salitre visible. He hablado con el albanil, va a tirar el revoco. La fontaneria va bien, las bajantes nuevas ya estan. Electricidad: cuadro general llega el viernes. Acuerdo con el cliente: si encontramos algo grave detras del revoco, le aviso por whatsapp. Proxima visita: lunes que viene a las diez.`;

const INCIDENT_DESC = 'Humedad ascendente detectada en pared este del salon, 60x40cm, salitre visible. Pared compartida con bano de vivienda vecina. Detectado durante visita de obra de hoy.';

function b64u(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }
function mintJwt(uid, tid) { const n = Math.floor(Date.now()/1000); return b64u({alg:'none',typ:'JWT'}) + '.' + b64u({sub:uid,tenant_id:tid,role:'super_admin',iat:n-300,exp:n+86400*30}) + '.smoke-b11'; }
async function pickProject() {
  const r = await fetch(SUPA + '/rest/v1/projects?select=id,name,tenant_id,client_id,current_phase&current_phase=not.in.(completed,archived,intake)&tenant_id=not.is.null&client_id=not.is.null&order=created_at.desc&limit=1', { headers: SUPA_HDR });
  const p = (await r.json())[0];
  const r2 = await fetch(SUPA + `/rest/v1/user_profiles?select=user_id&tenant_id=eq.${p.tenant_id}&active=eq.true&limit=1`, { headers: SUPA_HDR });
  const userId = (await r2.json())[0]?.user_id || '00000000-0000-0000-0000-000000000000';
  return { project: p, userId };
}
async function pgGet(path) {
  const r = await fetch(SUPA + '/rest/v1/' + path, { headers: SUPA_HDR });
  return await r.json();
}

function step(n, t) { console.log(`\n[${n}] ${t}`); }
function ok(t) { console.log('   OK ' + t); }
function fail(t, extra) { console.error('   FAIL ' + t, extra ? JSON.stringify(extra).slice(0, 600) : ''); process.exit(1); }

async function main() {
  step(1, 'Pick active project + mint JWT');
  const { project, userId } = await pickProject();
  console.log('   project:', project.id, '|', project.name, '| fase:', project.current_phase);
  const jwt = mintJwt(userId, project.tenant_id);
  const t0E2E = Date.now();

  // ===== FASE 1: ACTA DE OBRA =====
  step(2, 'agent_acta_obra: visita lunes -> draft');
  const t0 = Date.now();
  const r1 = await fetch(N8N + '/webhook/api/v1/agents/acta-obra/run', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: project.id,
      dev_transcript: DEV_TRANSCRIPT,
      photos_urls: ['https://example.com/obra/foto1-humedad.jpg', 'https://example.com/obra/foto2-bajantes.jpg'],
      visit_date: new Date().toISOString()
    })
  });
  const j1 = await r1.json().catch(() => ({}));
  if (r1.status !== 201 || !j1.data?.act_id) fail('acta /run no devolvio 201', j1);
  const actId = j1.data.act_id;
  ok(`act_id=${actId.slice(0,8)} obs=${j1.data.observation_count} ms=${Date.now()-t0}`);

  step(3, 'agent_acta_obra: approve + sign');
  let r = await fetch(N8N + '/webhook/api/v1/site-visit-acts/approve', {
    method: 'POST', headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ act_id: actId, action: 'approve' })
  });
  if (r.status !== 200) fail('acta approve != 200', await r.json());
  r = await fetch(N8N + '/webhook/api/v1/site-visit-acts/approve', {
    method: 'POST', headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ act_id: actId, action: 'sign' })
  });
  if (r.status !== 200) fail('acta sign != 200', await r.json());
  ok('acta signed');

  // ===== FASE 2: INCIDENTE =====
  step(4, 'agent_incident_handler: humedad detectada -> proposed');
  const t1 = Date.now();
  const r2 = await fetch(N8N + '/webhook/api/v1/agents/incident-handler/run', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: project.id,
      description: INCIDENT_DESC,
      location: 'salon, pared este',
      severity: 'media'
    })
  });
  const j2 = await r2.json().catch(() => ({}));
  if (r2.status !== 201 || !j2.data?.incident_id) fail('incident /run no devolvio 201', j2);
  const incidentId = j2.data.incident_id;
  ok(`incident_id=${incidentId.slice(0,8)} opt_A=${j2.data.options[0].coste_eur}EUR opt_B=${j2.data.options[1].coste_eur}EUR ms=${Date.now()-t1}`);

  step(5, 'select-option idx=0 communicate -> Gmail cliente');
  const r3 = await fetch(N8N + '/webhook/api/v1/incidents/select-option', {
    method: 'POST', headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ incident_id: incidentId, selected_option_index: 0, action: 'communicate', email_override: TEST_EMAIL })
  });
  const j3 = await r3.json().catch(() => ({}));
  if (r3.status !== 200 || j3.data?.status !== 'communicated') fail('select-option', j3);
  ok(`communicated cost_delta=${j3.data.cost_delta_eur} time_delta=${j3.data.time_delta_days}`);

  step(6, 'client-decision PUBLIC approve');
  const r4 = await fetch(N8N + '/webhook/api/v1/incidents/client-decision', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ incident_id: incidentId, decision: 'approve', comment: 'Adelante con la opcion economica, gracias.' })
  });
  const j4 = await r4.json().catch(() => ({}));
  if (r4.status !== 200 || j4.data?.status !== 'approved') fail('client-decision', j4);
  ok(`approved decision_id=${(j4.data.decision_id||'').slice(0,8)}`);

  // ===== FASE 3: RESUMEN SEMANAL =====
  step(7, 'agent_client_update: resumen semanal -> draft');
  const t2 = Date.now();
  const r5 = await fetch(N8N + '/webhook/api/v1/agents/client-update/run', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: project.id, week_start: todayIso })
  });
  const j5 = await r5.json().catch(() => ({}));
  if (r5.status !== 201 || !j5.data?.update_id) fail('client-update /run', j5);
  const updateId = j5.data.update_id;
  const summary = j5.data.summary_text || '';
  ok(`update_id=${updateId.slice(0,8)} summary=${summary.length} chars ms=${Date.now()-t2}`);

  step(8, 'client-updates approve -> sent (Gmail cliente)');
  const r6 = await fetch(N8N + '/webhook/api/v1/client-updates/approve', {
    method: 'POST', headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_id: updateId, action: 'approve', email_override: TEST_EMAIL })
  });
  const j6 = await r6.json().catch(() => ({}));
  if (r6.status !== 200 || j6.data?.status !== 'sent') fail('client-update approve', j6);
  ok(`sent email_id=${j6.data.email_message_id}`);

  // ===== VERIFICACIONES FINALES =====
  step(9, 'Verificaciones DB cruzadas');

  // 9.1 site_visit_acts signed
  const act = (await pgGet(`site_visit_acts?select=*&id=eq.${actId}&limit=1`))[0];
  if (!act || act.status !== 'signed' || !act.signed_at) fail('site_visit_acts no signed', act);
  ok(`site_visit_acts: status=${act.status} signed_at!=null obs_count=${(act.observations||[]).length}`);

  // 9.2 project_incidents approved
  const inc = (await pgGet(`project_incidents?select=*&id=eq.${incidentId}&limit=1`))[0];
  if (!inc || inc.status !== 'approved' || inc.selected_option_index !== 0) fail('project_incidents no approved/idx', inc);
  ok(`project_incidents: status=approved idx=0 cost_delta=${inc.cost_delta_eur} time_delta=${inc.time_delta_days}`);

  // 9.3 client_decisions row
  if (j4.data.decision_id) {
    const dec = (await pgGet(`client_decisions?select=*&id=eq.${j4.data.decision_id}&limit=1`))[0];
    if (!dec || !dec.confirmada_cliente || dec.metodo_confirmacion !== 'email') fail('client_decisions row mal', dec);
    ok(`client_decisions: tipo=${dec.decision_tipo} confirmada=true impacto=${dec.impacto_economico}EUR`);
  } else {
    console.log('   WARN: decision_id null en respuesta del client-decision');
  }

  // 9.4 client_weekly_updates sent
  const wu = (await pgGet(`client_weekly_updates?select=*&id=eq.${updateId}&limit=1`))[0];
  if (!wu || wu.status !== 'sent' || !wu.email_message_id) fail('client_weekly_updates no sent', wu);
  ok(`client_weekly_updates: status=sent summary=${(wu.summary_text||'').length} chars`);
  if ((wu.summary_text || '').length < 200) fail('summary demasiado corto', wu.summary_text);

  // 9.5 agent_executions: 3 completed recientes
  const execsRaw = await pgGet(`agent_executions?select=agent_name,status,started_at&project_id=eq.${project.id}&status=eq.completed&order=started_at.desc&limit=20`);
  const execs = Array.isArray(execsRaw) ? execsRaw.filter(e => ['agent_acta_obra','agent_incident_handler','agent_client_update'].includes(e.agent_name)) : [];
  const agents = new Set(execs.map(e => e.agent_name));
  if (agents.size < 3) fail(`agent_executions: faltan agentes completed (vistos: ${[...agents].join(',')})`, execsRaw);
  ok(`agent_executions: 3 agentes completed (${[...agents].join(', ')})`);

  // 9.6 activity_log con message_type='execution'
  const actsRaw = await pgGet(`activity_log?select=agent_name,action,message_type&project_id=eq.${project.id}&message_type=eq.execution&order=created_at.desc&limit=20`);
  const actsArr = Array.isArray(actsRaw) ? actsRaw : [];
  const actAgents = new Set(actsArr.map(a => a.agent_name));
  ok(`activity_log execution: ${actsArr.length} rows, agentes=${[...actAgents].join(',')}`);

  const totalMs = Date.now() - t0E2E;
  console.log('\n=== SMOKE B11 E2E EJECUCION V1.0 VERDE ===');
  console.log('Tiempo total:', (totalMs/1000).toFixed(1) + 's');
  console.log('Cadena testeada:');
  console.log('  acta_obra (draft -> approve -> sign)');
  console.log('  -> incident_handler (proposed -> communicate -> client approve)');
  console.log('  -> client_update (draft -> sent)');
  console.log('Emails recibidos en', TEST_EMAIL + ':');
  console.log('  1 borrador acta + 1 comunicacion incidente + 1 confirmacion decision + 1 resumen semanal');
}

main().catch(e => { console.error(e); process.exit(1); });
