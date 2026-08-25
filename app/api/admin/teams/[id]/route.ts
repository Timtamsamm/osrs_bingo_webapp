import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name, color } = await req.json();

  const data: { name?: string; color?: string } = {};
  if (name?.trim()) data.name = name.trim();
  if (color) data.color = color;
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  try {
    const team = await prisma.team.update({ where: { id }, data });
    return NextResponse.json(team);
  } catch {
    return NextResponse.json({ error: "Team not found or name taken" }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.team.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
