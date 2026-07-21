/** Paths that never require a WorkOS session (the sign-in flow + AIR health check). */
export const PUBLIC_PREFIXES = ['/login', '/callback', '/api/air/health'] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function isPublic(pathname: string): boolean {
  return matchesPrefix(pathname, PUBLIC_PREFIXES);
}
