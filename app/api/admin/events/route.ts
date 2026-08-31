import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, description, imageUrl, startsAt, endsAt, participantNames } = await req.json();

  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!startsAt || !endsAt) return NextResponse.json({ error: "Start and end date/time required" }, { status: 400 });

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }
  if (end <= start) return NextResponse.json({ error: "End must be after start" }, { status: 400 });

  const event = await prisma.event.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      imageUrl: imageUrl || null,
      startsAt: start,
      endsAt: end,
      participantNames: Array.isArray(participantNames) ? participantNames.map((n: string) => n.trim()).filter(Boolean) : [],
    },
  });

  return NextResponse.json(event);
}
