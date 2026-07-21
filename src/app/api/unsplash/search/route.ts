import { parseSearchParams } from '@/lib/unsplash/mapPhoto';
import {
  fetchUnsplashPhotos,
  getUnsplashAccessKey,
  UnsplashUpstreamError,
} from '@/lib/unsplash/server';

// GET — search Unsplash photos (empty query lists curated/latest photos).
// Access key stays server-side; response is slimmed for the studio UI.
export async function GET(request: Request) {
  const accessKey = getUnsplashAccessKey();
  if (!accessKey) {
    return Response.json(
      { error: 'Unsplash is not configured (missing UNSPLASH_ACCESS_KEY)' },
      { status: 503 },
    );
  }

  const params = parseSearchParams(new URL(request.url).searchParams);

  try {
    const data = await fetchUnsplashPhotos(params, accessKey);
    return Response.json({ data });
  } catch (err) {
    if (err instanceof UnsplashUpstreamError) {
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      return Response.json({ error: 'Unsplash request failed' }, { status });
    }
    return Response.json({ error: 'Unsplash request failed' }, { status: 502 });
  }
}
