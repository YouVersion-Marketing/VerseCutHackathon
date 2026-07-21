import { describe, expect, it } from 'vitest';
import { planGeoQueries, buildGeoResults, type RawGeoPhoto } from './geoBackgrounds';
import { LANGUAGE_COUNTRY } from './languageCountry';

describe('planGeoQueries', () => {
  it('produces landmark-focused queries for a country', () => {
    const q = planGeoQueries({ country: 'France', capital: 'Paris' });
    expect(q).toContain('France landmark');
    expect(q).toContain('Paris skyline');
  });
});

const photo = (desc: string | null, url: string, name = 'Ann'): RawGeoPhoto => ({
  description: desc,
  urls: { regular: url },
  user: { name },
});

describe('buildGeoResults', () => {
  it('groups languages by country, filters unsafe, dedupes, caps, and credits', () => {
    const photosByCountry = new Map<string, RawGeoPhoto[]>([
      [
        'France',
        [
          photo('Eiffel Tower', 'https://img/a.jpg'),
          photo('cathedral interior', 'https://img/relig.jpg'), // filtered out
          photo('Louvre', 'https://img/a.jpg'), // duplicate url
          photo('Nice coastline', 'https://img/b.jpg', 'Bo'),
          photo('Lyon street', 'https://img/c.jpg'), // beyond cap of 2
        ],
      ],
    ]);
    const res = buildGeoResults(
      [
        { code: 'fr', name: 'French' },
        { code: 'br', name: 'Breton' }, // must also map to France
        { code: 'zz-nomap', name: 'Nowhere' }, // omitted (no country)
      ],
      photosByCountry,
      { maxImages: 2 },
    );
    expect(res).toHaveLength(1);
    expect(res[0].country).toBe('France');
    expect(res[0].images.map((i) => i.url)).toEqual(['https://img/a.jpg', 'https://img/b.jpg']);
    expect(res[0].images[0].credit).toBe('Ann / Unsplash');
    expect(res[0].languages.map((l) => l.code).sort()).toEqual(['br', 'fr']);
  });
});

describe('LANGUAGE_COUNTRY', () => {
  it('maps major languages including Breton to France', () => {
    expect(LANGUAGE_COUNTRY.fr.country).toBe('France');
    expect(LANGUAGE_COUNTRY.br.country).toBe('France');
  });
});
