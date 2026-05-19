#!/usr/bin/env node
/**
 * PLAN V1.0 Bloque 1 - Smoke real de agent_proposal_render contra mnml.ai.
 *
 * Riesgo binario: el workflow lleva meses sin probarse. Si la API key
 * caduco o mnml.ai cambio el contrato, hay que descubrirlo HOY.
 *
 * Pasos:
 *   1. Mint JWT founder/super_admin
 *   2. Tomar una proposal existente con moodboard (no creamos nueva, ya hay 4)
 *   3. POST /api/v1/agents/proposal/render con source_image_url publica
 *      (Unsplash interior - no requiere auth)
 *   4. El workflow internamente hace polling mnml.ai con Wait nodes; espera
 *      ~60-90s hasta que devuelve render_url o error
 *   5. Verificar response body + GET render_url (HEAD) para confirmar imagen
 *   6. Reportar tiempo total + cualquier error
 *
 * Uso:
 *   node studio-multiagente/scripts/smoke_proposal_render.mjs [proposal_id]
 *
 * Si falla:
 *   - Si HTTP 500 con error mnml.ai: API key caducada o cuenta sin credito.
 *   - Si timeout: mnml.ai esta caido o muy lento (>90s).
 *   - Si workflow error: bug en n8n. Revisar ejecuciones en n8n UI.
 *   Documentar en memory/feedback_technical.md.
 */

const BASE = 'https://n8n-n8n.zzeluw.easypanel.host';
const ENDPOINT = `${BASE}/webhook/api/v1/agents/proposal/render`;

const USER_ID = 'a04c0b47-fddb-44f3-9b14-735bbd64d453';
const TENANT_ID = 'bbf3f07e-206c-4a4a-affe-592ae3d6c4c9';

// Proposal con moodboard ya generado del project finca-san-vicente.
// Si quieres usar otra, paselo como arg CLI.
const DEFAULT_PROPOSAL = '093ebbd3-6d49-4bd2-9d23-ad9b890638e6';

// Imagen publica de salon (Unsplash, no requiere auth, 1024px).
// Si Unsplash cambia URL, sustituir por otra publica accesible.
const SOURCE_IMAGE = 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1024&q=80';

function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function mintJwt() {
  // Buffer amplio: iat ligeramente atras, exp 30 dias hacia adelante.
  // Necesario porque el reloj local puede desfase con el server n8n.
  const now = Math.floor(Date.now() / 1000);
  const h = b64url({ alg: 'HS256', typ: 'JWT' });
  const p = b64url({
    sub: USER_ID,
    tenant_id: TENANT_ID,
    role: 'super_admin',
    iat: now - 300,                  // 5 min atras
    exp: now + 86400 * 30,           // 30 dias adelante
  });
  return `${h}.${p}.smokesig`;
}

// Polling DB para verificar render_data sin depender de respuesta HTTP sincrona.
// El proxy EasyPanel/nginx delante de n8n puede cortar conexiones >30-60s,
// pero n8n ejecuta el workflow hasta el final independiente del cliente.
// Ademas, n8n devuelve a veces 502 con HTML "Not Found" cuando el workflow
// responde con _status >=500: leemos directamente la ultima ejecucion del
// workflow en n8n API para diagnosticar el ultimo nodo + error.
const SUPA = 'https://xfeatkzordgnztigplwd.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZWF0a3pvcmRnbnp0aWdwbHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDY4MTc0NCwiZXhwIjoyMDkwMjU3NzQ0fQ.ywgupOdE6VfmW8i9ezNjrIVdeDDcRhPLI_W8yG_GzYg';
const supaHeaders = { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY };

const N8N_API_BASE = 'https://n8n-n8n.zzeluw.easypanel.host';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyNTVhYzFkNS1iODJmLTQwMGEtYWQ3Yy0xMGZiZTE3ZDk5ZDQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWYwMjE5YTAtYWE1OC00NjZjLTllYWMtOGY0NmNiMzkwOTFlIiwiaWF0IjoxNzc2Njk5ODA5fQ.KIqvcW3GnnJBhd4c8msctXgNxCVH_8pTkfTjFfMQxf8';
const N8N_WORKFLOW_ID = '3C0IyRkz48VnFdky';
const n8nHeaders = { 'X-N8N-API-KEY': N8N_API_KEY };

async function getRenderData(proposalId) {
  const r = await fetch(`${SUPA}/rest/v1/proposals?id=eq.${proposalId}&select=render_data,updated_at`, { headers: supaHeaders });
  const rows = await r.json();
  return rows[0] || null;
}

async function getLastExecutionDiagnostic() {
  // Recupera la ultima ejecucion del workflow con includeData=true y
  // resume el ultimo nodo + error real.
  const r = await fetch(`${N8N_API_BASE}/api/v1/executions?workflowId=${N8N_WORKFLOW_ID}&limit=1&includeData=true`, { headers: n8nHeaders });
  const d = await r.json();
  const exec = d.data?.[0];
  if (!exec) return null;
  const ran = exec.data?.resultData?.runData || {};
  const names = Object.keys(ran);
  const lastName = names[names.length - 1];
  const lastRun = ran[lastName]?.[ran[lastName].length - 1] || {};
  const out = lastRun.data?.main?.[0];
  const j = out?.[0]?.json || {};
  let errorDetail = '';
  if (j._error)  errorDetail = `${j._error}: ${(j._details || '').slice(0, 300)}`;
  else if (j.error) {
    const e = typeof j.error === 'string' ? j.error : j.error.message || JSON.stringify(j.error);
    errorDetail = String(e).slice(0, 300);
  }
  return {
    execId: exec.id,
    status: exec.status,
    startedAt: exec.startedAt,
    nodesExecuted: names.length,
    lastNode: lastName,
    lastNodeError: errorDetail,
  };
}

async function main() {
  const proposalId = process.argv[2] || DEFAULT_PROPOSAL;
  console.log('=== smoke proposal_render (async) ===');
  console.log('  endpoint    :', ENDPOINT);
  console.log('  proposal_id :', proposalId);
  console.log('  source_image:', SOURCE_IMAGE);
  console.log();

  // Reset render_data antes del smoke
  await fetch(`${SUPA}/rest/v1/proposals?id=eq.${proposalId}`, {
    method: 'PATCH', headers: { ...supaHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ render_data: null }),
  });
  console.log('[reset] render_data NULL para forzar verificacion');

  const t0 = Date.now();
  const jwt = mintJwt();
  console.log('[jwt] iat:', JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString()).iat,
              'exp:', JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString()).exp);

  // Llamada con timeout largo. El workflow ahora termina rapido (~1-3s) salvo
  // que entre en polling mnml.ai real, que solo ocurre si mnml acepta el Submit.
  let response = null;
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        proposal_id: proposalId,
        source_image_url: SOURCE_IMAGE,
        image_type: 'photo',
        style: 'realistic',
        renderspeed: 'fast',
        scenario: 'precise',
      }),
      signal: AbortSignal.timeout(180_000),
    });
    const txt = await r.text();
    let body; try { body = JSON.parse(txt); } catch { body = { _raw: txt.slice(0,400) }; }
    response = { status: r.status, body, ms: Date.now()-t0 };
    console.log('[response] status=' + r.status + ' ms=' + response.ms);

    // Detectar NO_CREDITS especificamente
    const details = body?._details || body?.error?.message || JSON.stringify(body).slice(0,400);
    if (typeof details === 'string' && details.includes('NO_CREDITS')) {
      console.error('\n!!! mnml.ai cuenta sin creditos !!!');
      console.error('   La key es valida, el workflow funciona, pero la cuenta esta sin saldo.');
      console.error('   Accion humana: ir a dashboard mnml.ai y recargar creditos.');
      console.error('   Detalles: ' + details.slice(0, 300));
      process.exit(2);  // exit code 2 = NO_CREDITS especifico
    }

    if (body?.data?.render_url || body?.render_url) {
      console.log('[response] render_url:', body.data?.render_url || body.render_url);
    } else if (r.status !== 200 && r.status !== 201) {
      console.log('[response] body preview:', JSON.stringify(body).slice(0, 400));
    }
  } catch (e) {
    console.log('[response] cliente HTTP cortado/timeout:', e.message);
    response = { status: 0, body: null, ms: Date.now()-t0, err: e.message };
  }

  // Polling DB cada 5s durante max 180s (renderspeed=fast tipicamente 30-90s, dejamos margen)
  console.log('[poll] esperando render_data en proposals (max 180s)...');
  let renderUrl = null;
  for (let i = 0; i < 36; i++) {
    await new Promise(s => setTimeout(s, 5000));
    const row = await getRenderData(proposalId);
    if (row?.render_data) {
      const rd = row.render_data;
      renderUrl = rd.render_url || rd.image_url || rd.url || (rd.results && rd.results[0]?.url);
      console.log(`[poll] ${(i+1)*5}s -> render_data poblado!`);
      console.log('[poll] keys:', Object.keys(rd).join(','));
      if (renderUrl) console.log('[poll] render_url:', renderUrl);
      break;
    }
    if (i % 3 === 2) console.log(`[poll] ${(i+1)*5}s -> render_data sigue NULL`);
  }

  const totalMs = Date.now() - t0;

  if (!renderUrl) {
    console.error('\nFAIL: render_data sigue NULL tras 180s.');
    console.error('Diagnostico n8n executions:');
    const diag = await getLastExecutionDiagnostic();
    if (diag) {
      console.error('  execId:        ' + diag.execId);
      console.error('  status:        ' + diag.status);
      console.error('  startedAt:     ' + diag.startedAt);
      console.error('  nodesExecuted: ' + diag.nodesExecuted);
      console.error('  lastNode:      ' + diag.lastNode);
      console.error('  lastNodeError: ' + (diag.lastNodeError || '(sin error en output)'));
      if (diag.lastNodeError && diag.lastNodeError.includes('NO_CREDITS')) {
        console.error('\n  >>> mnml.ai SIN CREDITOS. Recarga cuenta en mnml.ai dashboard.');
        process.exit(2);
      }
    } else {
      console.error('  (no se pudo recuperar ultima ejecucion)');
    }
    process.exit(1);
  }

  console.log('\n[verify] HEAD', renderUrl);
  try {
    const head = await fetch(renderUrl, { method: 'HEAD' });
    const ct = head.headers.get('content-type') || '';
    console.log(`  HEAD status=${head.status} content-type=${ct}`);
    if (!head.ok || !ct.startsWith('image/')) {
      console.error('FAIL: render_url no responde con imagen valida');
      process.exit(1);
    }
  } catch (e) {
    console.error('FAIL: render_url unreachable:', e.message);
    process.exit(1);
  }

  console.log('\n=== OK ===');
  console.log(`Total time: ${totalMs}ms`);
  console.log(`Render URL: ${renderUrl}`);
}

main().catch((e) => { console.error('[fatal]', e); process.exit(1); });
