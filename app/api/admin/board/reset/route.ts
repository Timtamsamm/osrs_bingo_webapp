import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateBingoWebhookCache } from "@/lib/webhookCache";
import { del } from "@vercel/blob";
import { requireAdmin } from "@/lib/adminAuth";
import { invalidateBingoPages } from "@/lib/bingoData";

export async function DELETE() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const board = await prisma.bingoBoard.findFirst({
    where: { active: true },
    select: { id: true, tiles: { select: { id: true, imageUrl: true } } },
  });

  if (!board) return NextResponse.json({ error: "No active board" }, { status: 404 });

  const tileIds = board.tiles.map((t) => t.id);

  // Collect all Blob URLs to delete
  const submissions = await prisma.submission.findMany({
    where: { tileId: { in: tileIds } },
    select: { imageUrl: true },
  });

  const tileImageUrls = board.tiles.map((t) => t.imageUrl).filter((u): u is string => u !== null);

  // Delete all submissions, reset all tile content, and clear the TempleOSRS
  // baseline (so the next event on this board gets a fresh snapshot) in one transaction
  await prisma.$transaction([
    prisma.submission.deleteMany({ where: { tileId: { in: tileIds } } }),
    prisma.bingoTile.updateMany({
      where: { id: { in: tileIds } },
      data: {
        title: "",
        description: null,
        imageUrl: null,
        tiers: [],
      },
    }),
    prisma.templeSnapshot.deleteMany({ where: { boardId: board.id } }),
    prisma.bingoBoard.update({ where: { id: board.id }, data: { templeSnapshotTakenAt: null } }),
  ]);

  // Clean up Blobs after DB changes succeed
  const blobsToDelete = [
    ...submissions.map((s) => s.imageUrl).filter((u): u is string => u !== null),
    ...tileImageUrls,
  ];
  if (blobsToDelete.length > 0) {
    await del(blobsToDelete);
  }

  invalidateBingoWebhookCache();
  invalidateBingoPages();
  return NextResponse.json({ deletedSubmissions: submissions.length, resetTiles: tileIds.length });
}
