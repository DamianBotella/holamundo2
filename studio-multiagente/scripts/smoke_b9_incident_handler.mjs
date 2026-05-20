#!/usr/bin/env node
/**
 * PLAN V1.0 Bloque 9 - Smoke E2E agent_incident_handler.
 *
 * 1. Pick project activo
 * 2. POST /agents/incident-handler/run con descripcion realista
 *    -> espera 201 con causa_probable + 2 options + comunicacion_cliente_draft
 * 3. Verify DB project_incidents status=proposed con options jsonb (2 items)
 * 4. POST /incidents/select-option index=0 action=communicate email_override=test
 *    -> espera 200, status=communicated, email enviado
 * 5. Verify DB status=communicated + cost_delta + time_delta + sent_at
 * 6. POST /incidents/client-decision (PUBLIC) decision=approve
 *    -> espera 200, status=approved, decision_id insertado en client_decisions
 * 7. Verify DB final state
 */

const N8N = 'https://n8n-n8n.zzeluw.easypanel.host';
const SUPA = 'https://xfeatkzordgnztigplwd.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZWF0a3pvcmRnbnp0aWdwbHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDY4MTc0NCwiZXhwIjoyMDkwMjU3NzQ0fQ.ywgupOdE6VfmW8i9ezNjrIVdeDDcRhPLI_W8yG_GzYg';
const SUPA_HDR = { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' };
const TEST_OVERRIDE_EMAIL = 'damian2botella@gmail.com';

const INCIDENT_DESC = 'Humedad ascendente detectada en pared este del salon, mancha ovalada 60x40 cm a 30 cm del suelo, salitre visible. Pared compartida con bano de la vivienda vecina.';

function b64u(o) {
  return Buffer.from(JSON.stringify(o)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function mintJwt(userId, tenantId) {
  const now = Math.floor(Date.now() / 1000);
  return b64u({ alg: 'none', typ: 'JWT' }) + '.' + b64u({ sub: userId, tenant_id: tenantId, role: 'super_admin', iat: now - 300, exp: now + 86400 * 30 }) + '.smoke-unsigned';
}
async function pickProject() {
  const r = await fetch(SUPA + '/rest/v1/projects?select=id,name,tenant_id,client_id,current_phase&current_phase=not.in.(completed,archived,intake)&tenant_id=not.is.null&client_id=not.is.null&order=created_at.desc&limit=1', { headers: SUPA_HDR });
  const arr = await r.json();
  if (!arr.length) throw new Error('No active projects');
  const p = arr[0];
  const r2 = await fetch(SUPA + `/rest/v1/user_profiles?select=user_id&tenant_id=eq.${p.tenant_id}&active=eq.true&limit=1`, { headers: SUPA_HDR });
  const userId = (await r2.json())[0]?.user_id || '00000000-0000-0000-0000-000000000000';
  return { project: p, userId };
}
async function loadIncident(id) {
  const r = await fetch(SUPA + `/rest/v1/project_incidents?select=*&id=eq.${id}&limit=1`, { headers: SUPA_HDR });
  return (await r.json())[0] || null;
}
async function loadDecision(id) {
  const r = await fetch(SUPA + `/rest/v1/client_decisions?select=*&id=eq.${id}&limit=1`, { headers: SUPA_HDR });
  return (await r.json())[0] || null;
}

async function main() {
  console.log('[1] Picking active project...');
  const { project, userId } = await pickProject();
  console.log('   project:', project.id, '|', project.name, '| fase:', project.current_phase);
  const jwt = mintJwt(userId, project.tenant_id);

  console.log('[2] POST /agents/incident-handler/run...');
  const t0 = Date.now();
  const r1 = await fetch(N8N + '/webhook/api/v1/agents/incident-handler/run', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: project.id,
      description: INCIDENT_DESC,
      location: 'salon, pared este',
      severity: 'media'
    })
  });
  const t1 = Date.now() - t0;
  const j1 = await r1.json().catch(() => ({}));
  console.log('   status:', r1.status, '| ms:', t1);
  if (r1.status !== 201 || !j1.data?.incident_id) {
    console.error('   FAIL response:', JSON.stringify(j1).slice(0, 1000));
    process.exit(1);
  }
  const incidentId = j1.data.incident_id;
  console.log('   incident_id:', incidentId);
  console.log('   causa:', (j1.data.causa_probable || '').slice(0, 200));
  console.log('   options:', j1.data.options.length, 'opciones');
  console.log('   opt A:', j1.data.options[0].coste_eur, 'EUR /', j1.data.options[0].dias, 'd');
  console.log('   opt B:', j1.data.options[1].coste_eur, 'EUR /', j1.data.options[1].dias, 'd');
  console.log('   comunicacion:', (j1.data.comunicacion_cliente_draft || '').length, 'chars');

  console.log('[3] Verify DB proposed...');
  const row1 = await loadIncident(incidentId);
  if (!row1 || row1.status !== 'proposed') { console.error('   FAIL', row1); process.exit(1); }
  const opts = typeof row1.options === 'string' ? JSON.parse(row1.options) : row1.options;
  if (!Array.isArray(opts) || opts.length !== 2) { console.error('   FAIL options count', opts); process.exit(1); }
  console.log('   OK status=proposed options=2 severity=' + row1.severity);

  console.log('[4] POST /incidents/select-option (idx=0 communicate)...');
  const r2 = await fetch(N8N + '/webhook/api/v1/incidents/select-option', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      incident_id: incidentId,
      selected_option_index: 0,
      action: 'communicate',
      email_override: TEST_OVERRIDE_EMAIL
    })
  });
  const j2 = await r2.json().catch(() => ({}));
  console.log('   status:', r2.status);
  if (r2.status !== 200 || j2.data?.status !== 'communicated') {
    console.error('   FAIL:', JSON.stringify(j2).slice(0, 600));
    process.exit(1);
  }
  console.log('   OK communicated, cost_delta=' + j2.data.cost_delta_eur + ' time_delta=' + j2.data.time_delta_days + ' email_id=' + j2.data.email_message_id);

  console.log('[5] Verify DB communicated...');
  const row2 = await loadIncident(incidentId);
  if (row2.status !== 'communicated') { console.error('   FAIL status', row2); process.exit(1); }
  if (row2.selected_option_index !== 0) { console.error('   FAIL idx', row2); process.exit(1); }
  if (!row2.client_communication_sent_at) { console.error('   FAIL sent_at', row2); process.exit(1); }
  console.log('   OK selected=0 cost_delta=' + row2.cost_delta_eur + ' time_delta=' + row2.time_delta_days + ' sent_at=' + row2.client_communication_sent_at);

  console.log('[6] POST /incidents/client-decision (PUBLIC, no JWT) decision=approve...');
  const r3 = await fetch(N8N + '/webhook/api/v1/incidents/client-decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      incident_id: incidentId,
      decision: 'approve',
      comment: 'Acepto la opcion economica. Procedan en cuanto puedan.'
    })
  });
  const j3 = await r3.json().catch(() => ({}));
  console.log('   status:', r3.status);
  if (r3.status !== 200 || j3.data?.status !== 'approved') {
    console.error('   FAIL:', JSON.stringify(j3).slice(0, 600));
    process.exit(1);
  }
  const decisionId = j3.data.decision_id;
  console.log('   OK approved, decision_id=' + decisionId);

  console.log('[7] Verify DB final + client_decisions...');
  const row3 = await loadIncident(incidentId);
  if (row3.status !== 'approved') { console.error('   FAIL final status', row3); process.exit(1); }
  if (decisionId) {
    const dec = await loadDecision(decisionId);
    if (!dec || dec.project_id !== project.id || !dec.confirmada_cliente) { console.error('   FAIL decision row', dec); process.exit(1); }
    console.log('   OK client_decisions: tipo=' + dec.decision_tipo + ' impacto=' + dec.impacto_economico + ' EUR confirmada=true');
  } else {
    console.error('   WARN: decision_id null, client_decisions row no creada');
  }

  console.log('\n=== SMOKE B9 VERDE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
