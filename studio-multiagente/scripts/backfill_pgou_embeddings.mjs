#!/usr/bin/env node
/**
 * ADDENDUM 2 Bloque 6 - Backfill de embeddings sobre municipal_pgou_rules.
 *
 * Recorre todas las filas WHERE embedding IS NULL, llama OpenAI
 * text-embedding-3-small (1536 dim) sobre searchable_text, y persiste
 * el vector con UPDATE. Idempotente: re-ejecuciones solo cubren los
 * gaps que queden.
 *
 * Uso:
 *   $env:SUPABASE_URL="https://<ref>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   $env:OPENAI_API_KEY="sk-..."
 *   node studio-multiagente/scripts/backfill_pgou_embeddings.mjs
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY   = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
  console.error('ERROR: faltan env vars SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OPENAI_API_KEY');
  process.exit(2);
}

const supaHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchPending() {
  // PostgREST: select id, searchable_text WHERE embedding IS NULL
  const url = `${SUPABASE_URL}/rest/v1/municipal_pgou_rules?select=id,searchable_text&embedding=is.null&searchable_text=not.is.null&limit=500`;
  const r = await fetch(url, { headers: supaHeaders });
  if (!r.ok) throw new Error(`fetchPending HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

async function fetchMissingSearchable() {
  // Filas nuevas insertadas por agent_normativa_fetch no tienen searchable_text
  // (la mig 086 solo backfilleo las preexistentes). Las leemos y rellenamos
  // con el mismo formato de mig 086 antes de embed.
  const url = `${SUPABASE_URL}/rest/v1/municipal_pgou_rules?select=id,municipio_nombre,rule_category,rule_title,rule_description,normative_reference,severity&searchable_text=is.null&limit=500`;
  const r = await fetch(url, { headers: supaHeaders });
  if (!r.ok) throw new Error(`fetchMissingSearchable HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

async function setSearchable(id, txt) {
  const url = `${SUPABASE_URL}/rest/v1/municipal_pgou_rules?id=eq.${id}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...supaHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({ searchable_text: txt }),
  });
  if (!r.ok) throw new Error(`setSearchable HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

async function embedOne(text) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
    }),
  });
  if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return j.data[0].embedding;
}

async function updateEmbedding(id, vector) {
  // PostgREST: UPDATE municipal_pgou_rules SET embedding = $vector WHERE id = $id
  // pgvector acepta el formato [0.1,0.2,...] como string castable a vector.
  const url = `${SUPABASE_URL}/rest/v1/municipal_pgou_rules?id=eq.${id}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...supaHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({ embedding: '[' + vector.join(',') + ']' }),
  });
  if (!r.ok) throw new Error(`updateEmbedding HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

async function main() {
  // PASO 0: rellenar searchable_text en filas que lo tengan NULL (vienen de
  // agent_normativa_fetch posterior a la mig 086).
  console.log('[backfill] paso 0: searchable_text NULL');
  const missing = await fetchMissingSearchable();
  console.log(`[backfill] ${missing.length} filas sin searchable_text`);
  for (const m of missing) {
    const txt = [m.municipio_nombre, m.rule_category, m.rule_title, m.rule_description, m.normative_reference, m.severity]
      .map(s => (s || ''))
      .join(' | ');
    try {
      await setSearchable(m.id, txt);
    } catch (e) {
      console.error(`[fail searchable] ${m.id}: ${e.message}`);
    }
  }

  console.log('[backfill] paso 1: cargando filas sin embedding...');
  const rows = await fetchPending();
  console.log(`[backfill] ${rows.length} reglas sin embedding`);
  if (rows.length === 0) {
    console.log('[backfill] Nada que hacer.');
    return;
  }

  let done = 0;
  let failed = 0;
  for (const row of rows) {
    if (!row.searchable_text) { console.log(`[skip] ${row.id} sin searchable_text`); continue; }
    try {
      const vec = await embedOne(row.searchable_text);
      await updateEmbedding(row.id, vec);
      done++;
      process.stdout.write(`\r[backfill] ${done}/${rows.length} (${failed} fail)`);
      // Rate-limit conservador
      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      failed++;
      console.error(`\n[fail] ${row.id}: ${err.message}`);
    }
  }
  console.log(`\n[backfill] OK ${done}/${rows.length} (failed ${failed})`);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
