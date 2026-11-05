// The shipped bundle must not contain dev fixtures, dev hooks, research material or backups.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

if (!existsSync('dist')) { console.error('dist/ missing: run npm run build first'); process.exit(1); }
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const forbiddenText = ['M1A_P04', 'M1A_P05', 'm1a_p04', 'm1a_p05', '__d31', 'dev-fixture', '開発用（出荷版', 'reference_only', 'research/'];
let bad = 0;
for (const f of walk('dist')) {
  // Only the reviewed title and three licensed interaction samples may ship as binary assets.
  if (/^dist\/assets\/winter-keyart-[\w-]+\.jpg$/.test(f) && statSync(f).size < 600_000) continue;
  if (/^dist\/assets\/(press|move|deny)-[\w-]+\.wav$/.test(f) && statSync(f).size < 64_000) continue;
  if (/\.(png|jpe?g|wav|ogg|mp3|glb|blend|zip|bak)$/i.test(f)) { console.error('FAIL unexpected asset in dist:', f); bad++; continue; }
  const t = readFileSync(f, 'utf8');
  for (const w of forbiddenText) if (t.includes(w)) { console.error(`FAIL ${f} contains '${w}'`); bad++; }
}
if (bad) process.exit(1);
console.log('check-bundle: ok');
