import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { invalidateBingoPages } from "@/lib/bingoData";

export async function DELETE() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const board = await prisma.bingoBoard.findFirst({ where: { active: true }, select: { id: true } });
  if (!board) return NextResponse.json({ error: "No active board" }, { status: 404 });

  const { count } = await prisma.templeSnapshot.deleteMany({ where: { boardId: board.id } });
  await prisma.bingoBoard.update({ where: { id: board.id }, data: { templeSnapshotTakenAt: null } });

  invalidateBingoPages();
  return NextResponse.json({ deleted: count });
}
