import type {
  BibleProvider,
  BibleVersion,
  Book,
  Language,
  Passage,
  PassageQuery,
} from './types';
import type { BibleManifest } from './manifestBuild';

/**
 * Verse text via YouVersion's internal reader API (bible.youversionapi.com),
 * reached through the same-origin /api/yvb proxy. Unlike the Platform API this
 * is not license-gated, so it serves the full Bible App language list
 * (alfred/bible_api/language_default_versions.py) — including Afrikaans.
 *
 * Versions are integer ids; references are USFM (e.g. JHN.3). The chapter
 * endpoint returns the whole chapter as HTML with per-verse `data-usfm` spans,
 * which we parse to extract the requested verse range.
 */
const BASE = '/api/yvb/3.1';

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

interface VersionData {
  abbreviation?: string;
  local_abbreviation?: string;
  title?: string;
  local_title?: string;
  books?: Array<{
    usfm: string;
    human?: string;
    text?: boolean;
    chapters?: unknown[];
  }>;
}

const versionCache = new Map<string, Promise<VersionData>>();

async function getVersion(versionId: string): Promise<VersionData> {
  let p = versionCache.get(versionId);
  if (!p) {
    p = fetch(`${BASE}/version.json?id=${versionId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`version.json ${r.status}`);
        return r.json();
      })
      .then((j) => (j?.response?.data ?? {}) as VersionData);
    versionCache.set(versionId, p);
  }
  return p;
}

export class YouVersionInternalProvider implements BibleProvider {
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

  async listBooks(versionId: string): Promise<Book[]> {
    const data = await getVersion(versionId);
    return (data.books ?? [])
      .filter((b) => b.text !== false)
      .map((b) => ({
        id: b.usfm,
        name: b.human || b.usfm,
        chapters: Array.isArray(b.chapters) ? Math.max(1, b.chapters.length) : 150,
      }));
  }

  async fetchPassage(query: PassageQuery): Promise<Passage> {
    const chapterRef = `${query.bookId}.${query.chapter}`;
    const res = await fetch(
      `${BASE}/chapter.json?id=${query.versionId}&reference=${chapterRef}&format=html`,
    );
    if (!res.ok) throw new Error(`chapter.json failed (${res.status})`);
    const data = (await res.json())?.response?.data ?? {};
    const text = extractVerses(
      data.content ?? '',
      query.bookId,
      query.chapter,
      query.fromVerse,
      query.toVerse,
    );

    const version = await getVersion(query.versionId).catch(() => null);
    const book = version?.books?.find((b) => b.usfm === query.bookId);
    const bookName = book?.human || query.bookId;
    const range =
      query.fromVerse === query.toVerse
        ? `${query.fromVerse}`
        : `${query.fromVerse}-${query.toVerse}`;

    // Intentionally NOT falling back to the whole stripped chapter when
    // extraction fails — that silently rendered an entire chapter as the verse.
    return {
      reference: `${bookName} ${query.chapter}:${range}`,
      text,
      versionAbbreviation: version?.local_abbreviation || version?.abbreviation || '',
    };
  }
}

/** Pull verses [from..to] out of a chapter's HTML using data-usfm spans. */
export function extractVerses(
  html: string,
  bookId: string,
  chapter: number,
  from: number,
  to: number,
): string {
  if (!html || typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Requested refs. YouVersion HTML sometimes merges adjacent verses into one
  // span whose data-usfm holds several refs (e.g. "JHN.3.16+JHN.3.17" or
  // space-separated), so match by membership rather than an exact selector.
  const wanted = new Set<string>();
  for (let v = from; v <= to; v++) wanted.add(`${bookId}.${chapter}.${v}`);
  const matches = (usfm: string) =>
    usfm.split(/[+\s]+/).some((ref) => wanted.has(ref));

  const parts: string[] = [];
  doc.querySelectorAll('[data-usfm]').forEach((node) => {
    if (!matches(node.getAttribute('data-usfm') ?? '')) return;
    // Skip a node nested inside an already-matched verse node (avoids counting
    // the same words twice).
    const ancestor = node.parentElement?.closest('[data-usfm]');
    if (ancestor && matches(ancestor.getAttribute('data-usfm') ?? '')) return;

    // Prefer the `.content` spans (verse words); they exclude the verse label.
    let verseText = '';
    const content = node.querySelectorAll('.content');
    if (content.length) {
      content.forEach((c) => (verseText += c.textContent ?? ''));
    } else {
      verseText += node.textContent ?? '';
    }
    verseText = verseText.replace(/\s+/g, ' ').trim();
    if (verseText) parts.push(verseText);
  });
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
