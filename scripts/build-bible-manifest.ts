import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseVersionsCsv,
  buildManifest,
  type EnrichedVersion,
} from '../src/lib/bible/manifestBuild';
import { APP_LANGUAGES } from '../src/lib/bible/appLanguages';

const VERSION_URL = 'https://bible.youversionapi.com/3.1/version.json';
const HEADERS = {
  Referer: 'http://yvapi.youversionapi.com',
  'X-YouVersion-Client': 'youversion',
  'X-YouVersion-App-Platform': 'internal',
  'X-YouVersion-App-Version': '1',
};
const CONCURRENCY = 20;

interface VersionLanguage {
  iso_639_1?: string;
  language_tag?: string;
  name?: string;
  text_direction?: string;
}
interface VersionData {
  abbreviation?: string;
  local_abbreviation?: string;
  title?: string;
  local_title?: string;
  language?: VersionLanguage;
}

async function fetchVersion(id: string): Promise<EnrichedVersion | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${VERSION_URL}?id=${id}`, { headers: HEADERS });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = (await res.json()) as { response?: { data?: VersionData } };
      const data = body?.response?.data ?? {};
      const lang = data.language ?? {};
      if (!lang.language_tag) return null;
      return {
        id,
        tag: lang.language_tag,
        code: lang.iso_639_1 || lang.language_tag,
        langName: lang.name || lang.language_tag,
        dir: lang.text_direction === 'rtl' ? 'rtl' : 'ltr',
        abbr: data.local_abbreviation || data.abbreviation || '',
        title: data.title || data.local_title || '',
      };
    } catch {
      if (attempt === 2) return null;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return null;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (t: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      out[idx] = await fn(items[idx]);
      if (++done % 200 === 0) console.error(`  ${done}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const csv = readFileSync(resolve(here, 'data/bible-versions.csv'), 'utf8');
  const rows = parseVersionsCsv(csv);
  console.error(`Parsed ${rows.length} rows; fetching version metadata...`);

  const results = await mapPool(rows, CONCURRENCY, (r) => fetchVersion(r.id));
  const enriched = results.filter((v): v is EnrichedVersion => v !== null);
  const skipped = results.length - enriched.length;

  const curated = new Set(APP_LANGUAGES.map((l) => l.defaultVersionId));
  const manifest = buildManifest(enriched, curated);

  const outPath = resolve(here, '../public/bible-manifest.json');
  writeFileSync(outPath, JSON.stringify(manifest) + '\n', 'utf8');
  console.error(
    `Wrote ${manifest.languages.length} languages / ${enriched.length} versions ` +
      `(${skipped} skipped) -> ${outPath}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
