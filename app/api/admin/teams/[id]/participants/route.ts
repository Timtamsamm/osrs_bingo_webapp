import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: teamId } = await params;
  const { rsn } = await req.json();
  if (!rsn?.trim()) return NextResponse.json({ error: "RSN required" }, { status: 400 });

  try {
    const participant = await prisma.participant.create({
      data: { rsn: rsn.trim(), teamId },
    });
    return NextResponse.json(participant);
  } catch {
    return NextResponse.json({ error: "RSN already registered" }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: teamId } = await params;
  const { participantId } = await req.json();
  if (!participantId) return NextResponse.json({ error: "participantId required" }, { status: 400 });

  await prisma.participant.deleteMany({ where: { id: participantId, teamId } });
  return NextResponse.json({ ok: true });
}
