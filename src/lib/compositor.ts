// Canvas compositor shared by the static-image and video render paths.
// Draws: background (cover-fit image/video or generated gradient) → contrast
// scrim → verse text → reference/version → bottom-left logo.

export type Background =
  | { type: 'image'; image: CanvasImageSource }
  | { type: 'video'; video: HTMLVideoElement }
  | { type: 'gradient' };

export interface ComposeOptions {
  width: number;
  height: number;
  verseText: string;
  reference: string;
  versionAbbreviation: string;
  background: Background;
  logo: CanvasImageSource | null;
  /** 0..1 animation progress (1 = fully revealed). Use 1 for static images. */
  t?: number;
}

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

function drawCover(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  scale = 1,
) {
  if (!sw || !sh) return;
  const baseScale = Math.max(dw / sw, dh / sh) * scale;
  const w = sw * baseScale;
  const h = sh * baseScale;
  ctx.drawImage(src, (dw - w) / 2, (dh - h) / 2, w, h);
}

function drawGradientBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2a0a10');
  g.addColorStop(0.5, '#3d0d18');
  g.addColorStop(1, '#120406');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Soft brand glow toward the top.
  const radial = ctx.createRadialGradient(
    w * 0.5,
    h * 0.18,
    0,
    w * 0.5,
    h * 0.18,
    Math.max(w, h) * 0.8,
  );
  radial.addColorStop(0, 'rgba(254,55,69,0.32)');
  radial.addColorStop(1, 'rgba(254,55,69,0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, h);
}

/** Wrap text to fit maxWidth at the given font size. Returns the lines. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Pick the largest serif size that fits the verse within the text box and a
 * sensible line budget, then return the wrapped lines + chosen size.
 */
function fitVerse(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  startSize: number,
) {
  let size = startSize;
  const minSize = Math.round(startSize * 0.42);
  // eslint-disable-next-line no-constant-condition
  while (size > minSize) {
    ctx.font = `600 ${size}px 'Fraunces', Georgia, serif`;
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = size * 1.18;
    if (lines.length * lineHeight <= maxHeight) {
      return { lines, size, lineHeight };
    }
    size -= 4;
  }
  ctx.font = `600 ${minSize}px 'Fraunces', Georgia, serif`;
  const lines = wrapText(ctx, text, maxWidth);
  return { lines, size: minSize, lineHeight: minSize * 1.18 };
}

export function composeFrame(
  ctx: CanvasRenderingContext2D,
  opts: ComposeOptions,
) {
  const { width: w, height: h, background, logo } = opts;
  const t = opts.t ?? 1;
  const reveal = easeOut(Math.min(1, t / 0.5)); // text fully in by t=0.5

  ctx.clearRect(0, 0, w, h);

  // 1. Background
  if (background.type === 'gradient') {
    drawGradientBackground(ctx, w, h);
  } else if (background.type === 'image') {
    const img = background.image as HTMLImageElement;
    const zoom = 1.04 + 0.06 * t; // slow Ken Burns
    drawCover(ctx, img, img.naturalWidth, img.naturalHeight, w, h, zoom);
  } else {
    const v = background.video;
    const zoom = 1.02 + 0.04 * t;
    drawCover(ctx, v, v.videoWidth, v.videoHeight, w, h, zoom);
  }

  // 2. Contrast: global darken + stronger bottom scrim
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, w, h);

  const scrim = ctx.createLinearGradient(0, h * 0.32, 0, h);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  scrim.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, w, h);

  // 3. Layout metrics
  const margin = Math.round(w * 0.075);
  const textMaxWidth = w - margin * 2;
  const logoSize = Math.round(Math.min(w, h) * 0.085);
  const logoBaselineY = h - margin - logoSize;

  // 4. Verse text (anchored above the logo row)
  const verseBudgetH = h * (background.type === 'gradient' ? 0.5 : 0.42);
  const startSize = Math.round(w * 0.062);
  const { lines, size, lineHeight } = fitVerse(
    ctx,
    `“${opts.verseText}”`,
    textMaxWidth,
    verseBudgetH,
    startSize,
  );

  const refSize = Math.round(size * 0.42);
  const refGap = refSize * 2.2;
  const blockHeight = lines.length * lineHeight + refGap;
  let baselineY = logoBaselineY - Math.round(h * 0.04) - blockHeight + lineHeight;

  ctx.save();
  ctx.globalAlpha = reveal;
  ctx.translate(0, (1 - reveal) * 24);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = Math.round(size * 0.25);
  ctx.shadowOffsetY = 2;
  ctx.font = `600 ${size}px 'Fraunces', Georgia, serif`;
  for (const line of lines) {
    ctx.fillText(line, margin, baselineY);
    baselineY += lineHeight;
  }
  ctx.restore();

  // 5. Reference + version (uppercase, tracked, brand-tinted)
  ctx.save();
  ctx.globalAlpha = easeOut(Math.min(1, Math.max(0, (t - 0.25) / 0.5)));
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fe5562';
  const label = opts.versionAbbreviation
    ? `${opts.reference.toUpperCase()}  ·  ${opts.versionAbbreviation}`
    : opts.reference.toUpperCase();
  ctx.font = `700 ${refSize}px 'Plus Jakarta Sans', system-ui, sans-serif`;
  // Letter-spacing via manual draw.
  const lsY = baselineY - lineHeight + refGap * 0.7;
  drawTracked(ctx, label, margin, lsY, refSize * 0.08);
  ctx.restore();

  // 6. Logo bottom-left — drawn at a fixed height, preserving aspect ratio so
  //    wide wordmark lockups don't get squished into a square.
  if (logo) {
    const nat = logo as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
    const natW = nat.naturalWidth || (typeof nat.width === 'number' ? nat.width : 0) || logoSize;
    const natH = nat.naturalHeight || (typeof nat.height === 'number' ? nat.height : 0) || logoSize;
    const aspect = natW > 0 && natH > 0 ? natW / natH : 1;
    const logoW = Math.round(logoSize * aspect);
    ctx.save();
    ctx.globalAlpha = reveal;
    ctx.drawImage(logo, margin, logoBaselineY, logoW, logoSize);
    ctx.restore();
  }
}

function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
) {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + letterSpacing;
  }
}

/** Ensure web fonts are available before drawing to canvas. */
export async function ensureFontsReady() {
  if (!('fonts' in document)) return;
  try {
    await Promise.all([
      document.fonts.load("600 80px 'Fraunces'"),
      document.fonts.load("700 32px 'Plus Jakarta Sans'"),
    ]);
    await document.fonts.ready;
  } catch {
    /* fall back to system serif/sans */
  }
}
