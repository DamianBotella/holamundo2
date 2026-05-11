// Smoke E2E Fase E.2: agent_municipal_precheck contra las 4 ciudades nuevas
// Test cada proyecto en su ciudad. Verifica que el LLM identifica reglas especificas
// del municipio (no de Madrid).

const BASE = 'https://n8n-n8n.zzeluw.easypanel.host';
const ENDPOINT = `${BASE}/webhook/api/v1/agents/municipal-precheck/run`;

const USER_ID = 'a04c0b47-fddb-44f3-9b14-735bbd64d453';
const TENANT_ID = 'bbf3f07e-206c-4a4a-affe-592ae3d6c4c9';

const CASES = [
  { city: 'barcelona', project_id: '7160e7a1-7a87-4be8-ac0c-de65c0c385bc', context: 'Piso 1915 Eixample, galeria acristalada original al patio interior', expect_keys: ['ite_catalunya_45anys','habitabilitat_decret_141_2012','cedula_habitabilitat_catalunya'] },
  { city: 'valencia',  project_id: 'b2cdb708-13a5-4626-a7eb-622168f2b776', context: 'Local El Carmen ZIP, planta baja zona PATRICOVA, conversion en vivienda',                                   expect_keys: ['ciutat_vella_zip_patrimoni','cambio_uso_compatibilidad_valencia','riesgo_inundacion_turia_cota_minima'] },
  { city: 'sevilla',   project_id: '7baf0425-ef2b-4282-bda3-2e88613f27da', context: 'Casa Santa Cruz BIC UNESCO con patio tradicional sevillano protegido',                                        expect_keys: ['casco_antiguo_bic_sevilla','dbhe_cte_sevilla_zona_b4'] },
  { city: 'bilbao',    project_id: 'e636c145-232b-4927-8354-2481ba2259de', context: 'Piso Casco Viejo Las Siete Calles, edificio 1895 catalogado BIC',                                              expect_keys: ['casco_viejo_bic_bilbao','dbhe_cte_bilbao_zona_c1','habitabilidad_decreto_317_2002'] }
];

function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function mintJwt() {
  const h = b64url({ alg: 'HS256', typ: 'JWT' });
  const p = b64url({ sub: USER_ID, tenant_id: TENANT_ID, role: 'super_admin', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 });
  return `${h}.${p}.smokesig`;
}

async function runCase(c) {
  console.log(`\n[CASE ${c.city.toUpperCase()}] project_id=${c.project_id}`);
  console.log(`  context: ${c.context}`);
  const t0 = Date.now();
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintJwt()}` },
    body: JSON.stringify({ project_id: c.project_id, additional_context: c.context }),
  });
  const ms = Date.now() - t0;
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { _raw: txt }; }
  const out = j?.data?.output || {};
  const rules = Array.isArray(out.applicable_rules) ? out.applicable_rules : [];
  const allKeys = rules.map(x => x.rule_key);
  const siKeys = rules.filter(x => x.applicability === 'si').map(x => x.rule_key);
  const matchedExpected = c.expect_keys.filter(k => allKeys.includes(k));
  const verde = r.status === 201 && rules.length >= 3 && matchedExpected.length >= Math.ceil(c.expect_keys.length / 2);

  console.log(`  status=${r.status} (${(ms/1000).toFixed(1)}s)`);
  console.log(`  rules_prefiltered=${out.rules_prefiltered}/${out.rules_total_in_db} | applicable=${out.rules_applicable_count} | verificar=${out.rules_verify_count}`);
  console.log(`  recommended_license=${out.recommended_license}`);
  console.log(`  expected keys present: ${matchedExpected.length}/${c.expect_keys.length} -> [${matchedExpected.join(', ')}]`);
  console.log(`  blockers (${(out.blockers||[]).length}):`);
  for (const b of (out.blockers || []).slice(0, 3)) console.log(`    - ${b.slice(0, 120)}`);
  console.log(`  SI applicability (${siKeys.length}): ${siKeys.slice(0, 6).join(', ')}${siKeys.length > 6 ? '...' : ''}`);
  console.log(`  ${verde ? 'VERDE' : 'FAIL'}`);
  return { city: c.city, status: r.status, verde, output: out };
}

async function main() {
  console.log('=== smoke E.2 (4 ciudades) ===');
  const results = [];
  for (const c of CASES) {
    results.push(await runCase(c));
  }

  console.log('\n=== RESUMEN ===');
  for (const r of results) {
    console.log(`  ${r.city.padEnd(10)} ${r.verde ? 'VERDE' : 'FAIL'} | license=${r.output?.recommended_license || '-'} | applicable=${r.output?.rules_applicable_count || 0}`);
  }
  const allVerde = results.every(r => r.verde);
  console.log(`\n  ALL: ${allVerde ? 'VERDE' : 'FAIL'}`);
  process.exit(allVerde ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
