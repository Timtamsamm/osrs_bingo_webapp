import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { password } = await req.json();

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id },
    data: { role: user.role === "ADMIN" ? "PLAYER" : "ADMIN" },
    select: { role: true },
  });

  return NextResponse.json({ role: updated.role });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const submissions = await prisma.submission.findMany({
    where: { userId: id },
    select: { imageUrl: true },
  });

  await prisma.user.delete({ where: { id } });

  if (submissions.length > 0) {
    await del(submissions.map((s) => s.imageUrl));
  }

  return NextResponse.json({ ok: true });
}
