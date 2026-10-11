import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseEventInput } from "../eventInput";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const input = parseEventInput(await req.json());
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });

  try {
    const event = await prisma.clanEvent.update({ where: { id }, data: input });
    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.clanEvent.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
