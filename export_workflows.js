// Helper: extract {name, nodes, connections, settings} from a parsed n8n_get_workflow result
const fs = require('fs');
const path = require('path');

const PERSIST_DIR = 'C:\\Users\\Damian Martinez\\.claude\\projects\\c--Users-Damian-Martinez-Desktop-holamundo2\\32bee148-6455-4e09-b04c-9ad2f179c99b\\tool-results';

const OUT_DIR = 'C:\\Users\\Damian Martinez\\Desktop\\holamundo2\\studio-multiagente\\workflows';

function extractFields(wfData) {
  const out = {
    name: wfData.name,
    nodes: wfData.nodes,
    connections: wfData.connections,
    settings: wfData.settings,
  };
  return out;
}

// Process a persisted file (the kind that wraps text content as [{type:"text", text:"..."}])
function loadFromPersistedFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const arr = JSON.parse(raw);
  // arr[0].text is a JSON string of {success, data:{...}}
  const inner = JSON.parse(arr[0].text);
  return inner.data;
}

const tasks = [
  {
    file: path.join(PERSIST_DIR, 'toolu_01TMnvutA3aev6tu67c8Gpgw.json'),
    out: path.join(OUT_DIR, 'agent_energy_assessor.json'),
    expectedName: 'agent_energy_assessor',
  },
  {
    file: path.join(PERSIST_DIR, 'toolu_019jq351vt2wbHubx8ExiZ3R.json'),
    out: path.join(OUT_DIR, 'agent_contracts.json'),
    expectedName: 'agent_contracts',
  },
];

const results = [];

for (const t of tasks) {
  try {
    const data = loadFromPersistedFile(t.file);
    if (data.name !== t.expectedName) {
      results.push({ name: t.expectedName, status: 'NAME_MISMATCH', got: data.name });
      continue;
    }
    const extracted = extractFields(data);
    fs.writeFileSync(t.out, JSON.stringify(extracted, null, 2), 'utf8');
    results.push({ name: t.expectedName, status: 'OK', bytes: fs.statSync(t.out).size });
  } catch (e) {
    results.push({ name: t.expectedName, status: 'ERR', error: String(e) });
  }
}

console.log(JSON.stringify(results, null, 2));
