import type { AspectRatio } from '../config';

export interface SocialFormat {
  id: string;
  label: string;
  aspect: AspectRatio;
}

/** Platform → recommended aspect ratio for the Social space. */
export const SOCIAL_FORMATS: SocialFormat[] = [
  { id: 'ig-story', label: 'Instagram Story / Reel', aspect: '9:16' },
  { id: 'ig-feed', label: 'Instagram Feed', aspect: '4:5' },
  { id: 'tiktok', label: 'TikTok', aspect: '9:16' },
  { id: 'fb-feed', label: 'Facebook Feed', aspect: '1:1' },
  { id: 'youtube', label: 'YouTube', aspect: '16:9' },
  { id: 'x', label: 'X / Twitter', aspect: '16:9' },
];

export const SOCIAL_FORMAT_BY_ID: Record<string, SocialFormat> = Object.fromEntries(
  SOCIAL_FORMATS.map((f) => [f.id, f]),
);
