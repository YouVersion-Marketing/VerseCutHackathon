import { getAirEnv, uploadToAir } from '@/lib/server/air';

export async function POST(request: Request) {
  const env = getAirEnv();
  if (!env) {
    return Response.json({ error: 'AIR is not configured (missing AIR_API_KEY/AIR_WORKSPACE_ID)' }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'file field is required' }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const { cdnUrl } = await uploadToAir(bytes, {
      fileName: file.name || 'asset.png',
      mime: file.type || 'image/png',
      env,
    });
    return Response.json({ data: { cdnUrl } });
  } catch {
    return Response.json({ error: 'AIR upload failed' }, { status: 502 });
  }
}
