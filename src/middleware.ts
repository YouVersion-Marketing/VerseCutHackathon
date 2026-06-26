import { NextRequest, NextResponse } from 'next/server';
import { authkit, handleAuthkitProxy } from '@workos-inc/authkit-nextjs';
import { isPublic } from '@/lib/auth/route-access';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always run authkit so withAuth() can resolve the session in server
  // components. The dev-only bypass (guarded by NODE_ENV, so it can never apply
  // in production) skips only the redirect gate, not session processing.
  const { session, headers } = await authkit(request);
  const bypass =
    process.env.NODE_ENV !== 'production' && process.env.DISABLE_AUTH === 'true';

  if (!bypass && !session.user && !isPublic(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handleAuthkitProxy(request, headers, { redirect: '/login' });
  }

  return handleAuthkitProxy(request, headers);
}

export const config = {
  matcher: [
    // Everything except Next internals, public assets, and the media stream.
    '/((?!_next/static|_next/image|favicon\\.ico|assets/|yvmedia/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ico)$).*)',
  ],
};
