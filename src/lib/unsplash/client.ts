import type { UnsplashOrientation, UnsplashPhoto, UnsplashSearchResult } from './types';

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === 'string' && err) return err;
  }
  return fallback;
}

/** Search (or list curated) Unsplash photos via our server proxy. */
export async function searchUnsplashPhotos(opts: {
  query?: string;
  page?: number;
  perPage?: number;
  orientation?: UnsplashOrientation | 'all';
}): Promise<UnsplashSearchResult> {
  const params = new URLSearchParams();
  if (opts.query?.trim()) params.set('query', opts.query.trim());
  if (opts.page) params.set('page', String(opts.page));
  if (opts.perPage) params.set('per_page', String(opts.perPage));
  if (opts.orientation && opts.orientation !== 'all') {
    params.set('orientation', opts.orientation);
  }

  const res = await fetch(`/api/unsplash/search?${params.toString()}`);
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(errorMessage(body, 'Unsplash search failed'));
  }
  const data = (body as { data?: UnsplashSearchResult }).data;
  if (!data || !Array.isArray(data.photos)) {
    throw new Error('Unexpected Unsplash search response');
  }
  return data;
}

/** Fire-and-forget download tracking (Unsplash API guideline). */
export async function trackUnsplashPhotoDownload(
  photo: Pick<UnsplashPhoto, 'links'>,
): Promise<void> {
  await fetch('/api/unsplash/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ downloadLocation: photo.links.downloadLocation }),
  });
}
