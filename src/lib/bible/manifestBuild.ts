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
