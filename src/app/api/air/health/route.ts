import { getAirEnv } from '@/lib/server/air';

// Public, no-secret diagnostic: reports whether AIR credentials are present in
// the running environment (and the base URL), so we can confirm a deployment
// actually has the env vars without exposing any secret values.
export function GET() {
  const env = getAirEnv();
  return Response.json({
    configured: !!env,
    baseUrl: env?.baseUrl ?? null,
    hasParentBoard: !!env?.parentBoardId,
  });
}
