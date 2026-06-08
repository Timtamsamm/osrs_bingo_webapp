import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const tileId = form.get("tileId") as string | null;
  const note = (form.get("note") as string) ?? "";
  const teamMember = (form.get("teamMember") as string) || null;

  if (!file || !tileId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const tile = await prisma.bingoTile.findUnique({
    where: { id: tileId },
    include: { board: { select: { startsAt: true, endsAt: true } } },
  });
  if (!tile) return NextResponse.json({ error: "Tile not found" }, { status: 404 });

  const now = new Date();
  if (tile.board.startsAt && tile.board.startsAt > now) {
    return NextResponse.json({ error: "Event has not started yet" }, { status: 403 });
  }
  if (tile.board.endsAt && tile.board.endsAt < now) {
    return NextResponse.json({ error: "Event has ended" }, { status: 403 });
  }

  const activeCount = await prisma.submission.count({
    where: { userId: session.user.id, tileId, status: { not: "REJECTED" } },
  });
  if (activeCount >= tile.requiredCount) {
    return NextResponse.json({ error: "Already submitted" }, { status: 409 });
  }

  const { url } = await put(
    `submissions/${session.user.id}/${tileId}-${Date.now()}.jpg`,
    file,
    { access: "public" }
  );

  await prisma.submission.create({
    data: {
      userId: session.user.id,
      tileId,
      imageUrl: url,
      note: note || null,
      teamMember: teamMember || null,
      status: tile.autoApprove ? "APPROVED" : "PENDING",
      reviewedAt: tile.autoApprove ? new Date() : null,
    },
  });

  revalidatePath("/board");
  return NextResponse.json({ ok: true });
}
