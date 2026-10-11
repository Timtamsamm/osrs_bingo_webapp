import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recordAttendance } from "@/lib/clanEvents";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

// Manual add — for anyone the automatic check-in missed (e.g. no admin's
// Dink was online when they typed the join phrase).
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
