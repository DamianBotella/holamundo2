#!/usr/bin/env node
/**
 * PLAN V1.0 Bloque 8 - Smoke E2E agent_client_update.
 *
 * 1. Picks 1 project activo (no archived/completed/intake) y su tenant
 * 2. Mintea JWT unsigned tipo super_admin (backend solo decodifica)
 * 3. POST /api/v1/agents/client-update/run -> espera 201 con update_id
 * 4. Verifica DB client_weekly_updates status=draft + summary >= 50 chars
 * 5. POST /api/v1/client-updates/approve action=approve email_override=test -> espera 200
 * 6. Verifica DB status=sent + email_message_id no nulo
 * 7. (Idempotencia) re-corre paso 3 -> mismo update_id (ON CONFLICT), pero status vuelve a draft
 */

const N8N = 'https://n8n-n8n.zzeluw.easypanel.host';
const SUPA = 'https://xfeatkzordgnztigplwd.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZWF0a3pvcmRnbnp0aWdwbHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDY4MTc0NCwiZXhwIjoyMDkwMjU3NzQ0fQ.ywgupOdE6VfmW8i9ezNjrIVdeDDcRhPLI_W8yG_GzYg';

const SUPA_HDR = { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' };

// Email de override para no spamear a clientes reales
const TEST_OVERRIDE_EMAIL = 'damian2botella@gmail.com';

function b64u(o) {
  return Buffer.from(JSON.stringify(o)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function mintJwt(userId, tenantId, role = 'super_admin') {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'none', typ: 'JWT' };
  const payload = { sub: userId, tenant_id: tenantId, role, iat: now - 300, exp: now + 86400 * 30 };
  return b64u(header) + '.' + b64u(payload) + '.smoke-unsigned';
}

async function pickProject() {
  // Buscar 1 project activo
  const url = SUPA + '/rest/v1/projects?select=id,name,tenant_id,client_id,current_phase&current_phase=not.in.(completed,archived,intake)&tenant_id=not.is.null&client_id=not.is.null&order=created_at.desc&limit=1';
  const r = await fetch(url, { headers: SUPA_HDR });
  const arr = await r.json();
  if (!arr.length) throw new Error('No hay projects activos en la BD para smoke');
  const p = arr[0];
  // Buscar user_id del tenant (architect/super_admin)
  const r2 = await fetch(SUPA + `/rest/v1/user_profiles?select=user_id,role,email&tenant_id=eq.${p.tenant_id}&active=eq.true&order=role.asc&limit=1`, { headers: SUPA_HDR });
  const users = await r2.json();
  const userId = users[0]?.user_id || '00000000-0000-0000-0000-000000000000';
  // Buscar email del cliente (solo para info)
  const r3 = await fetch(SUPA + `/rest/v1/clients?select=email,name&id=eq.${p.client_id}&limit=1`, { headers: SUPA_HDR });
  const cli = (await r3.json())[0] || {};
  return { project: p, userId, clientEmail: cli.email, clientName: cli.name };
}

async function loadUpdate(updateId) {
  const r = await fetch(SUPA + `/rest/v1/client_weekly_updates?select=*&id=eq.${updateId}&limit=1`, { headers: SUPA_HDR });
  return (await r.json())[0] || null;
}

async function main() {
  console.log('[1] Picking active project...');
  const { project, userId, clientEmail, clientName } = await pickProject();
  console.log('   project:', project.id, '|', project.name, '| fase:', project.current_phase);
  console.log('   tenant:', project.tenant_id, '| user:', userId);
  console.log('   client:', clientName, '<' + clientEmail + '>');

  const jwt = mintJwt(userId, project.tenant_id);
  console.log('[2] JWT minted (sub=' + userId.slice(0, 8) + '..., tenant=' + project.tenant_id.slice(0, 8) + '...)');

  console.log('[3] POST /agents/client-update/run...');
  const t0 = Date.now();
  const r1 = await fetch(N8N + '/webhook/api/v1/agents/client-update/run', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: project.id })
  });
  const t1 = Date.now() - t0;
  const j1 = await r1.json().catch(() => ({}));
  console.log('   status:', r1.status, '| ms:', t1);
  console.log('   body:', JSON.stringify(j1).slice(0, 800));
  if (r1.status !== 201 || !j1.data?.update_id) {
    console.error('   FAIL: no se devolvio update_id 201');
    process.exit(1);
  }
  const updateId = j1.data.update_id;
  console.log('   update_id:', updateId, '| summary chars:', (j1.data.summary_text || '').length);

  console.log('[4] Verify DB draft...');
  const row1 = await loadUpdate(updateId);
  if (!row1 || row1.status !== 'draft') { console.error('   FAIL: row no draft', row1); process.exit(1); }
  if (!row1.summary_text || row1.summary_text.length < 50) { console.error('   FAIL: summary corto', row1.summary_text); process.exit(1); }
  console.log('   OK status=draft summary=' + row1.summary_text.length + ' chars approved_by=null');

  console.log('[5] POST /client-updates/approve (action=approve, email_override=' + TEST_OVERRIDE_EMAIL + ')...');
  const r2 = await fetch(N8N + '/webhook/api/v1/client-updates/approve', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_id: updateId, action: 'approve', email_override: TEST_OVERRIDE_EMAIL })
  });
  const j2 = await r2.json().catch(() => ({}));
  console.log('   status:', r2.status);
  console.log('   body:', JSON.stringify(j2).slice(0, 600));
  if (r2.status !== 200 || j2.data?.status !== 'sent') {
    console.error('   FAIL: no se marco como sent');
    process.exit(1);
  }

  console.log('[6] Verify DB sent...');
  const row2 = await loadUpdate(updateId);
  if (!row2 || row2.status !== 'sent') { console.error('   FAIL: row no sent', row2); process.exit(1); }
  if (!row2.email_message_id) { console.error('   FAIL: sin email_message_id', row2); process.exit(1); }
  if (!row2.sent_at) { console.error('   FAIL: sin sent_at', row2); process.exit(1); }
  console.log('   OK status=sent email_id=' + row2.email_message_id + ' sent_at=' + row2.sent_at);

  console.log('[7] Idempotencia: re-corre el draft (debe quedar mismo update_id pero status vuelve a draft)');
  const r3 = await fetch(N8N + '/webhook/api/v1/agents/client-update/run', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: project.id })
  });
  const j3 = await r3.json().catch(() => ({}));
  if (r3.status !== 201) { console.error('   FAIL re-run status', r3.status, j3); process.exit(1); }
  if (j3.data?.update_id !== updateId) {
    console.error('   FAIL: update_id distinto, UNIQUE no funciona', updateId, 'vs', j3.data?.update_id);
    process.exit(1);
  }
  const row3 = await loadUpdate(updateId);
  if (row3.status !== 'draft' || row3.sent_at !== null) {
    console.error('   FAIL: ON CONFLICT no resetea status/sent_at', row3);
    process.exit(1);
  }
  console.log('   OK mismo update_id, status reseteado a draft');

  console.log('\n=== SMOKE B8 VERDE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
