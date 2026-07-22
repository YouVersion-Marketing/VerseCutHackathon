import type { GeoImage, GeoLanguageRender, GeoResult, VersionExportRow } from './types';

/**
 * Escape a CSV field. RFC-4180 quoting for comma/quote/CR/LF, plus
 * spreadsheet-formula-injection neutralization: values starting with = + - @
 * (or a leading tab/CR) get a leading apostrophe so Excel/Sheets treat them as
 * text, not formulas. Untrusted text (Unsplash credits, verse text) flows here.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

export function buildVersionsCsv(rows: VersionExportRow[]): string {
  return toCsv(
    ['version_id', 'reference', 'verse_text', 'air_cdn_link'],
    rows.map((r) => [r.version_id, r.reference, r.verse_text, r.air_cdn_link]),
  );
}

/** Largest image count across results (>=1), so every row has the same columns. */
function maxImageCount(results: GeoResult[]): number {
  return Math.max(1, ...results.map((g) => g.images.length));
}

/** Per-image column headers: image_url_1, credit_1, image_url_2, credit_2, ... */
function imageHeaders(count: number): string[] {
  const headers: string[] = [];
  for (let i = 1; i <= count; i++) headers.push(`image_url_${i}`, `credit_${i}`);
  return headers;
}

/** Per-image cells for one result, padded to `count` images with blanks. */
function imageCells(images: GeoImage[], count: number): string[] {
  const cells: string[] = [];
  for (let i = 0; i < count; i++) {
    const img = images[i];
    cells.push(img?.url ?? '', img?.credit ?? '');
  }
  return cells;
}

/** By-country: the raw candidate landmark photos per country (sourcing reference). */
export function buildGeoByCountryCsv(results: GeoResult[]): string {
  const count = maxImageCount(results);
  return toCsv(
    ['country', 'capital', ...imageHeaders(count)],
    results.map((g) => [g.country, g.capital, ...imageCells(g.images, count)]),
  );
}

/** By-language: one localized rendered verse image per language, with its CDN link. */
export function buildGeoByLanguageCsv(rows: GeoLanguageRender[]): string {
  return toCsv(
    ['language', 'language_name', 'country', 'reference', 'verse_text', 'background_url', 'cdn_url', 'credit'],
    rows.map((r) => [
      r.language,
      r.language_name,
      r.country,
      r.reference,
      r.verse_text,
      r.background_url,
      r.cdn_url,
      r.credit,
    ]),
  );
}
