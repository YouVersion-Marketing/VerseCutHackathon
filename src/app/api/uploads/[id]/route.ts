import { del } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { currentUser } from '@/lib/server/currentUser';

// DELETE — remove a team-shared background asset (DB row + Blob file). Shared
// assets are team-wide, so any signed-in user may curate them.
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const asset = await prisma.sharedAsset.findUnique({ where: { id } });
  if (!asset) return Response.json({ error: 'Not found' }, { status: 404 });

  await del(asset.fileUrl).catch(() => {
    /* Blob already gone or unreachable — still drop the DB row. */
  });
  await prisma.sharedAsset.delete({ where: { id } });
  return Response.json({ data: { id } });
}
