// Exercise the exact server upload path the /api/air/upload route runs:
// a real image File -> arrayBuffer -> uploadToAir, with full error output.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getAirEnv, uploadToAir } from '../src/lib/server/air';

const here = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(resolve(here, '../.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === '"' || v[0] === "'")) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
} catch {}

async function main() {
  const path = process.argv[2] ?? '/tmp/air-1080.jpg';
  const bytes = readFileSync(path);
  const file = new File([bytes], '111.jpg', { type: 'image/jpeg' });
  console.log(`file: ${file.name} ${file.type} ${file.size} bytes`);

  const env = getAirEnv();
  if (!env) {
    console.error('getAirEnv() returned null — env not loaded');
    process.exit(2);
  }

  // Mirror the route body exactly.
  const buf = new Uint8Array(await file.arrayBuffer());
  const t0 = Date.now();
  const { cdnUrl } = await uploadToAir(buf, { fileName: file.name, mime: file.type, env });
  console.log(`uploadToAir OK in ${Date.now() - t0}ms -> ${cdnUrl}`);

  const check = await fetch(cdnUrl);
  console.log(`link resolves: HTTP ${check.status} ${check.headers.get('content-type')}`);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
