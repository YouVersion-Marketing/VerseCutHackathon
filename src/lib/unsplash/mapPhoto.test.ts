import { describe, expect, it } from 'vitest';
import {
  isUnsplashDownloadLocation,
  mapUnsplashPhoto,
  mapUnsplashPhotos,
  parseSearchParams,
} from './mapPhoto';

const sampleRaw = {
  id: 'eOLpJytrbsQ',
  description: 'A man drinking a coffee.',
  alt_description: null,
  urls: {
    raw: 'https://images.unsplash.com/photo-1',
    full: 'https://images.unsplash.com/photo-1?full',
    regular: 'https://images.unsplash.com/photo-1?regular',
    small: 'https://images.unsplash.com/photo-1?small',
    thumb: 'https://images.unsplash.com/photo-1?thumb',
  },
  user: {
    name: 'Jeff Sheldon',
    links: { html: 'https://unsplash.com/@ugmonk' },
  },
  links: {
    html: 'https://unsplash.com/photos/eOLpJytrbsQ',
    download_location: 'https://api.unsplash.com/photos/eOLpJytrbsQ/download?ixid=abc',
  },
};

describe('mapUnsplashPhoto', () => {
  it('maps a full photo object', () => {
    expect(mapUnsplashPhoto(sampleRaw)).toEqual({
      id: 'eOLpJytrbsQ',
      description: 'A man drinking a coffee.',
      urls: {
        thumb: 'https://images.unsplash.com/photo-1?thumb',
        small: 'https://images.unsplash.com/photo-1?small',
        regular: 'https://images.unsplash.com/photo-1?regular',
      },
      user: {
        name: 'Jeff Sheldon',
        profileUrl: 'https://unsplash.com/@ugmonk',
      },
      links: {
        html: 'https://unsplash.com/photos/eOLpJytrbsQ',
        downloadLocation:
          'https://api.unsplash.com/photos/eOLpJytrbsQ/download?ixid=abc',
      },
    });
  });

  it('falls back to alt_description', () => {
    expect(
      mapUnsplashPhoto({
        ...sampleRaw,
        description: null,
        alt_description: 'Coffee cup',
      })?.description,
    ).toBe('Coffee cup');
  });

  it('returns null for incomplete photos', () => {
    expect(mapUnsplashPhoto({ id: 'x' })).toBeNull();
    expect(mapUnsplashPhoto(null)).toBeNull();
  });

  it('filters a list', () => {
    expect(mapUnsplashPhotos([sampleRaw, { id: 'bad' }, null])).toHaveLength(1);
  });
});

describe('parseSearchParams', () => {
  it('defaults and clamps values', () => {
    expect(parseSearchParams(new URLSearchParams())).toEqual({
      query: undefined,
      page: 1,
      perPage: 24,
      orientation: 'all',
    });
    expect(
      parseSearchParams(
        new URLSearchParams({
          query: '  mountains  ',
          page: '0',
          per_page: '99',
          orientation: 'portrait',
        }),
      ),
    ).toEqual({
      query: 'mountains',
      page: 1,
      perPage: 30,
      orientation: 'portrait',
    });
  });

  it('ignores invalid orientation', () => {
    expect(
      parseSearchParams(new URLSearchParams({ orientation: 'wide' })).orientation,
    ).toBe('all');
  });
});

describe('isUnsplashDownloadLocation', () => {
  it('accepts official download_location URLs', () => {
    expect(
      isUnsplashDownloadLocation(
        'https://api.unsplash.com/photos/eOLpJytrbsQ/download?ixid=abc',
      ),
    ).toBe(true);
  });

  it('rejects non-Unsplash or non-download URLs', () => {
    expect(isUnsplashDownloadLocation('https://evil.example/download')).toBe(false);
    expect(
      isUnsplashDownloadLocation('https://api.unsplash.com/photos/eOLpJytrbsQ'),
    ).toBe(false);
    expect(isUnsplashDownloadLocation(null)).toBe(false);
  });
});
