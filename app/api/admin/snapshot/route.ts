import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchBossKCs } from "@/lib/temple";

export async function DELETE() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const board = await prisma.bingoBoard.findFirst({ where: { active: true }, select: { id: true } });
  if (!board) return NextResponse.json({ error: "No active board" }, { status: 404 });

  const { count } = await prisma.playerSnapshot.deleteMany({ where: { boardId: board.id } });
  return NextResponse.json({ deleted: count });
}
export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const board = await prisma.bingoBoard.findFirst({
    where: { active: true },
    select: {
      id: true,
      tiles: false,
      snapshots: { select: { memberName: true } },
    },
  });

  if (!board) return NextResponse.json({ error: "No active board" }, { status: 404 });

  // Collect all unique member names across all users
  const users = await prisma.user.findMany({ select: { teamMembers: true } });
  const allMembers = [...new Set(users.flatMap((u) => u.teamMembers).filter(Boolean))];

  if (allMembers.length === 0) {
    return NextResponse.json({ error: "No team members found" }, { status: 400 });
  }

  const alreadySnapshotted = new Set(board.snapshots.map((s) => s.memberName.toLowerCase()));

  const results = { saved: [] as string[], skipped: [] as string[], failed: [] as string[] };

  // Fetch sequentially to avoid hammering the Jagex hiscores API
  for (const memberName of allMembers) {
    if (alreadySnapshotted.has(memberName.toLowerCase())) {
      results.skipped.push(memberName);
      continue;
    }

    try {
      const bosses = await fetchBossKCs(memberName);
      await prisma.playerSnapshot.upsert({
        where: { boardId_memberName: { boardId: board.id, memberName } },
        create: { boardId: board.id, memberName, bosses },
        update: { bosses, takenAt: new Date() },
      });
      results.saved.push(memberName);
    } catch {
      results.failed.push(memberName);
    }
  }

  return NextResponse.json(results);
}
