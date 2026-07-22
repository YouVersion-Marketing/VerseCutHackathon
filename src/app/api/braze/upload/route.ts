import { getBrazeEnv, uploadToBraze, BrazeUploadError } from '@/lib/server/braze';
import { validateUploadFile } from '@/lib/server/uploadGuards';

export const maxDuration = 60;

export async function POST(request: Request) {
  const env = getBrazeEnv();
  if (!env) {
    return Response.json({ error: 'Braze is not configured (missing BRAZE_API_KEY)' }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const name = form.get('name');
  const v = validateUploadFile(file);
  if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
  const f = file as File;

  const bytes = new Uint8Array(await f.arrayBuffer());
  try {
    const { url } = await uploadToBraze(bytes, {
      name: typeof name === 'string' && name ? name : f.name || 'asset.jpg',
      mime: f.type || 'image/jpeg',
      env,
    });
    return Response.json({ data: { url } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[braze/upload] failed:', detail);
    // Surface Braze's rate limit as a real 429 (+ Retry-After) so the client can
    // back off correctly, instead of masking it as a generic 502.
    if (err instanceof BrazeUploadError && err.status === 429) {
      const headers: Record<string, string> = {};
      if (err.retryAfterSec) headers['retry-after'] = String(err.retryAfterSec);
      return Response.json({ error: 'Braze rate limit', detail }, { status: 429, headers });
    }
    return Response.json({ error: 'Braze upload failed', detail }, { status: 502 });
  }
}
