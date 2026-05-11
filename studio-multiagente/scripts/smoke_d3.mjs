// Smoke E2E Fase D.3: agent_proposal_moodboard + api_proposal_public_view + api_proposal_public_accept
// Pasos:
//   1. Asegurar que existe una proposal de test en project finca-san-vicente
//   2. POST /agents/proposal/moodboard -> genera moodboard + public_token
//   3. GET /proposals/public?token=... -> ver propuesta como cliente
//   4. POST /proposals/public/accept (accepted) -> 201
//   5. POST /proposals/public/accept (otra vez) -> 409 ALREADY_DECIDED
//   6. GET /proposals/public?token=... -> ahora muestra acceptance

const BASE = 'https://n8n-n8n.zzeluw.easypanel.host';

const USER_ID = 'a04c0b47-fddb-44f3-9b14-735bbd64d453';
const TENANT_ID = 'bbf3f07e-206c-4a4a-affe-592ae3d6c4c9';
const PROJECT_ID = '16a2f113-c2b5-4cd1-bc99-52ecf9b5f3e9';

function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function mintJwt() {
  const h = b64url({ alg: 'HS256', typ: 'JWT' });
  const p = b64url({ sub: USER_ID, tenant_id: TENANT_ID, role: 'super_admin', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 });
  return `${h}.${p}.smokesig`;
}

const JWT = mintJwt();
const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${JWT}` };

async function getOrCreateProposal() {
  // Use the existing api_projects detail or a postgres query via decision-engine? simpler: try creating proposal directly via SQL via n8n REST API?
  // Easiest: call api_create_proposal if exists. Else, use the agent_proposal flow.
  // We just need a proposal_id with project_id = PROJECT_ID. Let's try to create one inline.
  // POST to a temporary endpoint? No. Best: trigger agent_proposal via execute, but that requires preflight.
  // Alternative: use the agent_decision_engine to find existing proposals? No, simpler:
  // INSERT directly via the api_create_proposal_test (doesn't exist).
  //
  // Pragmatic: use the agent_costs API or any agent that inserts. Else, we can't.
  // Fallback: use the n8n REST API to execute a one-off raw SQL via a workflow we create? Overkill.
  //
  // Simplest: query n8n executions to see if any test proposal was created. If not, instruct user.
  return null;
}

async function postMoodboard(proposalId) {
  console.log(`\n[STEP 2] POST /agents/proposal/moodboard proposal_id=${proposalId}`);
  const r = await fetch(`${BASE}/webhook/api/v1/agents/proposal/moodboard`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify({ proposal_id: proposalId, force_regenerate: true })
  });
  const j = await r.json().catch(() => ({ _raw: 'parse error' }));
  console.log(`  status=${r.status}`);
  console.log(`  body:`, JSON.stringify(j, null, 2).slice(0, 2000));
  return { status: r.status, body: j };
}

async function getPublic(token) {
  console.log(`\n[STEP] GET /proposals/public?token=${token.slice(0,8)}...`);
  const r = await fetch(`${BASE}/webhook/api/v1/proposals/public?token=${encodeURIComponent(token)}`);
  const j = await r.json().catch(() => ({ _raw: 'parse error' }));
  console.log(`  status=${r.status}`);
  console.log(`  body:`, JSON.stringify(j, null, 2).slice(0, 1800));
  return { status: r.status, body: j };
}

async function postAccept(token, decision, signerName, comments) {
  console.log(`\n[STEP] POST /proposals/public/accept decision=${decision}`);
  const r = await fetch(`${BASE}/webhook/api/v1/proposals/public/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, decision, signer_name: signerName, signer_email: 'cliente@example.com', comments })
  });
  const j = await r.json().catch(() => ({ _raw: 'parse error' }));
  console.log(`  status=${r.status}`);
  console.log(`  body:`, JSON.stringify(j, null, 2).slice(0, 1500));
  return { status: r.status, body: j };
}

async function main() {
  console.log('=== smoke D.3 ===');
  console.log(`project: ${PROJECT_ID} (finca san vicente)`);

  const proposalId = process.argv[2];
  if (!proposalId) {
    console.error('Usage: node smoke_d3.mjs <proposal_id>');
    console.error('Necesito un proposal_id existente. Si no hay, hay que crearlo antes (via SQL o agent_proposal).');
    process.exit(2);
  }

  // STEP 2: moodboard
  const mb = await postMoodboard(proposalId);
  if (mb.status !== 201 && mb.status !== 200) { console.error('FAIL moodboard'); process.exit(1); }
  const token = mb.body?.data?.public_token;
  if (!token) { console.error('FAIL: no public_token in moodboard response'); process.exit(1); }

  // STEP 3: public view (pre-acceptance)
  const v1 = await getPublic(token);
  if (v1.status !== 200) { console.error('FAIL public view'); process.exit(1); }
  if (v1.body?.data?.acceptance?.is_decided !== false) { console.error('FAIL: expected is_decided=false'); process.exit(1); }

  // STEP 4: accept
  const a1 = await postAccept(token, 'accepted', 'Cliente de prueba D3', 'Smoke test - todo OK');
  if (a1.status !== 201) { console.error('FAIL accept'); process.exit(1); }

  // STEP 5: re-accept -> 409
  const a2 = await postAccept(token, 'accepted', 'Cliente de prueba D3', 'segunda llamada');
  if (a2.status !== 409) { console.error(`FAIL: expected 409 on re-accept, got ${a2.status}`); process.exit(1); }

  // STEP 6: public view (post-acceptance) -> shows accepted
  const v2 = await getPublic(token);
  if (v2.status !== 200) { console.error('FAIL public view post-accept'); process.exit(1); }
  if (v2.body?.data?.acceptance?.is_decided !== true) { console.error('FAIL: expected is_decided=true after accept'); process.exit(1); }

  console.log('\n=== ALL VERDE ===');
  console.log(`moodboard.palette.length = ${(mb.body?.data?.moodboard?.palette || []).length}`);
  console.log(`moodboard.materials.length = ${(mb.body?.data?.moodboard?.materials || []).length}`);
  console.log(`moodboard.render_prompt = "${(mb.body?.data?.moodboard?.render_prompt || '').slice(0, 120)}..."`);
  console.log(`public_token = ${token}`);
  console.log(`acceptance_id = ${a1.body?.data?.acceptance_id}`);
  console.log(`final_status = ${v2.body?.data?.proposal?.status}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
