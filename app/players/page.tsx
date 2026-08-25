export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import BoardTabNav from "@/app/components/BoardTabNav";
import PlayersFilter from "./PlayersFilter";
import { fetchTempleStats } from "@/lib/templeosrs";
import Link from "next/link";

export default async function PlayersPage() {
  const [board, participants] = await Promise.all([
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: { name: true },
    }),
    prisma.participant.findMany({
      include: { team: { select: { id: true, name: true } } },
      orderBy: { rsn: "asc" },
    }),
  ]);

  const templeList = await Promise.all(participants.map((p) => fetchTempleStats(p.rsn)));

  const players = participants.map((p, i) => ({
    memberName: p.rsn,
    teamId: p.team.id,
    teamName: p.team.name,
    temple: templeList[i],
  }));

  const teams = [...new Set(participants.map((p) => p.team.name))].sort();

  const bossSet = new Set<string>();
  for (const temple of templeList) {
    for (const [boss, stat] of Object.entries(temple?.bosses ?? {})) {
      if (stat.kc > 0) bossSet.add(boss);
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
