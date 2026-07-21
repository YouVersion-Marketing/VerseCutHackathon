import { mapUnsplashPhotos } from './mapPhoto';
import type { UnsplashOrientation, UnsplashSearchParams, UnsplashSearchResult } from './types';

const UNSPLASH_API = 'https://api.unsplash.com';

export function getUnsplashAccessKey(): string | null {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  return key || null;
}

async function unsplashFetch(pathWithQuery: string, accessKey: string): Promise<Response> {
  return fetch(`${UNSPLASH_API}${pathWithQuery}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Client-ID ${accessKey}`,
    },
    cache: 'no-store',
  });
}

function orientationQuery(orientation: UnsplashOrientation | 'all' | undefined): string {
  if (!orientation || orientation === 'all') return '';
  return `&orientation=${encodeURIComponent(orientation)}`;
}

/** Search or list photos from Unsplash, returning our slim result shape. */
export async function fetchUnsplashPhotos(
  params: UnsplashSearchParams,
  accessKey: string,
): Promise<UnsplashSearchResult> {
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 24;
  const orient = orientationQuery(params.orientation);
  const query = params.query?.trim();

  // Orientation is supported on /search/photos; /photos list ignores it.
  const path = query
    ? `/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}${orient}`
    : `/photos?page=${page}&per_page=${perPage}`;

  const res = await unsplashFetch(path, accessKey);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new UnsplashUpstreamError(res.status, detail || res.statusText);
  }

  const json: unknown = await res.json();

  if (query) {
    const body = json as { results?: unknown[]; total?: number; total_pages?: number };
    const photos = mapUnsplashPhotos(Array.isArray(body.results) ? body.results : []);
    return {
      photos,
      total: typeof body.total === 'number' ? body.total : photos.length,
      totalPages: typeof body.total_pages === 'number' ? body.total_pages : 1,
    };
  }

  const list = Array.isArray(json) ? json : [];
  const photos = mapUnsplashPhotos(list);
  return { photos, total: photos.length, totalPages: 1 };
}

/** Trigger Unsplash download tracking for a selected photo. */
export async function trackUnsplashDownload(
  downloadLocation: string,
  accessKey: string,
): Promise<void> {
  const res = await fetch(downloadLocation, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Client-ID ${accessKey}`,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new UnsplashUpstreamError(res.status, detail || res.statusText);
  }
}

export class UnsplashUpstreamError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail || `Unsplash request failed (${status})`);
    this.name = 'UnsplashUpstreamError';
    this.status = status;
  }
}
