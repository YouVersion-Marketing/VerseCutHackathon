import type { UnsplashOrientation, UnsplashPhoto, UnsplashSearchParams } from './types';

const ORIENTATIONS = new Set<UnsplashOrientation>(['landscape', 'portrait', 'squarish']);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Map a raw Unsplash photo object to our slim client shape. */
export function mapUnsplashPhoto(raw: unknown): UnsplashPhoto | null {
  const photo = asRecord(raw);
  if (!photo) return null;

  const id = asString(photo.id);
  const urls = asRecord(photo.urls);
  const user = asRecord(photo.user);
  const links = asRecord(photo.links);
  if (!id || !urls || !user || !links) return null;

  const thumb = asString(urls.thumb);
  const small = asString(urls.small);
  const regular = asString(urls.regular);
  const name = asString(user.name);
  const userLinks = asRecord(user.links);
  const profileUrl = asString(userLinks?.html);
  const html = asString(links.html);
  const downloadLocation = asString(links.download_location);
  if (!thumb || !small || !regular || !name || !profileUrl || !html || !downloadLocation) {
    return null;
  }

  const description =
    asString(photo.description) ?? asString(photo.alt_description) ?? null;

  return {
    id,
    description,
    urls: { thumb, small, regular },
    user: { name, profileUrl },
    links: { html, downloadLocation },
  };
}

export function mapUnsplashPhotos(raw: unknown[]): UnsplashPhoto[] {
  const out: UnsplashPhoto[] = [];
  for (const item of raw) {
    const mapped = mapUnsplashPhoto(item);
    if (mapped) out.push(mapped);
  }
  return out;
}

/** Parse and clamp search query params from a URLSearchParams / request. */
export function parseSearchParams(input: URLSearchParams): UnsplashSearchParams {
  const query = (input.get('query') ?? '').trim();
  const pageRaw = Number.parseInt(input.get('page') ?? '1', 10);
  const perPageRaw = Number.parseInt(input.get('per_page') ?? '24', 10);
  const orientRaw = input.get('orientation');

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const perPage = Number.isFinite(perPageRaw)
    ? Math.min(30, Math.max(1, perPageRaw))
    : 24;

  let orientation: UnsplashOrientation | 'all' = 'all';
  if (orientRaw && ORIENTATIONS.has(orientRaw as UnsplashOrientation)) {
    orientation = orientRaw as UnsplashOrientation;
  }

  return {
    query: query || undefined,
    page,
    perPage,
    orientation,
  };
}

/**
 * Only allow triggering Unsplash's official download_location URLs so the
 * download proxy can't be used as an open relay.
 */
export function isUnsplashDownloadLocation(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'api.unsplash.com' &&
      /^\/photos\/[^/]+\/download\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
