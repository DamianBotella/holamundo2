#!/usr/bin/env node
/**
 * ADDENDUM 2 Bloque 5 - Smoke E2E agent_normativa_fetch.
 *
 * Caso A: Tres Cantos (municipio NUEVO, no esta en seeds 077-081). Debe:
 *   - Status 200 final con status='completed' y rules_extracted > 0
 *   - municipal_onboarding_queue tiene fila done
 *   - municipal_pgou_rules tiene N filas con municipio_slug='tres_cantos'
 *   - activity_log tiene entry de agent_normativa_fetch
 *   - email enviado al architect_email (no verificable desde aqui)
 *
 * Caso B: Madrid (municipio YA cargado, 21 reglas seed). Debe:
 *   - Status 200 con status='already_loaded' y rules_count=21
 *   - municipal_onboarding_queue NO tiene fila (no se enqueue si ya esta)
 */

const BASE = 'https://n8n-n8n.zzeluw.easypanel.host';
const ENDPOINT = `${BASE}/webhook/api/v1/agents/normativa-fetch/run`;

const USER_ID = 'a04c0b47-fddb-44f3-9b14-735bbd64d453';
const TENANT_ID = 'bbf3f07e-206c-4a4a-affe-592ae3d6c4c9';

function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function mintJwt() {
  const h = b64url({ alg: 'HS256', typ: 'JWT' });
  const p = b64url({
    sub: USER_ID,
    tenant_id: TENANT_ID,
    role: 'super_admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${h}.${p}.smokesig`;
}

async function run(label, body) {
  console.log(`\n[CASE ${label}] ${JSON.stringify(body)}`);
  const t0 = Date.now();
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintJwt()}` },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { _raw: txt }; }
  console.log(`  status=${r.status} (${ms}ms)`);
  console.log(`  body:`, JSON.stringify(j, null, 2).slice(0, 2000));
  return { status: r.status, body: j, ms };
}

async function main() {
  console.log('=== smoke B5 (agent_normativa_fetch) ===');

  // Caso B primero (es rapido, valida el path "already_loaded")
  const b = await run('B_madrid_already_loaded', {
    municipio: 'Madrid',
    provincia: 'Madrid',
    comunidad_autonoma: 'Comunidad de Madrid',
  });

  // Caso A (Tres Cantos NUEVO, espera Jina + GPT-4o, puede tardar 30-60s)
  const a = await run('A_tres_cantos_new', {
    municipio: 'Tres Cantos',
    provincia: 'Madrid',
    comunidad_autonoma: 'Comunidad de Madrid',
  });

  console.log('\n=== RESUMEN ===');
  const okB = b.status === 200 && b.body?.status === 'already_loaded' && b.body?.rules_count >= 21;
  const okA = a.status === 200 && a.body?.status === 'completed' && a.body?.rules_extracted > 0;
  console.log(`B (madrid already_loaded): status=${b.status}, rules_count=${b.body?.rules_count}, ok=${okB}`);
  console.log(`A (tres_cantos new):       status=${a.status}, rules_extracted=${a.body?.rules_extracted}, ms=${a.ms}, ok=${okA}`);

  if (!okB || !okA) {
    console.error('\nFAIL: alguno de los casos no paso. Revisa logs y BD.');
    process.exit(1);
  }
  console.log('\n=== OK ===');
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
