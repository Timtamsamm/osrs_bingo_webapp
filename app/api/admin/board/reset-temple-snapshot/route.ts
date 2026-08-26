import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function DELETE() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const board = await prisma.bingoBoard.findFirst({ where: { active: true }, select: { id: true } });
  if (!board) return NextResponse.json({ error: "No active board" }, { status: 404 });

  const { count } = await prisma.templeSnapshot.deleteMany({ where: { boardId: board.id } });
  await prisma.bingoBoard.update({ where: { id: board.id }, data: { templeSnapshotTakenAt: null } });

  return NextResponse.json({ deleted: count });
}
