import { del } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/server/currentUser';

// DELETE — remove one of the signed-in user's saved ads (DB row + Blob file).
// Owner-only: a user can only delete their own saved ads.
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const ad = await prisma.generatedAd.findUnique({ where: { id } });
  if (!ad || ad.ownerId !== user.id) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  await del(ad.fileUrl).catch(() => {
    /* Blob already gone or unreachable — still drop the DB row. */
  });
  await prisma.generatedAd.delete({ where: { id } });
  return Response.json({ data: { id } });
}
