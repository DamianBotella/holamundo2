// Smoke E2E Fase E.1: agent_municipal_precheck
// Caso A: proyecto Madrid -> 201 con applicable_rules, recommended_license, summary
// Caso B: proyecto fuera del top 5 (finca san vicente / san juan) -> 200 con _warn

const BASE = 'https://n8n-n8n.zzeluw.easypanel.host';
const ENDPOINT = `${BASE}/webhook/api/v1/agents/municipal-precheck/run`;

const USER_ID = 'a04c0b47-fddb-44f3-9b14-735bbd64d453';
const TENANT_ID = 'bbf3f07e-206c-4a4a-affe-592ae3d6c4c9';
const PROJECT_MADRID = '9cd26dec-3b1f-4231-a08d-5a2e934417fd';
const PROJECT_NOT_TOP5 = '16a2f113-c2b5-4cd1-bc99-52ecf9b5f3e9'; // finca san vicente (san juan)

function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function mintJwt() {
  const h = b64url({ alg: 'HS256', typ: 'JWT' });
  const p = b64url({ sub: USER_ID, tenant_id: TENANT_ID, role: 'super_admin', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 });
  return `${h}.${p}.smokesig`;
}

async function run(label, projectId, extra) {
  console.log(`\n[CASE ${label}] project_id=${projectId}`);
  const t0 = Date.now();
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintJwt()}` },
    body: JSON.stringify({ project_id: projectId, additional_context: extra }),
  });
  const ms = Date.now() - t0;
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { _raw: txt }; }
  console.log(`  status=${r.status} (${ms}ms)`);
  console.log(`  body:`, JSON.stringify(j, null, 2).slice(0, 3500));
  return { status: r.status, body: j };
}

async function main() {
  console.log('=== smoke E.1 (agent_municipal_precheck) ===');

  const a = await run('A_madrid', PROJECT_MADRID, 'Edificio de 1960, PB+4 sin ascensor. Hay bajantes de uralita visibles en patio.');
  const b = await run('B_not_top5', PROJECT_NOT_TOP5, null);

  console.log('\n=== RESUMEN ===');
  const okA = a.status === 201
    && Array.isArray(a.body?.data?.output?.applicable_rules)
    && a.body.data.output.applicable_rules.length > 0
    && a.body.data.precheck_id;
  const okB = b.status === 200 && (b.body?.warning === 'MUNICIPIO_NOT_IN_TOP5' || b.body?.warning?.includes?.('TOP5'));

  console.log(`A (madrid):       status=${a.status}, applicable_rules=${a.body?.data?.output?.applicable_rules?.length}, license=${a.body?.data?.output?.recommended_license}, precheck_id=${a.body?.data?.precheck_id?.slice(0,8)}...`);
  console.log(`B (not top5):     status=${b.status}, warning=${b.body?.warning}`);
  console.log(`\n  A: ${okA ? 'VERDE' : 'FAIL'}`);
  console.log(`  B: ${okB ? 'VERDE' : 'FAIL'}`);
  process.exit(okA && okB ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
