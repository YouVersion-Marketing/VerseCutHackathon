import { redirect } from 'next/navigation';
import { getSignInUrl } from '@workos-inc/authkit-nextjs';

// Kicks off the WorkOS hosted sign-in.
export async function GET() {
  redirect(await getSignInUrl());
}
