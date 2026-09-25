export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import BoardTabNav from "@/app/components/BoardTabNav";
import PlayersFilter from "./PlayersFilter";
import { fetchTempleStats, diffTempleStats, ensureTempleSnapshotTaken, type TempleSnapshotEntry, type TempleStats } from "@/lib/templeosrs";
import Link from "next/link";

export default async function PlayersPage() {
  const [board, participants] = await Promise.all([
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: { id: true, name: true, startsAt: true },
    }),
    prisma.participant.findMany({
      include: { team: { select: { id: true, name: true } } },
      orderBy: { rsn: "asc" },
    }),
  ]);

  if (board) await ensureTempleSnapshotTaken(board.id, board.startsAt);

  const snapshotsByRsn = new Map<string, TempleSnapshotEntry>();
  if (board) {
    const snapshots = await prisma.templeSnapshot.findMany({
      where: { boardId: board.id },
      select: { rsn: true, stats: true, collectionFinished: true },
    });
    for (const s of snapshots) {
      snapshotsByRsn.set(s.rsn, { stats: s.stats as unknown as TempleStats, collectionFinished: s.collectionFinished });
    }
  }
  const eventStarted = snapshotsByRsn.size > 0;

  const rawTempleList = await Promise.all(participants.map((p) => fetchTempleStats(p.rsn)));
  const templeList = rawTempleList.map((raw, i) => {
    if (!raw) return null;
    const snapshot = snapshotsByRsn.get(participants[i].rsn);
    return snapshot ? diffTempleStats(raw, snapshot.stats) : raw;
  });

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
          <div className="absolute left-0 top-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-purple-800/50 bg-surface/60 px-3.5 py-2 text-sm text-purple-300 hover:text-white hover:border-purple-600/60 hover:bg-raised/60 transition-colors font-medium"
            >
              ← Home
            </Link>
          </div>
          <div className="absolute right-0 top-0">
            <Link
              href="/bingo/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-purple-800/50 bg-surface/60 px-3.5 py-2 text-sm text-purple-300 hover:text-white hover:border-purple-600/60 hover:bg-raised/60 transition-colors font-medium"
            >
              Admin →
            </Link>
          </div>
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow pt-1">
            Players
          </h1>
          <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mt-3">
            {board?.name ?? "Bingo Event"}
          </p>
          <p className="text-xs text-purple-600/70 mt-2">
            {eventStarted
              ? "TempleOSRS stats shown are gained since the event started"
              : "TempleOSRS stats shown are lifetime totals — the event hasn't started yet"}
          </p>
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
