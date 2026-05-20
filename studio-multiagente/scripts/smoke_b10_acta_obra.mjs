#!/usr/bin/env node
/**
 * PLAN V1.0 Bloque 10 - Smoke E2E agent_acta_obra (via dev_transcript bypass).
 *
 * 1. Pick project activo
 * 2. POST /agents/acta-obra/run con dev_transcript realista (5 gremios + acuerdos + proxima_visita)
 *    -> espera 201 con act_id + observaciones >= 4 + acuerdos no vacios
 * 3. Verify DB site_visit_acts status=draft + transcript_categorized
 * 4. POST /site-visit-acts/approve action=approve -> espera 200, status=approved
 * 5. POST /site-visit-acts/approve action=sign -> espera 200, status=signed signed_at!=null
 * 6. Verify DB final state
 * 7. (Negative) POST approve sobre signed -> espera 409
 */

const N8N = 'https://n8n-n8n.zzeluw.easypanel.host';
const SUPA = 'https://xfeatkzordgnztigplwd.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZWF0a3pvcmRnbnp0aWdwbHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDY4MTc0NCwiZXhwIjoyMDkwMjU3NzQ0fQ.ywgupOdE6VfmW8i9ezNjrIVdeDDcRhPLI_W8yG_GzYg';
const SUPA_HDR = { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' };

const DEV_TRANSCRIPT = `Estoy en la obra del piso de Embajadores, lunes 18 de mayo de 2026, sobre las diez y media de la manana. La pared del salon este lleva la mancha de humedad de la que hablabamos la semana pasada. La foto 1 la muestra clara, el salitre ya esta bajando. He hablado con el albanil, va a tirar el revoco esta semana y vamos a ver que hay detras. La fontaneria va bien, las bajantes nuevas instaladas ayer estan correctas, eso lo ve en la foto 2. Electricidad: el cuadro general llega el viernes, el electricista pasara el lunes que viene a montarlo. Carpinteria: las puertas estan pendientes de aprobacion del cliente, recordar enviarle el catalogo. Acuerdo con el cliente: si encontramos algo grave detras del revoco, le aviso por whatsapp el mismo dia. Proxima visita prevista: lunes 25 de mayo a las diez de la manana.`;

const PHOTOS = [
  'https://example.com/obra/embajadores/2026-05-18/foto1-humedad-salon-este.jpg',
  'https://example.com/obra/embajadores/2026-05-18/foto2-bajantes-nuevas.jpg'
];

function b64u(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }
function mintJwt(uid, tid) { const n = Math.floor(Date.now()/1000); return b64u({alg:'none',typ:'JWT'}) + '.' + b64u({sub:uid,tenant_id:tid,role:'super_admin',iat:n-300,exp:n+86400*30}) + '.smoke'; }

async function pickProject() {
  const r = await fetch(SUPA + '/rest/v1/projects?select=id,name,tenant_id,client_id,current_phase&current_phase=not.in.(completed,archived,intake)&tenant_id=not.is.null&client_id=not.is.null&order=created_at.desc&limit=1', { headers: SUPA_HDR });
  const p = (await r.json())[0];
  const r2 = await fetch(SUPA + `/rest/v1/user_profiles?select=user_id&tenant_id=eq.${p.tenant_id}&active=eq.true&limit=1`, { headers: SUPA_HDR });
  const userId = (await r2.json())[0]?.user_id || '00000000-0000-0000-0000-000000000000';
  return { project: p, userId };
}
async function loadAct(id) {
  const r = await fetch(SUPA + `/rest/v1/site_visit_acts?select=*&id=eq.${id}&limit=1`, { headers: SUPA_HDR });
  return (await r.json())[0] || null;
}

async function main() {
  console.log('[1] Picking active project...');
  const { project, userId } = await pickProject();
  console.log('   project:', project.id, '|', project.name);
  const jwt = mintJwt(userId, project.tenant_id);

  console.log('[2] POST /agents/acta-obra/run (dev_transcript bypass)...');
  const t0 = Date.now();
  const r1 = await fetch(N8N + '/webhook/api/v1/agents/acta-obra/run', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: project.id,
      dev_transcript: DEV_TRANSCRIPT,
      photos_urls: PHOTOS,
      visit_date: '2026-05-18T10:30:00Z'
    })
  });
  const t1 = Date.now() - t0;
  const j1 = await r1.json().catch(() => ({}));
  console.log('   status:', r1.status, '| ms:', t1);
  if (r1.status !== 201 || !j1.data?.act_id) {
    console.error('   FAIL:', JSON.stringify(j1).slice(0, 1000));
    process.exit(1);
  }
  const actId = j1.data.act_id;
  console.log('   act_id:', actId);
  console.log('   observation_count:', j1.data.observation_count);
  console.log('   observaciones:');
  for (const o of (j1.data.observations || []).slice(0, 8)) {
    console.log('     -', o.gremio + ' [' + o.tipo + ']:', o.texto.slice(0, 80) + (o.fotos_referenciadas.length ? ' (fotos: ' + o.fotos_referenciadas.join(',') + ')' : ''));
  }
  console.log('   acuerdos:', (j1.data.acuerdos || '').slice(0, 120));
  console.log('   proxima_visita_prevista:', j1.data.proxima_visita_prevista);

  console.log('[3] Verify DB draft...');
  const row1 = await loadAct(actId);
  if (!row1 || row1.status !== 'draft') { console.error('   FAIL status', row1?.status); process.exit(1); }
  if (!row1.transcript_categorized) { console.error('   FAIL categorized null'); process.exit(1); }
  if (j1.data.observation_count < 3) { console.error('   FAIL obs count', j1.data.observation_count); process.exit(1); }
  console.log('   OK status=draft observations=' + j1.data.observation_count + ' transcript_categorized!=null');

  console.log('[4] POST /site-visit-acts/approve action=approve...');
  const r2 = await fetch(N8N + '/webhook/api/v1/site-visit-acts/approve', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ act_id: actId, action: 'approve' })
  });
  const j2 = await r2.json().catch(() => ({}));
  console.log('   status:', r2.status, '| body:', JSON.stringify(j2).slice(0, 200));
  if (r2.status !== 200 || j2.data?.new_status !== 'approved') {
    console.error('   FAIL approve'); process.exit(1);
  }
  console.log('   OK approved_at=' + j2.data.approved_at);

  console.log('[5] POST /site-visit-acts/approve action=sign...');
  const r3 = await fetch(N8N + '/webhook/api/v1/site-visit-acts/approve', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ act_id: actId, action: 'sign' })
  });
  const j3 = await r3.json().catch(() => ({}));
  console.log('   status:', r3.status, '| body:', JSON.stringify(j3).slice(0, 200));
  if (r3.status !== 200 || j3.data?.new_status !== 'signed') {
    console.error('   FAIL sign'); process.exit(1);
  }
  console.log('   OK signed_at=' + j3.data.signed_at);

  console.log('[6] Verify DB final state...');
  const row3 = await loadAct(actId);
  if (row3.status !== 'signed' || !row3.signed_at) { console.error('   FAIL final', row3); process.exit(1); }
  console.log('   OK status=signed approved_at=' + row3.approved_at + ' signed_at=' + row3.signed_at);

  console.log('[7] Negative: approve sobre signed debe dar 409...');
  const r4 = await fetch(N8N + '/webhook/api/v1/site-visit-acts/approve', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ act_id: actId, action: 'approve' })
  });
  const j4 = await r4.json().catch(() => ({}));
  if (r4.status !== 409) { console.error('   FAIL expected 409, got', r4.status, j4); process.exit(1); }
  console.log('   OK 409 INVALID_TRANSITION');

  console.log('\n=== SMOKE B10 VERDE ===');
}

main().catch(e => { console.error(e); process.exit(1); });
