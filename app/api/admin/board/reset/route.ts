import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

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

  // Delete all submissions and reset all tile content in one transaction
  await prisma.$transaction([
    prisma.submission.deleteMany({ where: { tileId: { in: tileIds } } }),
    prisma.bingoTile.updateMany({
      where: { id: { in: tileIds } },
      data: {
        title: "",
        description: null,
        imageUrl: null,
        pointsPerSubmission: 1,
        points: 1,
        requiredCount: 1,
      },
    }),
  ]);

  // Clean up Blobs after DB changes succeed
  const blobsToDelete = [
    ...submissions.map((s) => s.imageUrl),
    ...tileImageUrls,
  ];
  if (blobsToDelete.length > 0) {
    await del(blobsToDelete);
  }

  return NextResponse.json({ deletedSubmissions: submissions.length, resetTiles: tileIds.length });
}
