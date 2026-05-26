// batch_normativa_fetch_43_municipios.mjs
//
// Alimenta agent_normativa_fetch con los 43 municipios del seed extendido
// (Top 20 missing + Costa del Sol + Vega Baja + Costa Blanca Norte +
//  Costa Brava + Madrid Oeste + BCN Oeste + Corona Sur + BCN Metro + Mercado Local).
//
// El agente:
//   1. Comprueba si municipal_pgou_rules ya tiene reglas para el slug.
//   2. Si no, encola en municipal_onboarding_queue + llama a gpt-4o.
//   3. Parsea la respuesta y bulk-INSERTA 10-15 reglas por municipio.
//
// municipal_pgou_rules NO tiene RLS (compartida entre tenants), asi que al
// cargarse con el JWT super_admin queda disponible para todos los tenants.
//
// Coste estimado: ~$0.01 por llamada gpt-4o x 43 = ~$0.43.
// Tiempo: agente serializa por LLM call, ~5-10s por municipio = ~5 min.
//
// Uso:
//   node batch_normativa_fetch_43_municipios.mjs              # corre todo
//   node batch_normativa_fetch_43_municipios.mjs --dry        # solo lista
//   node batch_normativa_fetch_43_municipios.mjs --slug X     # solo uno
//   node batch_normativa_fetch_43_municipios.mjs --resume     # solo los que falten

const BASE = 'https://n8n-n8n.zzeluw.easypanel.host';
const ENDPOINT = `${BASE}/webhook/api/v1/agents/normativa-fetch/run`;

// super_admin de Damian (mismas credenciales que smoke_e2.mjs)
const USER_ID = 'a04c0b47-fddb-44f3-9b14-735bbd64d453';
const TENANT_ID = 'bbf3f07e-206c-4a4a-affe-592ae3d6c4c9';

const MUNICIPIOS = [
  // ===== Top 20 poblacion (15 missing; Madrid/BCN/VAL/SEV/BIO ya cargados) =====
  { nombre: 'Zaragoza',                   provincia: 'Zaragoza',               comunidad_autonoma: 'Aragon' },
  { nombre: 'Malaga',                     provincia: 'Malaga',                 comunidad_autonoma: 'Andalucia' },
  { nombre: 'Murcia',                     provincia: 'Murcia',                 comunidad_autonoma: 'Region de Murcia' },
  { nombre: 'Palma',                      provincia: 'Illes Balears',          comunidad_autonoma: 'Illes Balears' },
  { nombre: 'Las Palmas de Gran Canaria', provincia: 'Las Palmas',             comunidad_autonoma: 'Canarias' },
  { nombre: 'Alicante',                   provincia: 'Alicante',               comunidad_autonoma: 'Comunidad Valenciana' },
  { nombre: 'Cordoba',                    provincia: 'Cordoba',                comunidad_autonoma: 'Andalucia' },
  { nombre: 'Valladolid',                 provincia: 'Valladolid',             comunidad_autonoma: 'Castilla y Leon' },
  { nombre: 'Vigo',                       provincia: 'Pontevedra',             comunidad_autonoma: 'Galicia' },
  { nombre: 'Gijon',                      provincia: 'Asturias',               comunidad_autonoma: 'Asturias' },
  { nombre: 'Granada',                    provincia: 'Granada',                comunidad_autonoma: 'Andalucia' },
  { nombre: 'Hospitalet de Llobregat',    provincia: 'Barcelona',              comunidad_autonoma: 'Cataluna' },
  { nombre: 'A Coruna',                   provincia: 'A Coruna',               comunidad_autonoma: 'Galicia' },
  { nombre: 'Vitoria-Gasteiz',            provincia: 'Alava',                  comunidad_autonoma: 'Pais Vasco' },
  { nombre: 'Santa Cruz de Tenerife',     provincia: 'Santa Cruz de Tenerife', comunidad_autonoma: 'Canarias' },

  // ===== Costa del Sol (alta prioridad reforma + tickets altos) =====
  { nombre: 'Marbella',     provincia: 'Malaga', comunidad_autonoma: 'Andalucia' },
  { nombre: 'Estepona',     provincia: 'Malaga', comunidad_autonoma: 'Andalucia' },
  { nombre: 'Benalmadena',  provincia: 'Malaga', comunidad_autonoma: 'Andalucia' },
  { nombre: 'Mijas',        provincia: 'Malaga', comunidad_autonoma: 'Andalucia' },
  { nombre: 'Benahavis',    provincia: 'Malaga', comunidad_autonoma: 'Andalucia' },

  // ===== Vega Baja y Costa Blanca Sur (Alicante) =====
  { nombre: 'Orihuela',             provincia: 'Alicante', comunidad_autonoma: 'Comunidad Valenciana' },
  { nombre: 'Torrevieja',           provincia: 'Alicante', comunidad_autonoma: 'Comunidad Valenciana' },
  { nombre: 'Guardamar del Segura', provincia: 'Alicante', comunidad_autonoma: 'Comunidad Valenciana' },

  // ===== Costa Blanca Norte =====
  { nombre: 'Benidorm', provincia: 'Alicante', comunidad_autonoma: 'Comunidad Valenciana' },
  { nombre: 'Calpe',    provincia: 'Alicante', comunidad_autonoma: 'Comunidad Valenciana' },
  { nombre: 'Javea',    provincia: 'Alicante', comunidad_autonoma: 'Comunidad Valenciana' },

  // ===== Costa Brava y Garraf =====
  { nombre: 'Lloret de Mar', provincia: 'Girona',    comunidad_autonoma: 'Cataluna' },
  { nombre: 'Sitges',        provincia: 'Barcelona', comunidad_autonoma: 'Cataluna' },

  // ===== Madrid Oeste - mercado lujo =====
  { nombre: 'Pozuelo de Alarcon',  provincia: 'Madrid', comunidad_autonoma: 'Madrid' },
  { nombre: 'Las Rozas de Madrid', provincia: 'Madrid', comunidad_autonoma: 'Madrid' },
  { nombre: 'Majadahonda',         provincia: 'Madrid', comunidad_autonoma: 'Madrid' },

  // ===== Barcelona Oeste/Sur - expat =====
  { nombre: 'Sant Cugat del Valles', provincia: 'Barcelona', comunidad_autonoma: 'Cataluna' },
  { nombre: 'Castelldefels',         provincia: 'Barcelona', comunidad_autonoma: 'Cataluna' },

  // ===== Corona Sur Madrid - rehabilitacion intensa =====
  { nombre: 'Getafe',   provincia: 'Madrid', comunidad_autonoma: 'Madrid' },
  { nombre: 'Leganes',  provincia: 'Madrid', comunidad_autonoma: 'Madrid' },
  { nombre: 'Alcorcon', provincia: 'Madrid', comunidad_autonoma: 'Madrid' },

  // ===== Barcelona Metropolitana + Elche =====
  { nombre: 'Badalona', provincia: 'Barcelona', comunidad_autonoma: 'Cataluna' },
  { nombre: 'Elche',    provincia: 'Alicante',  comunidad_autonoma: 'Comunidad Valenciana' },

  // ===== Mercado local fuerte =====
  { nombre: 'Pamplona',  provincia: 'Navarra',  comunidad_autonoma: 'Navarra' },
  { nombre: 'Logrono',   provincia: 'La Rioja', comunidad_autonoma: 'La Rioja' },
  { nombre: 'Burgos',    provincia: 'Burgos',   comunidad_autonoma: 'Castilla y Leon' },
  { nombre: 'Salamanca', provincia: 'Salamanca', comunidad_autonoma: 'Castilla y Leon' },
  { nombre: 'Leon',      provincia: 'Leon',     comunidad_autonoma: 'Castilla y Leon' },
];

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

function slugify(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

async function fetchOne(m) {
  const t0 = Date.now();
  const slug = slugify(m.nombre);
  let r, txt, j;
  try {
    r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintJwt()}` },
      body: JSON.stringify({
        municipio: m.nombre,
        provincia: m.provincia,
        comunidad_autonoma: m.comunidad_autonoma,
      }),
    });
    txt = await r.text();
    try { j = JSON.parse(txt); } catch { j = { _raw: txt.slice(0, 200) }; }
  } catch (e) {
    return { slug, nombre: m.nombre, ok: false, status: 0, error: e.message, ms: Date.now() - t0 };
  }
  const ms = Date.now() - t0;
  const status = j?.status || j?.data?.status || (r.status === 200 ? 'unknown' : 'error');
  const rulesExtracted = j?.rules_extracted || j?.data?.rules_extracted || j?.rules_count || 0;
  const ok = r.status === 200 || r.status === 201;
  return {
    slug,
    nombre: m.nombre,
    ok,
    httpStatus: r.status,
    agentStatus: status,
    rulesExtracted,
    body: j,
    ms,
  };
}

function pad(s, n) { return String(s).padEnd(n); }

async function main() {
  const args = process.argv.slice(2);
  const isDry = args.includes('--dry');
  const slugFilter = args.find(a => a.startsWith('--slug='))?.slice(7);
  const resumeFlag = args.includes('--resume');

  let toRun = MUNICIPIOS;
  if (slugFilter) toRun = MUNICIPIOS.filter(m => slugify(m.nombre) === slugFilter);

  console.log('=== batch agent_normativa_fetch - 43 municipios ===');
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Total municipios: ${toRun.length}`);
  console.log(`Tenant: ${TENANT_ID}`);
  console.log('');

  if (isDry) {
    for (const m of toRun) {
      console.log(`  ${pad(slugify(m.nombre), 30)} ${pad(m.nombre, 30)} ${pad(m.provincia, 30)} ${m.comunidad_autonoma}`);
    }
    console.log(`\nDRY: ${toRun.length} municipios listos.`);
    process.exit(0);
  }

  const results = [];
  let i = 0;
  for (const m of toRun) {
    i++;
    process.stdout.write(`[${pad(i + '/' + toRun.length, 6)}] ${pad(m.nombre, 30)} `);
    const r = await fetchOne(m);
    results.push(r);

    if (!r.ok) {
      console.log(`FAIL http=${r.httpStatus} ${r.error || JSON.stringify(r.body).slice(0, 100)}`);
    } else if (r.agentStatus === 'already_loaded') {
      console.log(`SKIP already_loaded (${r.body?.rules_count || '?'} reglas) ${r.ms}ms`);
    } else if (r.agentStatus === 'completed' || r.agentStatus === 'started') {
      console.log(`OK   ${r.agentStatus} rules=${r.rulesExtracted} ${r.ms}ms`);
    } else {
      console.log(`??? status=${r.agentStatus} ${r.ms}ms body=${JSON.stringify(r.body).slice(0, 150)}`);
    }

    // pequena pausa para no saturar (gpt-4o tarda varios segundos por llamada)
    await new Promise(res => setTimeout(res, 300));
  }

  console.log('\n=== RESUMEN ===');
  const okCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;
  const alreadyCount = results.filter(r => r.agentStatus === 'already_loaded').length;
  const totalRules = results.reduce((a, r) => a + (r.rulesExtracted || 0), 0);
  console.log(`  ok=${okCount}/${results.length} | fail=${failCount} | already_loaded=${alreadyCount}`);
  console.log(`  reglas nuevas insertadas (suma agent_status!=already): ${totalRules}`);
  if (failCount > 0) {
    console.log('  FAILS:');
    for (const r of results.filter(r => !r.ok)) {
      console.log(`    - ${r.slug}: http=${r.httpStatus} ${r.error || JSON.stringify(r.body).slice(0, 100)}`);
    }
  }
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(2); });
