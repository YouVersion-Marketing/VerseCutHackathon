import { NextRequest, NextResponse } from 'next/server';
import { authkit, handleAuthkitProxy } from '@workos-inc/authkit-nextjs';
import { isPublic } from '@/lib/auth/route-access';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Validate the WorkOS session (refreshes if needed).
  const { session, headers } = await authkit(request);

  if (!session.user && !isPublic(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handleAuthkitProxy(request, headers, { redirect: '/login' });
  }

  // Pass through with the (possibly refreshed) session headers so withAuth()
  // resolves the user in server components.
  return handleAuthkitProxy(request, headers);
}

export const config = {
  matcher: [
    // Everything except Next internals, public assets, and the media stream.
    '/((?!_next/static|_next/image|favicon\\.ico|assets/|yvmedia/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ico)$).*)',
  ],
};
