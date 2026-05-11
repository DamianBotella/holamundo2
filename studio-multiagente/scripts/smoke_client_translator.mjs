// Smoke E2E para agent_client_translator
// Mints a synthetic JWT (the webhook only base64-decodes; no signature verify)
// Test cases:
//   A) client_text con decision clara (cambio de material) -> debe INSERT en client_decisions
//   B) client_text sin decision (cliente pregunta) -> NO debe insertar, has_decision=false

const BASE = 'https://n8n-n8n.zzeluw.easypanel.host';
const ENDPOINT = `${BASE}/webhook/api/v1/agents/client-translator/record-decision`;

// User/tenant reales de finca-san-vicente (super_admin de Damian)
const USER_ID = 'a04c0b47-fddb-44f3-9b14-735bbd64d453';
const TENANT_ID = 'bbf3f07e-206c-4a4a-affe-592ae3d6c4c9';
const PROJECT_ID = '16a2f113-c2b5-4cd1-bc99-52ecf9b5f3e9';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function mintJwt() {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    sub: USER_ID,
    tenant_id: TENANT_ID,
    role: 'super_admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  // Workflow no verifica firma - dummy signature
  return `${header}.${payload}.smokesig`;
}

async function runCase(label, body) {
  const jwt = mintJwt();
  console.log(`\n[CASE ${label}] POST ${ENDPOINT}`);
  console.log(`  client_text: "${body.client_text.slice(0, 80)}..."`);
  const t0 = Date.now();
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const txt = await r.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    json = { _raw: txt };
  }
  console.log(`  status: ${r.status} (${ms}ms)`);
  console.log(`  body: ${JSON.stringify(json, null, 2)}`);
  return { status: r.status, body: json, ms };
}

async function main() {
  console.log('=== smoke agent_client_translator ===');
  console.log(`project: ${PROJECT_ID} (finca san vicente)`);

  // CASE A: decision clara de material
  const a = await runCase('A_decision_material', {
    project_id: PROJECT_ID,
    client_text:
      'He estado pensando y prefiero que pongamos porcelanico premium en vez del medio que me habiais propuesto. Aunque sea mas caro, quiero que sea de calidad. Lo confirmo por aqui.',
    contexto_propuesta:
      'Propuesta inicial: porcelanico medio nacional 32 EUR/m2 para 90 m2',
    metodo_confirmacion: 'chat',
    evidencia_url: 'https://chat.studio/msg/sm-001',
  });

  // CASE B: solo pregunta - NO decision
  const b = await runCase('B_solo_pregunta', {
    project_id: PROJECT_ID,
    client_text:
      'Hola Damian, una pregunta: cuanto tarda en secar el cemento radiante antes de poder pisar? Es por organizarme con la mudanza.',
    metodo_confirmacion: 'chat',
  });

  // Resumen
  console.log('\n=== RESUMEN ===');
  console.log(`A (decision material): status=${a.status}, has_decision=${a.body?.data?.summary?.has_decision}, decision_id=${a.body?.data?.decision_id ?? 'null'}`);
  console.log(`B (solo pregunta):     status=${b.status}, has_decision=${b.body?.data?.summary?.has_decision}, decision_id=${b.body?.data?.decision_id ?? 'null'}`);

  const okA = a.status === 201 && a.body?.data?.summary?.has_decision === true && !!a.body?.data?.decision_id;
  const okB = b.status === 201 && b.body?.data?.summary?.has_decision === false && (b.body?.data?.decision_id === null || b.body?.data?.decision_id === undefined);

  console.log(`\n  A: ${okA ? 'VERDE' : 'FAIL'}`);
  console.log(`  B: ${okB ? 'VERDE' : 'FAIL'}`);
  process.exit(okA && okB ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
