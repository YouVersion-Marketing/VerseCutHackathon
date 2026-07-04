import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyMedia, loadManifest } from './videoLibrary';

describe('proxyMedia', () => {
  it('rewrites the CDN host to the same-origin media proxy', () => {
    expect(
      proxyMedia('https://yv-content-assets.youversionapi.com/delivery/videos/abc/high.webm'),
    ).toBe('/yvmedia/delivery/videos/abc/high.webm');
  });
  it('leaves non-CDN urls unchanged', () => {
    expect(proxyMedia('https://example.com/x.mp4')).toBe('https://example.com/x.mp4');
  });
  it('returns undefined for empty input', () => {
    expect(proxyMedia(null)).toBeUndefined();
    expect(proxyMedia(undefined)).toBeUndefined();
  });
});

describe('loadManifest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('dedupes concurrent calls into a single fetch (regression)', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ dates: {}, imports: [] }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    // Fire several concurrent loads before any resolves.
    await Promise.all([loadManifest(), loadManifest(), loadManifest()]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
