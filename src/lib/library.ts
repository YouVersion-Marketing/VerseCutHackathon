// Client helpers for the asset library. Files upload directly to Vercel Blob
// (via the /api/blob/upload token route), then metadata is persisted to the DB.
import { upload } from '@vercel/blob/client';
import type { RenderedAsset } from './render';

export interface SavedAd {
  id: string;
  createdAt: string;
  title: string | null;
  format: string;
  aspect: string;
  language: string | null;
  reference: string | null;
  versionAbbr: string | null;
  fileUrl: string;
}

export interface AdMeta {
  title?: string;
  format: 'image' | 'video';
  aspect: string;
  language?: string | null;
  reference?: string | null;
  versionAbbr?: string | null;
}

function fileName(meta: AdMeta, ext: string): string {
  const ref = (meta.reference ?? 'verse').replace(/[^\w.-]+/g, '-').toLowerCase();
  return `ads/${ref}-${meta.aspect.replace(':', 'x')}.${ext}`;
}

/** Upload a rendered asset to Blob, then persist its metadata. */
export async function saveAdToLibrary(asset: RenderedAsset, meta: AdMeta): Promise<SavedAd> {
  const blob = await upload(fileName(meta, asset.ext), asset.blob, {
    access: 'public',
    handleUploadUrl: '/api/blob/upload',
    contentType: asset.blob.type,
  });
  const res = await fetch('/api/library', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...meta,
      fileUrl: blob.url,
      mime: asset.blob.type,
      sizeBytes: asset.blob.size,
    }),
  });
  if (!res.ok) throw new Error('Failed to save to library');
  return (await res.json()).data as SavedAd;
}

export async function listMyAds(): Promise<SavedAd[]> {
  const res = await fetch('/api/library');
  if (!res.ok) throw new Error('Failed to load library');
  return (await res.json()).data as SavedAd[];
}
