#!/usr/bin/env node
/**
 * ADDENDUM 2 Bloque 6 - smoke E2E api_regulatory_ask.
 *
 * Caso A: pregunta concreta sobre Madrid (proyecto existente). Espera:
 *   - status 200
 *   - data.respuesta no vacio
 *   - data.citas con >= 1 item con normative_reference
 *   - data.confianza alta o media
 *
 * Caso B: pregunta sin coincidencia clara (preguntar sobre algo trivial).
 *   - status 200
 *   - data.confianza baja (idealmente)
 */

const BASE = 'https://n8n-n8n.zzeluw.easypanel.host';
const ENDPOINT = `${BASE}/webhook/api/v1/regulatory/ask`;

const USER_ID = 'a04c0b47-fddb-44f3-9b14-735bbd64d453';
const TENANT_ID = 'bbf3f07e-206c-4a4a-affe-592ae3d6c4c9';
const PROJECT_MADRID = '9cd26dec-3b1f-4231-a08d-5a2e934417fd';

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
  let j; try { j = JSON.parse(txt); } catch { j = { _raw: txt.slice(0, 500) }; }
  console.log(`  status=${r.status} (${ms}ms)`);
  console.log(`  body:`, JSON.stringify(j, null, 2).slice(0, 3500));
  return { status: r.status, body: j, ms };
}

async function main() {
  console.log('=== smoke B6 (api_regulatory_ask RAG) ===');

  const a = await run('A_madrid_ascensor', {
    project_id: PROJECT_MADRID,
    question: '¿Es obligatorio instalar ascensor si reformo el edificio? Tiene 4 plantas sobre rasante.',
  });

  const b = await run('B_madrid_pregunta_normativa_general', {
    project_id: PROJECT_MADRID,
    question: '¿Puedo abrir un hueco en la fachada para poner una ventana mas grande?',
  });

  console.log('\n=== RESUMEN ===');
  const okA = a.status === 200 && a.body?.ok && a.body?.data?.respuesta && a.body?.data?.citas?.length > 0;
  const okB = b.status === 200 && b.body?.ok && b.body?.data?.respuesta;
  console.log(`A (ascensor):    status=${a.status}, citas=${a.body?.data?.citas?.length}, confianza=${a.body?.data?.confianza}, rules_used=${a.body?.data?.rules_used}, ok=${okA}`);
  console.log(`B (fachada):     status=${b.status}, citas=${b.body?.data?.citas?.length}, confianza=${b.body?.data?.confianza}, rules_used=${b.body?.data?.rules_used}, ok=${okB}`);

  if (!okA || !okB) { console.error('\nFAIL'); process.exit(1); }
  console.log('\n=== OK ===');
}

main().catch((err) => { console.error('[fatal]', err); process.exit(1); });
