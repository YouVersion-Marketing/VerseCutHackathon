import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Load every env var (not just VITE_*) so the server-side proxy can read the
  // secret YouVersion app key without exposing it to the client bundle.
  const env = loadEnv(mode, process.cwd(), '');
  const yvKey = env.YV_PLATFORM_API_KEY || env.YVP_APP_KEY || '';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // ffmpeg.wasm multi-thread core needs SharedArrayBuffer (cross-origin isolation).
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
      proxy: {
        // Same-origin proxy to the YouVersion Platform API. The app calls
        // `/yvp/v1/...`; we inject the app key here so it stays server-side.
        '/yvp': {
          target: 'https://api.youversion.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/yvp/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (yvKey) proxyReq.setHeader('x-yvp-app-key', yvKey);
              proxyReq.setHeader('accept', 'application/json');
            });
          },
        },
        // Stories 4.0 — date → Guided Scripture lessons (with video_id).
        '/yvs': {
          target: 'https://stories.youversionapi.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/yvs/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('accept', 'application/json');
              // Stories 4.0 returns 400 unless gzip is advertised.
              proxyReq.setHeader('accept-encoding', 'gzip');
              proxyReq.setHeader('x-country-code', 'us');
              proxyReq.setHeader('x-youversion-client', 'youversion');
              proxyReq.setHeader('x-youversion-app-platform', 'ios');
              proxyReq.setHeader('x-youversion-app-version', '122');
              proxyReq.setHeader('user-agent', 'Bible/7.4.1 (iPhone; iOS 14.4; en_US)');
            });
          },
        },
        // Videos 5.0 — video_id → playback sources (webm/hls/mp3 + preview mp4).
        '/yvv': {
          target: 'https://videos.youversionapi.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/yvv/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('accept', 'application/json');
              proxyReq.setHeader('x-youversion-client', 'youversion');
              proxyReq.setHeader('x-youversion-app-platform', 'ios');
              proxyReq.setHeader('x-youversion-app-version', '122');
            });
          },
        },
        // Media CDN — stream video bytes same-origin so canvas isn't tainted
        // (the CDN sends no Access-Control-Allow-Origin).
        '/yvmedia': {
          target: 'https://yv-content-assets.youversionapi.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/yvmedia/, ''),
        },
      },
    },
  };
});
