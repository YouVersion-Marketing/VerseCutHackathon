# Verse Ad Studio

Browser tool for turning a Bible reference into a marketing asset — a **static image ad** (PNG/JPG) or a **video ad** (MP4), with the verse overlaid on a background and the logo in the bottom-left corner.

Two-panel layout: inputs on the left, live progress + final preview on the right.

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL. The app works out of the box with bundled **mock** scripture data — no API key needed.

## Configuration

Everything you'll want to change lives in [`src/config/index.ts`](src/config/index.ts):

| What | Where |
| --- | --- |
| Logo (bottom-left corner + header) | `brand.logoPath` → swap `public/assets/logo.svg` |
| Default Bible version | `bible.defaultVersionId` |
| Video duration / fps | `output.videoDurationSec`, `output.videoFps` |
| Bible provider + API key | `bible.provider`, `bible.apiKey` (via `.env`) |

### Going live with a real Bible API

The default `mock` provider ships a small offline data set so the full pipeline
runs with zero setup. Two real providers are included:

#### YouVersion Platform API (recommended)

Fetches verse text by USFM reference (e.g. `JHN.3.16-17`) from
`api.youversion.com`, with the full Bible catalog (~1,200 languages, 1,000+
versions). Implemented in
[`src/lib/bible/youVersionPlatformProvider.ts`](src/lib/bible/youVersionPlatformProvider.ts).

1. Get an app key at <https://platform.youversion.com>.
2. Copy `.env.example` → `.env` and set:
   ```
   VITE_BIBLE_PROVIDER=youversion
   YV_PLATFORM_API_KEY=your_key
   ```

**The key stays server-side.** The browser calls a same-origin path (`/yvp/v1/…`)
and the Vite dev proxy injects the `x-yvp-app-key` header — see
[`vite.config.ts`](vite.config.ts). For production, deploy the same proxy as a
serverless function (e.g. a Vercel rewrite/function) that injects the key, so it
never ships in the client bundle. Set `VITE_YV_BASE_URL` to that proxy's URL.

Endpoints used: `GET /v1/languages`, `GET /v1/bibles`, `GET /v1/bibles/{id}`
(book USFM list), `GET /v1/bibles/{id}/passages/{usfm}?format=text`. References
are USFM; same-chapter ranges encode as `BOOK.CH.from-to`. Mirrors the alfred
`yv_platform_api` client.

#### API.Bible

Get a key at <https://scripture.api.bible>, then set `VITE_BIBLE_PROVIDER=api.bible`
and `VITE_BIBLE_API_KEY=your_key`.

#### Swapping in your own

The integration is **swappable**: implement the `BibleProvider` interface in
[`src/lib/bible/types.ts`](src/lib/bible/types.ts) and register it in
[`src/lib/bible/index.ts`](src/lib/bible/index.ts).

## How rendering works

- **Compositing** is shared between both output types in
  [`src/lib/compositor.ts`](src/lib/compositor.ts): cover-fit background (uploaded
  image/video, or a generated brand gradient when none is provided) → contrast
  scrim → auto-sized verse text → reference/version → logo.
- **Static image** → canvas → `toBlob()` → PNG/JPG.
- **Video** → the animated canvas is captured with `MediaRecorder` (WebM), then
  transcoded to **MP4 (H.264)** in-browser via **ffmpeg.wasm**.

### Note on browser video rendering

In-browser MP4 encoding requires cross-origin isolation (the dev server sets the
`COOP`/`COEP` headers in [`vite.config.ts`](vite.config.ts)). If ffmpeg.wasm can't
load in a given session, the app gracefully falls back to delivering the WebM.

For production-scale or guaranteed MP4 + audio output, move the video render to a
**backend step** (e.g. a serverless function running ffmpeg): the client would
POST the verse text, options, and uploaded background, and receive a rendered MP4
URL. The compositor logic ports directly to a server-side canvas (`node-canvas`)
or an ffmpeg `drawtext`/overlay filter graph.

## Video library (YouVersion Guided Scripture)

Users can pull **Guided Scripture videos by date** and use them as ad
backgrounds, in addition to uploading their own. Flow (mirrors
`~/repos/alfred/video_api`):

- **Stories 4.0** (`/yvs` proxy) maps a date → lessons, each with a `video_id`.
- **Videos 5.0** (`/yvv` proxy) resolves a `video_id` → playback sources
  (webm / hls / mp3 + preview mp4).
- **Media** streams through the `/yvmedia` proxy so the cross-origin CDN video
  can be drawn onto the canvas without tainting it.

All three are same-origin Vite proxies (see [`vite.config.ts`](vite.config.ts));
Stories requires `Accept-Encoding: gzip`, injected by the proxy.

`public/assets/videos/manifest.json` is the **seeded catalog** ("database") —
60 videos across 12 dates, built from the alfred pulls — so the library is
pre-populated for any user. The picker tries a live Stories pull for the chosen
date + language first, then falls back to this manifest. Playback URLs are
resolved fresh at selection time (the CDN delivery URLs are volatile), so only
`video_id` + metadata are persisted. Service: [`src/lib/videoLibrary.ts`](src/lib/videoLibrary.ts).

To refresh/extend the catalog, re-run the alfred `video_api` pulls and
regenerate the manifest.

## Brand icon library

`public/assets/icons/` holds the official YouVersion brand assets, organized
`{app}/{style}/{lang}.{svg|png}`:

```
bible-app/
  icon-only/   66  app icons (e.g. ru.png → the "БИБЛИЯ" app icon)
  logo-light/  66  full horizontal lockup, light bg
  logo-dark/   64  full horizontal lockup, dark bg
bible-app-lite/
  icon-only/   59  app icons
```

`public/assets/icons/manifest.json` indexes everything (app → style → language →
path) so the set can be listed or browsed in a picker.

**Language-aware corner logo:** with `brand.logoByLanguage` on (default), the
ad's bottom-left logo auto-selects the Bible App icon for the chosen language —
e.g. a Russian verse gets the Russian app icon — falling back to English, then
`brand.logoPath`. The catalog of available icons is generated at
`src/lib/iconCatalog.ts`. Configure in [`src/config/index.ts`](src/config/index.ts).

To re-pull/refresh from Figma, set `FIGMA_TOKEN` in `.env`.

## Tech

React + TypeScript + Vite + Tailwind v4. Canvas compositing, ffmpeg.wasm for video.
