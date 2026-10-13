import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAttendance } from "@/lib/clanEvents";
import { requireAdmin } from "@/lib/adminAuth";

// Manual add — for anyone attendance missed (e.g. a player without the Dink
// setup, or at an event with no kills).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { rsn } = await req.json();
  if (typeof rsn !== "string" || !rsn.trim()) return NextResponse.json({ error: "RSN is required" }, { status: 400 });

  const event = await prisma.clanEvent.findUnique({ where: { id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  await recordAttendance(id, rsn, "manual");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const attendeeId = new URL(req.url).searchParams.get("attendeeId");
  if (!attendeeId) return NextResponse.json({ error: "attendeeId is required" }, { status: 400 });

  await prisma.clanEventAttendee.deleteMany({ where: { id: attendeeId, eventId: id } });
  return NextResponse.json({ ok: true });
}
