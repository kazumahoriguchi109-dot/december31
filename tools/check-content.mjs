// Static content checks: every data file parses; every copy('key') used in src exists in data/ui_copy.json.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let bad = 0;
const fail = (m) => { console.error('FAIL', m); bad++; };

for (const f of readdirSync('data').filter((n) => n.endsWith('.json'))) {
  try { JSON.parse(readFileSync(join('data', f), 'utf8')); } catch (e) { fail(`data/${f} does not parse: ${e.message}`); }
}
const copy = JSON.parse(readFileSync('data/ui_copy.json', 'utf8')).copy;
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const f of walk('src').filter((n) => n.endsWith('.ts'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/\bcopy\(\s*(?:[^'"`)]*\?\s*)?'([a-z0-9_]+)'(?:\s*:\s*'([a-z0-9_]+)')?/g)) {
    for (const k of [m[1], m[2]].filter(Boolean)) if (!(k in copy)) fail(`${f}: copy key '${k}' is not in data/ui_copy.json`);
  }
}
if (bad) process.exit(1);
console.log('check-content: ok');
