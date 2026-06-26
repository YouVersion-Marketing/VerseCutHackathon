import { withAuth } from '@workos-inc/authkit-nextjs';
import App from '../App';

export default async function Page() {
  const { user } = await withAuth();
  return <App userEmail={user?.email ?? null} />;
}
