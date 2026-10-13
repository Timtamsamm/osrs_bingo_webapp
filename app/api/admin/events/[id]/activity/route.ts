import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

// Removes one kill or drop from an event (e.g. a fake or mis-attributed one).
// Attendance isn't touched — remove the player separately if needed.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const activityId = new URL(req.url).searchParams.get("activityId");
  if (!activityId) return NextResponse.json({ error: "activityId is required" }, { status: 400 });

  const row = await prisma.clanEventActivity.findFirst({ where: { id: activityId, eventId: id }, select: { id: true, imageUrl: true } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.clanEventActivity.delete({ where: { id: row.id } });

  // A screenshot is shared by every item from the same drop — only delete it
  // from Blob storage once nothing references it any more.
  if (row.imageUrl && !(await prisma.clanEventActivity.count({ where: { imageUrl: row.imageUrl } }))) {
    await del(row.imageUrl).catch((e) => console.error("events: screenshot delete failed", e));
  }
  return NextResponse.json({ ok: true });
}
