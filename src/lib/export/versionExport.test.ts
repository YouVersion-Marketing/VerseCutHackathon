import { describe, expect, it, vi } from 'vitest';
import { runVersionExport, type VersionExportDeps } from './versionExport';

const baseOpts = {
  reference: { bookId: 'JHN', chapter: 3, fromVerse: 16, toVerse: 16 },
  aspect: '1:1' as const,
  dimensions: { width: 1080, height: 1080 },
  logoStyle: 'logo-light' as const,
  gradientId: 'ocean',
  concurrency: 2,
};

function makeDeps(overrides: Partial<VersionExportDeps> = {}): VersionExportDeps {
  return {
    fetchPassage: vi.fn(async (q) => ({
      reference: `ref-${q.versionId}`,
      text: `text-${q.versionId}`,
      versionAbbreviation: q.versionId,
    })),
    renderImage: vi.fn(async () => ({
      blob: new Blob(['x']),
      url: 'blob:x',
      ext: 'png' as const,
      kind: 'image' as const,
    })),
    uploadImage: vi.fn(async (_blob, name) => `https://cdn/${name}`),
    ...overrides,
  };
}

describe('runVersionExport', () => {
  it('produces a row per version with localized text and cdn link', async () => {
    const deps = makeDeps();
    const rows = await runVersionExport(
      [
        { id: '111', code: 'en' },
        { id: '128', code: 'es' },
      ],
      deps,
      baseOpts,
    );
    expect(rows).toHaveLength(2);
    const niv = rows.find((r) => r.version_id === '111')!;
    expect(niv).toEqual({
      version_id: '111',
      reference: 'ref-111',
      verse_text: 'text-111',
      air_cdn_link: 'https://cdn/111.png',
    });
  });

  it('retries once then records a blank link on repeated failure', async () => {
    const uploadImage = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom again'));
    const rows = await runVersionExport(
      [{ id: '999', code: 'xx' }],
      makeDeps({ uploadImage }),
      baseOpts,
    );
    expect(uploadImage).toHaveBeenCalledTimes(2);
    expect(rows[0].air_cdn_link).toBe('');
  });

  it('skips versions the checkpoint reports done', async () => {
    const deps = makeDeps();
    const rows = await runVersionExport(
      [
        { id: '1', code: 'en' },
        { id: '2', code: 'en' },
      ],
      deps,
      { ...baseOpts, isDone: (id) => id === '1' },
    );
    expect(rows.map((r) => r.version_id)).toEqual(['2']);
    expect(deps.fetchPassage).toHaveBeenCalledTimes(1);
  });
});
