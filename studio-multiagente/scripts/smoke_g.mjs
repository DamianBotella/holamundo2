// Smoke E2E Fase G - Stripe billing
// CASO A: GET /billing/subscription -> 200 con tier=pro, status=trialing, trial_days_left=14, 3 planes disponibles
// CASO B: POST /billing/checkout tier=starter -> 503 STRIPE_NOT_CONFIGURED (keys placeholder en BD)
// CASO C: POST /billing/checkout tier=invalido -> 400 INVALID_TIER
// CASO D: POST /billing/portal -> 412 NO_STRIPE_CUSTOMER (sub en trial sin stripe_customer_id aun)
// CASO E: POST /stripe (sin firma) -> 400 NO_SIGNATURE
// CASO F: POST /stripe (firma invalida) -> 400 INVALID_SIGNATURE o WEBHOOK_SECRET_NOT_CONFIGURED

const BASE = 'https://n8n-n8n.zzeluw.easypanel.host';
const USER_ID = 'a04c0b47-fddb-44f3-9b14-735bbd64d453';
const TENANT_ID = 'bbf3f07e-206c-4a4a-affe-592ae3d6c4c9';

function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function mintJwt() {
  const h = b64url({ alg: 'HS256', typ: 'JWT' });
  const p = b64url({ sub: USER_ID, tenant_id: TENANT_ID, role: 'super_admin', email: 'botelladesdeel98@gmail.com', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 });
  return `${h}.${p}.smokesig`;
}

const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${mintJwt()}` });

async function call(label, method, path, body, headers) {
  console.log(`\n[${label}] ${method} ${path}`);
  const t0 = Date.now();
  const init = { method, headers: { ...(headers || authHeaders()) } };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  const r = await fetch(BASE + path, init);
  const ms = Date.now() - t0;
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { _raw: txt }; }
  console.log(`  status=${r.status} (${ms}ms)`);
  console.log(`  body:`, JSON.stringify(j, null, 2).slice(0, 1600));
  return { status: r.status, body: j };
}

async function main() {
  console.log('=== smoke G (Stripe billing) ===');

  const a = await call('A_status', 'GET', '/webhook/api/v1/billing/subscription');
  const b = await call('B_checkout_starter', 'POST', '/webhook/api/v1/billing/checkout', { tier: 'starter' });
  const c = await call('C_checkout_invalid', 'POST', '/webhook/api/v1/billing/checkout', { tier: 'enterprise' });
  const d = await call('D_portal', 'POST', '/webhook/api/v1/billing/portal', {});
  const e = await call('E_webhook_no_sig', 'POST', '/webhook/stripe', { id: 'evt_test', type: 'customer.subscription.created' }, { 'Content-Type': 'application/json' });
  const f = await call('F_webhook_bad_sig', 'POST', '/webhook/stripe', { id: 'evt_test_2', type: 'customer.subscription.created' }, { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1234567890,v1=deadbeef' });

  console.log('\n=== RESUMEN ===');
  const okA = a.status === 200 && a.body?.data?.subscription?.tier === 'pro' && a.body?.data?.subscription?.is_trialing === true && (a.body?.data?.available_plans?.length === 3);
  const okB = b.status === 503 && b.body?.error?.code === 'STRIPE_NOT_CONFIGURED';
  const okC = c.status === 400 && c.body?.error?.code === 'INVALID_TIER';
  const okD = d.status === 412 && (d.body?.error?.code === 'NO_STRIPE_CUSTOMER' || d.body?.error?.code === 'NO_SUBSCRIPTION');
  const okE = e.status === 400 && e.body?.error?.code === 'NO_SIGNATURE';
  const okF = f.status === 503 && f.body?.error?.code === 'WEBHOOK_SECRET_NOT_CONFIGURED';

  console.log(`A status pro trialing 14d:        ${okA ? 'VERDE' : 'FAIL'}  (tier=${a.body?.data?.subscription?.tier}, status=${a.body?.data?.subscription?.status}, days_left=${a.body?.data?.subscription?.trial_days_left}, plans=${a.body?.data?.available_plans?.length})`);
  console.log(`B checkout placeholder:           ${okB ? 'VERDE' : 'FAIL'}  (code=${b.body?.error?.code})`);
  console.log(`C checkout tier invalido:         ${okC ? 'VERDE' : 'FAIL'}  (code=${c.body?.error?.code})`);
  console.log(`D portal sin customer_id:         ${okD ? 'VERDE' : 'FAIL'}  (code=${d.body?.error?.code})`);
  console.log(`E webhook sin firma:              ${okE ? 'VERDE' : 'FAIL'}  (code=${e.body?.error?.code})`);
  console.log(`F webhook placeholder secret:     ${okF ? 'VERDE' : 'FAIL'}  (code=${f.body?.error?.code})`);

  const all = okA && okB && okC && okD && okE && okF;
  console.log(`\n  ALL: ${all ? 'VERDE' : 'FAIL'}`);
  process.exit(all ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
