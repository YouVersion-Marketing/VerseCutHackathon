import { describe, expect, it } from 'vitest';
import { backoffMs, isRetryableStatus } from '@/lib/export/uploadClient';

describe('isRetryableStatus', () => {
  it('retries rate-limit, gateway, and server errors', () => {
    for (const s of [408, 425, 429, 500, 502, 503, 504]) expect(isRetryableStatus(s)).toBe(true);
  });
  it('does not retry client/auth/not-found errors', () => {
    for (const s of [400, 401, 403, 404, 413, 415, 422]) expect(isRetryableStatus(s)).toBe(false);
  });
});

describe('backoffMs', () => {
  it('honors Retry-After (seconds), capped', () => {
    expect(backoffMs(1, 5)).toBe(5000);
    expect(backoffMs(1, 9999)).toBe(120_000); // capped
  });
  it('grows exponentially with jitter when no Retry-After', () => {
    expect(backoffMs(1)).toBeGreaterThanOrEqual(1000);
    expect(backoffMs(1)).toBeLessThan(1500);
    expect(backoffMs(3)).toBeGreaterThanOrEqual(4000);
    expect(backoffMs(10)).toBeLessThanOrEqual(30_000 + 400); // capped base + jitter
  });
});
