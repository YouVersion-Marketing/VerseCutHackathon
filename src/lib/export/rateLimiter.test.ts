import { describe, expect, it } from 'vitest';
import { createPacer } from '@/lib/export/rateLimiter';

describe('createPacer', () => {
  it('lets the initial burst through immediately', () => {
    const p = createPacer(3, 3600); // burst 3, 1/sec refill
    expect(p.reserve(0)).toBe(0);
    expect(p.reserve(0)).toBe(0);
    expect(p.reserve(0)).toBe(0);
  });

  it('spaces callers by the refill interval once the burst is spent', () => {
    const p = createPacer(2, 3600); // refillMs = 1000
    p.reserve(0); // token 1
    p.reserve(0); // token 2
    // Absolute waits from now (=0) so concurrent callers fire at distinct times.
    expect(p.reserve(0)).toBe(1000);
    expect(p.reserve(0)).toBe(2000);
    expect(p.reserve(0)).toBe(3000);
  });

  it('refills over real elapsed time', () => {
    const p = createPacer(1, 3600); // 1 token, refill 1/sec
    expect(p.reserve(0)).toBe(0); // spend the token
    expect(p.reserve(500)).toBe(500); // half a token refilled → wait 500ms more
    expect(p.reserve(10_000)).toBe(0); // plenty refilled after 10s
  });
});
