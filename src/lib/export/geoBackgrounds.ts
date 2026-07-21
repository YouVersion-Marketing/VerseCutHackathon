import { isSafeGeoPhoto } from './geoSafety';
import { LANGUAGE_COUNTRY, type CountryInfo } from './languageCountry';
import type { GeoImage, GeoResult } from './types';

export interface RawGeoPhoto {
  description: string | null;
  urls: { regular: string };
  user: { name: string };
}

/** Landmark-focused Unsplash queries for a country. */
export function planGeoQueries(info: CountryInfo): string[] {
  return [
    `${info.country} landmark`,
    `${info.capital} skyline`,
    `${info.country} architecture`,
  ];
}

/**
 * Group languages by their mapped country and attach that country's safe,
 * deduped, capped images. Languages with no country mapping are omitted (the
 * caller logs how many were dropped).
 */
export function buildGeoResults(
  languages: { code: string; name: string }[],
  photosByCountry: Map<string, RawGeoPhoto[]>,
  opts: { maxImages?: number } = {},
): GeoResult[] {
  const maxImages = opts.maxImages ?? 3;
  const byCountry = new Map<string, { info: CountryInfo; languages: { code: string; name: string }[] }>();

  for (const lang of languages) {
    const info = LANGUAGE_COUNTRY[lang.code];
    if (!info) continue;
    const entry = byCountry.get(info.country) ?? { info, languages: [] };
    entry.languages.push(lang);
    byCountry.set(info.country, entry);
  }

  const results: GeoResult[] = [];
  for (const [country, { info, languages: langs }] of byCountry) {
    const photos = photosByCountry.get(country) ?? [];
    const seen = new Set<string>();
    const images: GeoImage[] = [];
    for (const p of photos) {
      if (!isSafeGeoPhoto(p)) continue;
      if (seen.has(p.urls.regular)) continue;
      seen.add(p.urls.regular);
      images.push({ url: p.urls.regular, credit: `${p.user.name} / Unsplash` });
      if (images.length >= maxImages) break;
    }
    results.push({ country, capital: info.capital, images, languages: langs });
  }
  return results;
}
