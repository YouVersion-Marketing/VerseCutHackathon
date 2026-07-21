/** Upload an image blob to AIR via the server proxy; returns the CDN URL. */
export async function uploadImageToAir(blob: Blob, fileName: string): Promise<string> {
  const form = new FormData();
  form.append('file', blob, fileName);
  const res = await fetch('/api/air/upload', { method: 'POST', body: form });
  const json = (await res.json()) as { data?: { cdnUrl: string }; error?: string };
  if (!res.ok || !json.data) {
    throw new Error(json.error ?? `AIR upload failed (${res.status})`);
  }
  return json.data.cdnUrl;
}
