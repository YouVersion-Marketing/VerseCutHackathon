# Full Bible Version Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the language/version picker to the full YouVersion catalog — every language tag selectable, every version available — via a committed manifest generated from the versions CSV enriched by the internal `version.json` endpoint.

**Architecture:** A pure helper module parses the CSV and builds a manifest (grouped by `language_tag`, English names, curated-else-lowest default). A one-time `tsx` build script fetches version metadata and writes `public/bible-manifest.json`. The internal Bible provider loads that JSON once (memoized fetch) and serves languages/versions from it. `Language` gains a `code` field so downstream locale features (voices/CTA/fonts) keep receiving iso_639_1 codes.

**Tech Stack:** TypeScript, Next.js 16 (App Router), Vitest, `tsx` (new devDep for the build script), Node 25 global `fetch`.

## Global Constraints

- Verse **text** must keep flowing through the internal reader API (`version.json`/`chapter.json`); never route text through the license-scoped Platform API.
- No `any` — use `unknown` + narrowing.
- New pure functions in `lib/` get a `*.test.ts` beside them.
- `npm run check` must pass before every push.
- The build script is **not** part of `npm run build` (network-heavy, one-shot).
- Language labels are English-only; version titles are the English `title`.
- Default version per language: curated default from `appLanguages.ts` where present, else the lowest numeric version id.

---

### Task 1: Pure manifest helpers

**Files:**
- Create: `src/lib/bible/manifestBuild.ts`
- Test: `src/lib/bible/manifestBuild.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface CsvRow { id: string; tag: string }`
  - `interface EnrichedVersion { id: string; tag: string; code: string; langName: string; dir: 'ltr' | 'rtl'; abbr: string; title: string }`
  - `interface ManifestVersion { id: string; abbr: string; title: string }`
  - `interface ManifestLanguage { tag: string; code: string; name: string; dir: 'ltr' | 'rtl'; defaultVersionId: string; versionCount: number }`
  - `interface BibleManifest { languages: ManifestLanguage[]; versionsByTag: Record<string, ManifestVersion[]> }`
  - `function parseVersionsCsv(text: string): CsvRow[]`
  - `function buildManifest(enriched: EnrichedVersion[], curatedDefaultIds: Set<string>): BibleManifest`

- [ ] **Step 1: Write the failing test**

Create `src/lib/bible/manifestBuild.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseVersionsCsv, buildManifest, type EnrichedVersion } from './manifestBuild';

describe('parseVersionsCsv', () => {
  it('parses id/tag rows and skips the header and blank/malformed lines', () => {
    const csv = 'version_id,language_tag\n1,eng\n12,eng\n\n999\n2,spa\n';
    expect(parseVersionsCsv(csv)).toEqual([
      { id: '1', tag: 'eng' },
      { id: '12', tag: 'eng' },
      { id: '2', tag: 'spa' },
    ]);
  });
});

function v(partial: Partial<EnrichedVersion> & { id: string; tag: string }): EnrichedVersion {
  return {
    code: 'xx',
    langName: 'Lang',
    dir: 'ltr',
    abbr: partial.id,
    title: `Title ${partial.id}`,
    ...partial,
  };
}

describe('buildManifest', () => {
  const enriched: EnrichedVersion[] = [
    v({ id: '12', tag: 'eng', code: 'en', langName: 'English', abbr: 'ASV' }),
    v({ id: '1', tag: 'eng', code: 'en', langName: 'English', abbr: 'KJV' }),
    v({ id: '111', tag: 'eng', code: 'en', langName: 'English', abbr: 'NIV' }),
    v({ id: '128', tag: 'spa', code: 'es', langName: 'Spanish', abbr: 'RVR', dir: 'ltr' }),
  ];

  it('groups by tag, sorts versions by abbreviation, and counts them', () => {
    const m = buildManifest(enriched, new Set());
    expect(m.versionsByTag.eng.map((x) => x.abbr)).toEqual(['ASV', 'KJV', 'NIV']);
    const eng = m.languages.find((l) => l.tag === 'eng')!;
    expect(eng).toMatchObject({ tag: 'eng', code: 'en', name: 'English', versionCount: 3 });
  });

  it('sorts languages by English name', () => {
    const m = buildManifest(enriched, new Set());
    expect(m.languages.map((l) => l.name)).toEqual(['English', 'Spanish']);
  });

  it('uses the curated default when one of the tag ids is curated', () => {
    const m = buildManifest(enriched, new Set(['111']));
    expect(m.languages.find((l) => l.tag === 'eng')!.defaultVersionId).toBe('111');
  });

  it('falls back to the lowest numeric id when no curated default matches', () => {
    const m = buildManifest(enriched, new Set(['9999']));
    expect(m.languages.find((l) => l.tag === 'eng')!.defaultVersionId).toBe('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bible/manifestBuild.test.ts`
Expected: FAIL — `Failed to resolve import "./manifestBuild"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/bible/manifestBuild.ts`:

```ts
export interface CsvRow {
  id: string;
  tag: string;
}

export interface EnrichedVersion {
  id: string;
  tag: string;
  code: string;
  langName: string;
  dir: 'ltr' | 'rtl';
  abbr: string;
  title: string;
}

export interface ManifestVersion {
  id: string;
  abbr: string;
  title: string;
}

export interface ManifestLanguage {
  tag: string;
  code: string;
  name: string;
  dir: 'ltr' | 'rtl';
  defaultVersionId: string;
  versionCount: number;
}

export interface BibleManifest {
  languages: ManifestLanguage[];
  versionsByTag: Record<string, ManifestVersion[]>;
}

/** Parse the `version_id,language_tag` CSV, skipping the header and bad rows. */
export function parseVersionsCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [idRaw, tagRaw] = trimmed.split(',');
    const id = (idRaw ?? '').trim();
    const tag = (tagRaw ?? '').trim();
    if (!id || !tag || id === 'version_id') continue;
    rows.push({ id, tag });
  }
  return rows;
}

const byNumericId = (a: string, b: string) => Number(a) - Number(b);

/**
 * Group enriched versions by language_tag into the client manifest. Versions
 * sort by abbreviation; the default is the curated id present in the group,
 * else the lowest numeric id. Language metadata comes from the group's rows
 * (they share a language).
 */
export function buildManifest(
  enriched: EnrichedVersion[],
  curatedDefaultIds: Set<string>,
): BibleManifest {
  const byTag = new Map<string, EnrichedVersion[]>();
  for (const v of enriched) {
    const arr = byTag.get(v.tag);
    if (arr) arr.push(v);
    else byTag.set(v.tag, [v]);
  }

  const languages: ManifestLanguage[] = [];
  const versionsByTag: Record<string, ManifestVersion[]> = {};

  for (const [tag, list] of byTag) {
    const seen = new Set<string>();
    const unique = list.filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)));

    const versions = unique
      .map((v) => ({ id: v.id, abbr: v.abbr, title: v.title }))
      .sort((a, b) => a.abbr.localeCompare(b.abbr) || byNumericId(a.id, b.id));

    const ids = unique.map((v) => v.id);
    const curated = ids.filter((id) => curatedDefaultIds.has(id)).sort(byNumericId);
    const defaultVersionId = curated[0] ?? ids.slice().sort(byNumericId)[0];

    const meta = unique[0];
    languages.push({
      tag,
      code: meta.code,
      name: meta.langName,
      dir: meta.dir,
      defaultVersionId,
      versionCount: versions.length,
    });
    versionsByTag[tag] = versions;
  }

  languages.sort((a, b) => a.name.localeCompare(b.name));
  return { languages, versionsByTag };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bible/manifestBuild.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bible/manifestBuild.ts src/lib/bible/manifestBuild.test.ts
git commit -m "feat: add pure Bible manifest build helpers"
```

---

### Task 2: Manifest-backed internal provider

**Files:**
- Modify: `src/lib/bible/types.ts` (add `Language.code`)
- Modify: `src/lib/bible/internalProvider.ts` (replace `listLanguages`/`listVersions`; remove `appLanguages` import)
- Test: `src/lib/bible/internalProvider.test.ts` (add a describe block)

**Interfaces:**
- Consumes: `BibleManifest` from Task 1; `Language`, `BibleVersion` from `types.ts`.
- Produces:
  - `function loadBibleManifest(): Promise<BibleManifest>` (memoized fetch of `/bible-manifest.json`)
  - `function __resetBibleManifest(): void` (test hook)
  - `YouVersionInternalProvider.listLanguages()` → `Language[]` with `{ id: tag, name, code }`
  - `YouVersionInternalProvider.listVersions(tag)` → `BibleVersion[]`

- [ ] **Step 1: Add `code` to the Language type**

In `src/lib/bible/types.ts`, change the `Language` interface to:

```ts
export interface Language {
  id: string;
  name: string;
  /** iso_639_1 locale code for downstream features (voices/CTA/fonts). */
  code?: string;
  /** Optional grouping label for the picker (e.g. "Top picks"). */
  group?: string;
}
```

- [ ] **Step 2: Write the failing test**

In `src/lib/bible/internalProvider.test.ts`, add these imports at the top (after the existing import line) and a new describe block at the end of the file:

```ts
import { afterEach, beforeEach, vi } from 'vitest';
import {
  YouVersionInternalProvider,
  loadBibleManifest,
  __resetBibleManifest,
} from './internalProvider';

const MANIFEST = {
  languages: [
    { tag: 'eng', code: 'en', name: 'English', dir: 'ltr', defaultVersionId: '1', versionCount: 2 },
    { tag: 'spa', code: 'es', name: 'Spanish', dir: 'ltr', defaultVersionId: '128', versionCount: 1 },
  ],
  versionsByTag: {
    eng: [
      { id: '12', abbr: 'ASV', title: 'American Standard Version' },
      { id: '1', abbr: 'KJV', title: 'King James Version' },
    ],
    spa: [{ id: '128', abbr: 'RVR1960', title: 'Reina-Valera 1960' }],
  },
};

describe('YouVersionInternalProvider manifest', () => {
  beforeEach(() => {
    __resetBibleManifest();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => MANIFEST })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    __resetBibleManifest();
  });

  it('lists languages with English names and iso codes', async () => {
    const langs = await new YouVersionInternalProvider().listLanguages();
    expect(langs).toEqual([
      { id: 'eng', name: 'English', code: 'en' },
      { id: 'spa', name: 'Spanish', code: 'es' },
    ]);
  });

  it('lists all versions for a language tag', async () => {
    const vs = await new YouVersionInternalProvider().listVersions('eng');
    expect(vs).toEqual([
      { id: '12', abbreviation: 'ASV', name: 'American Standard Version', languageId: 'eng' },
      { id: '1', abbreviation: 'KJV', name: 'King James Version', languageId: 'eng' },
    ]);
  });

  it('memoizes the manifest fetch across calls', async () => {
    const p = new YouVersionInternalProvider();
    await p.listLanguages();
    await p.listVersions('spa');
    await loadBibleManifest();
    expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/bible/internalProvider.test.ts`
Expected: FAIL — `loadBibleManifest`/`__resetBibleManifest` not exported.

- [ ] **Step 4: Write the implementation**

In `src/lib/bible/internalProvider.ts`:

1. Replace the `appLanguages` import line

```ts
import { APP_LANGUAGES, APP_LANGUAGE_BY_CODE } from './appLanguages';
```

with

```ts
import type { BibleManifest } from './manifestBuild';
```

2. Add the memoized loader just below the `BASE` constant:

```ts
let manifestPromise: Promise<BibleManifest> | null = null;

/** Fetch the generated catalog once; memoized for the session. */
export function loadBibleManifest(): Promise<BibleManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch('/bible-manifest.json').then((r) => {
      if (!r.ok) throw new Error(`bible-manifest.json ${r.status}`);
      return r.json() as Promise<BibleManifest>;
    });
  }
  return manifestPromise;
}

/** Test hook: clear the memoized manifest. */
export function __resetBibleManifest(): void {
  manifestPromise = null;
}
```

3. Replace the existing `listLanguages` and `listVersions` methods with:

```ts
  async listLanguages(): Promise<Language[]> {
    const m = await loadBibleManifest();
    return m.languages.map((l) => ({ id: l.tag, name: l.name, code: l.code }));
  }

  async listVersions(languageId: string): Promise<BibleVersion[]> {
    const m = await loadBibleManifest();
    const versions = m.versionsByTag[languageId] ?? [];
    return versions.map((v) => ({
      id: v.id,
      abbreviation: v.abbr,
      name: v.title,
      languageId,
    }));
  }
```

(`listBooks` and `fetchPassage` are unchanged — they still call `getVersion`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/bible/internalProvider.test.ts`
Expected: PASS (existing `extractVerses` tests + 3 new manifest tests).

- [ ] **Step 6: Verify no dangling references / lint clean**

Run: `npm run typecheck && npm run lint`
Expected: no errors. (If `APP_LANGUAGES`/`APP_LANGUAGE_BY_CODE` are now unused anywhere else, the removed import is already handled here.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/bible/types.ts src/lib/bible/internalProvider.ts src/lib/bible/internalProvider.test.ts
git commit -m "feat: back internal Bible provider with the generated manifest"
```

---

### Task 3: Build script + generate the real manifest

**Files:**
- Create: `scripts/build-bible-manifest.ts`
- Create: `scripts/data/bible-versions.csv` (committed copy of the source CSV)
- Create: `public/bible-manifest.json` (generated, committed)
- Modify: `package.json` (add `tsx` devDep + `bible:manifest` script)

**Interfaces:**
- Consumes: `parseVersionsCsv`, `buildManifest`, `EnrichedVersion` from Task 1; `APP_LANGUAGES` from `appLanguages.ts`.
- Produces: `public/bible-manifest.json` matching `BibleManifest`.

- [ ] **Step 1: Copy the source CSV into the repo**

```bash
mkdir -p scripts/data
cp "/Users/danluk/Downloads/versions 3(in).csv" scripts/data/bible-versions.csv
head -3 scripts/data/bible-versions.csv
```

Expected: header `version_id,language_tag` then data rows.

- [ ] **Step 2: Add tsx and the npm script**

```bash
npm install --save-dev tsx
```

Then in `package.json` `scripts`, add:

```json
    "bible:manifest": "tsx scripts/build-bible-manifest.ts",
```

- [ ] **Step 3: Write the build script**

Create `scripts/build-bible-manifest.ts`:

```ts
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
```

Note: grouping uses the `language_tag` returned by `version.json` (authoritative), not the CSV's tag column — the CSV is only the id list.

- [ ] **Step 4: Generate the real manifest**

Run: `npm run bible:manifest`
Expected: progress lines, then `Wrote N languages / M versions (K skipped) -> .../public/bible-manifest.json`. Takes a few minutes.

- [ ] **Step 5: Spot-check the output**

```bash
node -e "const m=require('./public/bible-manifest.json');console.log('langs',m.languages.length);const en=m.languages.find(l=>l.tag==='eng');console.log('english',en);console.log('eng versions',m.versionsByTag.eng.length);"
```

Expected: hundreds of languages; `english` has `code:'en'`, `name:'English'`, and a curated `defaultVersionId`; `eng` has many versions.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-bible-manifest.ts scripts/data/bible-versions.csv public/bible-manifest.json package.json package-lock.json
git commit -m "feat: generate full Bible version manifest from catalog"
```

---

### Task 4: Route the hybrid provider through the manifest

**Files:**
- Modify: `src/lib/bible/hybridProvider.ts`

**Interfaces:**
- Consumes: `YouVersionInternalProvider` (now manifest-backed) from Task 2.
- Produces: `HybridBibleProvider.listLanguages()` returning `Language[]` that include `code`, grouped as "Top picks" + "Bible App languages"; `i:`-prefixed ids only (Platform layer removed).

- [ ] **Step 1: Rewrite the hybrid provider**

Per the approved spec, drop the Platform-catalog layer (the manifest supersedes it and avoids Platform 403s) and keep "Top picks". Replace `src/lib/bible/hybridProvider.ts` with:

```ts
import type {
  BibleProvider,
  BibleVersion,
  Book,
  Language,
  Passage,
  PassageQuery,
} from './types';
import { YouVersionInternalProvider } from './internalProvider';

const TOP_PICKS = ['eng', 'spa', 'por', 'fra'];

/**
 * One grouped picker over the internal reader API (full manifest). "Top picks"
 * are surfaced first, then every catalog language. Ids stay `i:`-prefixed so
 * downstream calls route back to the internal provider.
 */
export class HybridBibleProvider implements BibleProvider {
  private internal = new YouVersionInternalProvider();

  async listLanguages(): Promise<Language[]> {
    const all = await this.internal.listLanguages();
    const byTag = new Map(all.map((l) => [l.id, l]));
    const out: Language[] = [];

    for (const tag of TOP_PICKS) {
      const l = byTag.get(tag);
      if (l) out.push({ ...l, id: `i:${l.id}`, group: 'Top picks' });
    }
    for (const l of all) {
      out.push({ ...l, id: `i:${l.id}`, group: 'All languages' });
    }
    return out;
  }

  private route(prefixed: string): string {
    const i = prefixed.indexOf(':');
    return i >= 0 ? prefixed.slice(i + 1) : prefixed;
  }

  async listVersions(languageId: string): Promise<BibleVersion[]> {
    const id = this.route(languageId);
    const versions = await this.internal.listVersions(id);
    return versions.map((v) => ({ ...v, id: `i:${v.id}` }));
  }

  async listBooks(versionId: string): Promise<Book[]> {
    return this.internal.listBooks(this.route(versionId));
  }

  async fetchPassage(query: PassageQuery): Promise<Passage> {
    return this.internal.fetchPassage({ ...query, versionId: this.route(query.versionId) });
  }
}
```

- [ ] **Step 2: Typecheck, lint, and run the suite**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: no errors; all tests pass. (`YouVersionPlatformProvider` may now be referenced only by `index.ts`'s `'youversion'` case — that is fine, keep it.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/bible/hybridProvider.ts
git commit -m "feat: route hybrid Bible picker through the full manifest"
```

---

### Task 5: Feed the iso code to downstream locale features

**Files:**
- Modify: `src/lib/useStudio.ts` (lines ~200-204 English default; lines ~269-272 `languageCode`)

**Interfaces:**
- Consumes: `Language.code` (Task 2), `languages` state array already in `useStudio`.
- Produces: no new exports; `languageCode` now resolves from the selected language's `code`.

- [ ] **Step 1: Make the English default match the manifest ids**

In `src/lib/useStudio.ts`, the "Load languages once" effect selects a default. Replace the `def` assignment (currently matching `'i:en' | 'en' | 'eng'`) with one that also matches by `code`:

```ts
        const def =
          langs.find((l) => l.code === 'en') ??
          langs.find((l) => l.id === 'i:eng' || l.id === 'eng') ??
          langs.find((l) => /^english$/i.test(l.name)) ??
          langs[0];
```

- [ ] **Step 2: Derive `languageCode` from the selected language's code**

Replace the current bare-code block:

```ts
  // Bare language code (the picker ids are source-prefixed, e.g. "i:af" / "p:aai").
  const languageCode = languageId.includes(':')
    ? languageId.slice(languageId.indexOf(':') + 1)
    : languageId;
```

with:

```ts
  // Locale code for downstream features (voices/CTA/fonts). Manifest languages
  // carry an iso_639_1 `code`; fall back to the id minus any source prefix.
  const selectedLanguage = languages.find((l) => l.id === languageId);
  const parsedLanguageId = languageId.includes(':')
    ? languageId.slice(languageId.indexOf(':') + 1)
    : languageId;
  const languageCode = selectedLanguage?.code ?? parsedLanguageId;
```

- [ ] **Step 3: Typecheck, lint, and run the suite**

Run: `npm run check`
Expected: typecheck + lint clean, all tests pass.

- [ ] **Step 4: Manual in-browser verification**

Run `npm run dev`, open the studio, and confirm:
1. The language dropdown lists far more than ~70 languages and is searchable.
2. Selecting English pre-selects a version and lists many versions.
3. Selecting a non-curated language lists its versions and a verse renders after Generate.
4. A voice-supported language (e.g. Spanish) still offers voices (confirms `code` plumbing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/useStudio.ts
git commit -m "feat: resolve locale code from selected language for full catalog"
```

---

## Self-Review

**Spec coverage:**
- Pipeline / `version.json` enrichment → Task 3. ✓
- Manifest shape (tag/code/name/dir/default/versionCount + versionsByTag) → Task 1. ✓
- Default = curated-else-lowest → Task 1 (Steps 3 tests + impl), curated set sourced in Task 3. ✓
- Committed CSV + not-in-build script → Task 3. ✓
- JSON asset fetched once (memoized) → Task 2. ✓
- `internalProvider` manifest-backed → Task 2. ✓
- `Language.code` added → Task 2 Step 1. ✓
- Hybrid passes code, drops Platform layer → Task 4. ✓
- `useStudio` uses `code` → Task 5. ✓
- English-only labels; English `title` → Task 1 (title/name fields). ✓
- Testing of pure pieces → Task 1; provider behavior → Task 2. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code and exact commands. ✓

**Type consistency:** `EnrichedVersion`, `BibleManifest`, `ManifestVersion`, `ManifestLanguage` defined in Task 1 and used verbatim in Tasks 2–3. `loadBibleManifest`/`__resetBibleManifest` defined and consumed consistently. `Language.code` added in Task 2 and consumed in Tasks 4–5. ✓

**Note on `dir`:** the manifest carries `dir` for future RTL use, but RTL rendering today is driven by script detection in `fonts.ts`, so no task threads `dir` into the UI. Intentional, in-scope with the spec's guardrails.
