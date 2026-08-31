import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { title, description, imageUrl, startsAt, endsAt, participantNames } = await req.json();

  const data: { title?: string; description?: string | null; imageUrl?: string | null; startsAt?: Date; endsAt?: Date; participantNames?: string[] } = {};
  if (title?.trim()) data.title = title.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
  if (startsAt) data.startsAt = new Date(startsAt);
  if (endsAt) data.endsAt = new Date(endsAt);
  if (Array.isArray(participantNames)) data.participantNames = participantNames.map((n: string) => n.trim()).filter(Boolean);

  if (data.startsAt && isNaN(data.startsAt.getTime())) return NextResponse.json({ error: "Invalid start date/time" }, { status: 400 });
  if (data.endsAt && isNaN(data.endsAt.getTime())) return NextResponse.json({ error: "Invalid end date/time" }, { status: 400 });

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const start = data.startsAt ?? existing.startsAt;
  const end = data.endsAt ?? existing.endsAt;
  if (end <= start) return NextResponse.json({ error: "End must be after start" }, { status: 400 });

  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const event = await prisma.event.update({ where: { id }, data });
  return NextResponse.json(event);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { imageUrl: true } });
  if (event?.imageUrl) await del(event.imageUrl);
  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
