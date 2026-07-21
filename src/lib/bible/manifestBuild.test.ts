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
