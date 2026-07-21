// Standalone end-to-end check for the AIR upload path (no browser needed).
// Loads AIR_* from .env.local, uploads a tiny PNG, and prints the CDN link.
// Run: npx tsx scripts/test-air-upload.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getAirEnv, uploadToAir } from '../src/lib/server/air';

const here = dirname(fileURLToPath(import.meta.url));

// Load .env.local (tsx scripts don't auto-load it like Next does).
try {
  const raw = readFileSync(resolve(here, '../.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (val.length >= 2 && val[0] === val[val.length - 1] && (val[0] === '"' || val[0] === "'")) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // no .env.local — rely on the ambient environment
}

// A minimal 1x1 red PNG.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
  const env = getAirEnv();
  if (!env) {
    console.error(
      'AIR not configured. Set AIR_API_KEY and AIR_WORKSPACE_ID in .env.local ' +
        '(or run `vercel env pull .env.local`), then re-run.',
    );
    process.exit(2);
  }
  console.error(`Uploading test PNG to AIR (${env.baseUrl}, workspace ${env.workspaceId})…`);
  const bytes = new Uint8Array(Buffer.from(PNG_BASE64, 'base64'));
  const { cdnUrl } = await uploadToAir(bytes, {
    fileName: `versecut-air-test.png`,
    mime: 'image/png',
    env,
  });
  console.log('CDN link:', cdnUrl);
}

main().catch((e) => {
  console.error('AIR upload failed:', e);
  process.exit(1);
});
