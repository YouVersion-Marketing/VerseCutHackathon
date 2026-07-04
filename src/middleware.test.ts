import { describe, expect, it, vi } from 'vitest';

// Mock the Next/authkit runtime so importing the middleware module (just to read
// its `config.matcher`) doesn't pull in next/cache etc.
vi.mock('@workos-inc/authkit-nextjs', () => ({
  authkit: vi.fn(),
  handleAuthkitProxy: vi.fn(),
}));
vi.mock('next/server', () => ({
  NextResponse: { json: vi.fn() },
  NextRequest: class {},
}));

import { config } from './middleware';

// The middleware `matcher` decides which requests run auth. A media-extension
// exclusion once let /api/…/*.mp4 (etc.) bypass auth and reach the credentialed
// YouVersion proxies. These tests lock in that every /api path is covered.
const matchers = config.matcher.map((p) => new RegExp(`^${p}$`));
const covered = (pathname: string) => matchers.some((re) => re.test(pathname));

describe('middleware matcher', () => {
  it('protects API proxy paths even with media extensions (auth-bypass regression)', () => {
    expect(covered('/api/yvv/5.0/videos/abc.mp4')).toBe(true);
    expect(covered('/api/yvp/v1/thing.png')).toBe(true);
    expect(covered('/api/yvb/3.1/chapter.json')).toBe(true);
    expect(covered('/api/library')).toBe(true);
    expect(covered('/api/uploads/xyz')).toBe(true);
  });

  it('still protects app pages', () => {
    expect(covered('/dashboard')).toBe(true);
    expect(covered('/')).toBe(true);
  });

  it('does not run on public static assets / media stream', () => {
    expect(covered('/logo.png')).toBe(false);
    expect(covered('/assets/icons/foo.svg')).toBe(false);
    expect(covered('/yvmedia/delivery/videos/x.webm')).toBe(false);
    expect(covered('/favicon.ico')).toBe(false);
  });
});
