import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { invalidateBingoPages } from "@/lib/bingoData";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: teamId } = await params;
  const { rsn } = await req.json();
  if (!rsn?.trim()) return NextResponse.json({ error: "RSN required" }, { status: 400 });

  try {
    const participant = await prisma.participant.create({
      data: { rsn: rsn.trim(), teamId },
    });
    invalidateBingoPages();
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
  invalidateBingoPages();
  return NextResponse.json({ ok: true });
}
