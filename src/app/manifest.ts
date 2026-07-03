import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VerseCut — YouVersion',
    short_name: 'VerseCut',
    description: 'Create Bible-verse marketing assets — video and static image ads.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#fe3745',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
