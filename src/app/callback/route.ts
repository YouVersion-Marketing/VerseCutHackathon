import { handleAuth } from '@workos-inc/authkit-nextjs';

// WorkOS redirects here after sign-in; this completes the session then sends
// the user to the app root.
export const GET = handleAuth({ returnPathname: '/' });
