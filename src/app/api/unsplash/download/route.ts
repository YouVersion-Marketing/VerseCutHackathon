import { isUnsplashDownloadLocation } from '@/lib/unsplash/mapPhoto';
import {
  getUnsplashAccessKey,
  trackUnsplashDownload,
  UnsplashUpstreamError,
} from '@/lib/unsplash/server';

// POST — trigger Unsplash download tracking when a photo is selected for use.
// Body: { downloadLocation: string } (from photo.links.download_location).
export async function POST(request: Request) {
  const accessKey = getUnsplashAccessKey();
  if (!accessKey) {
    return Response.json(
      { error: 'Unsplash is not configured (missing UNSPLASH_ACCESS_KEY)' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const downloadLocation =
    body && typeof body === 'object' && 'downloadLocation' in body
      ? (body as { downloadLocation: unknown }).downloadLocation
      : null;

  if (!isUnsplashDownloadLocation(downloadLocation)) {
    return Response.json({ error: 'Invalid downloadLocation' }, { status: 400 });
  }

  try {
    await trackUnsplashDownload(downloadLocation, accessKey);
    return Response.json({ data: { ok: true } });
  } catch (err) {
    if (err instanceof UnsplashUpstreamError) {
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      return Response.json({ error: 'Unsplash download tracking failed' }, { status });
    }
    return Response.json({ error: 'Unsplash download tracking failed' }, { status: 502 });
  }
}
