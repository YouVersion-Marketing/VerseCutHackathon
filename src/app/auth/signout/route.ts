import { signOut } from '@workos-inc/authkit-nextjs';

// Clears the WorkOS session and redirects to /login.
export async function GET() {
  await signOut({ returnTo: '/login' });
}
