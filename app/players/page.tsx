export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import BoardTabNav from "@/app/components/BoardTabNav";
import PlayersFilter from "./PlayersFilter";
import type { BossKCs } from "@/lib/temple";
import Link from "next/link";

export default async function PlayersPage() {
  const [board, participants] = await Promise.all([
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: {
        name: true,
        snapshots: { select: { memberName: true, bosses: true } },
      },
    }),
    prisma.participant.findMany({
      include: { team: { select: { name: true } } },
      orderBy: { rsn: "asc" },
    }),
  ]);

  const snapshotMap = new Map<string, BossKCs>();
  for (const s of board?.snapshots ?? []) {
    snapshotMap.set(s.memberName.toLowerCase(), s.bosses as BossKCs);
  }

  const players = participants.map((p) => ({
    memberName: p.rsn,
    teamName: p.team.name,
    snapshot: snapshotMap.get(p.rsn.toLowerCase()) ?? null,
  }));

  const teams = [...new Set(participants.map((p) => p.team.name))].sort();

  const bossSet = new Set<string>();
  for (const snapshot of snapshotMap.values()) {
    for (const [boss, kc] of Object.entries(snapshot)) {
      if (kc > 0) bossSet.add(boss);
    }
  }
  const bosses = Array.from(bossSet).sort();

  return (
    <div className="min-h-screen bg-base text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8 relative">
          <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mb-2">
            {board?.name ?? "Bingo Event"}
          </p>
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow">
            Players
          </h1>
          <div className="absolute right-0 top-0">
            <Link href="/admin" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              Admin →
            </Link>
          </div>
        </div>

        <BoardTabNav />

        {players.length === 0 ? (
          <p className="text-purple-500/60 text-center py-12">No players registered yet.</p>
        ) : (
          <PlayersFilter players={players} teams={teams} bosses={bosses} />
        )}
      </div>
    </div>
  );
}
