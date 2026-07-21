import { getAirEnv } from '@/lib/server/air';
import { getAwsEnv } from '@/lib/server/aws';
import { getBrazeEnv } from '@/lib/server/braze';

// Public, no-secret diagnostic: reports whether each upload destination has
// credentials present in the running environment (no secret values exposed).
export function GET() {
  const air = getAirEnv();
  const aws = getAwsEnv();
  const braze = getBrazeEnv();
  return Response.json({
    air: { configured: !!air, baseUrl: air?.baseUrl ?? null },
    aws: { configured: !!aws, bucket: aws?.bucket ?? null, region: aws?.region ?? null },
    braze: { configured: !!braze, restEndpoint: braze?.restEndpoint ?? null },
  });
}
