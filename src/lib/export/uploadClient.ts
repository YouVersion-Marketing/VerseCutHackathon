// Shared, robust upload path for every bulk-export destination (AWS/AIR/Braze).
// Retries transient failures — network errors and retryable HTTP statuses
// (rate limit / gateway / server) — with exponential backoff + jitter, honoring
// a `Retry-After` header when present. This absorbs the sporadic S3/gateway 502s
// and Braze 429s that otherwise show up as bulk-export failures.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** HTTP statuses worth retrying (rate limit, request timeout, gateway/server). */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

/** Backoff for a given attempt (1-based). Honors Retry-After (seconds) when set. */
export function backoffMs(attempt: number, retryAfterSec?: number, cap = 120_000): number {
  if (retryAfterSec && retryAfterSec > 0) return Math.min(retryAfterSec * 1000, cap);
  const base = Math.min(1000 * 2 ** (attempt - 1), 30_000);
  return base + Math.floor(Math.random() * 400); // jitter to de-sync workers
}

interface UploadOpts {
  label: string;
  /** Optional pacer hook awaited before each attempt (used to throttle Braze). */
  pace?: () => Promise<void>;
  /** Aborts retries early (e.g. the Stop button). */
  shouldStop?: () => boolean;
  maxAttempts?: number;
}

/**
 * POST a freshly-built multipart form to `path`, retrying transient failures,
 * and return the URL extracted from `{ data }` on success. `buildForm` is called
 * per attempt because a FormData body is consumed once sent.
 */
export async function postUpload(
  path: string,
  buildForm: () => FormData,
  extractUrl: (data: unknown) => string | undefined,
  opts: UploadOpts,
): Promise<string> {
  const maxAttempts = opts.maxAttempts ?? 5;
  let lastErr = 'unknown error';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts.shouldStop?.()) throw new Error(`${opts.label} cancelled`);
    if (opts.pace) await opts.pace();

    let res: Response;
    try {
      res = await fetch(path, { method: 'POST', body: buildForm() });
    } catch (e) {
      lastErr = `network error: ${e instanceof Error ? e.message : String(e)}`;
      if (attempt < maxAttempts && !opts.shouldStop?.()) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw new Error(`${opts.label} failed: ${lastErr}`);
    }

    const json = (await res.json().catch(() => ({}))) as {
      data?: unknown;
      error?: string;
      detail?: string;
    };

    if (res.ok) {
      const url = extractUrl(json.data);
      if (url) return url;
      // 2xx but no URL is a definitive app error — don't retry.
      throw new Error(`${opts.label} failed: ${json.detail ?? json.error ?? 'no url returned'}`);
    }

    lastErr = json.detail ? `${json.error}: ${json.detail}` : (json.error ?? `HTTP ${res.status}`);
    if (isRetryableStatus(res.status) && attempt < maxAttempts && !opts.shouldStop?.()) {
      const retryAfter = Number(res.headers.get('retry-after')) || undefined;
      await sleep(backoffMs(attempt, retryAfter));
      continue;
    }
    throw new Error(`${opts.label} failed: ${lastErr}`);
  }
  throw new Error(`${opts.label} failed after ${maxAttempts} attempts: ${lastErr}`);
}
