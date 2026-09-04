export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import BoardTabNav from "@/app/components/BoardTabNav";
import { computeStandings, type TierDef, type BonusConfig, type PointsConfig } from "@/lib/scoring";

export default async function TeamsPage() {
  const [board, teams] = await Promise.all([
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: {
        name: true,
        rowColBonuses: true,
        size: true,
        tiles: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            position: true,
            title: true,
            scoringMode: true,
            tiers: true,
            pointsConfig: true,
            submissions: {
              where: { status: { not: "REJECTED" }, teamId: { not: null } },
              select: { teamId: true, status: true, tier: true, pointsAwarded: true },
            },
          },
        },
      },
    }),
    prisma.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, _count: { select: { participants: true } } },
    }),
  ]);

  const size = board?.size ?? 5;
  const rawBonuses = board?.rowColBonuses as { t1?: number; t2?: number; t3?: number } | null;
  const bonusConfig: BonusConfig = { t1: rawBonuses?.t1 ?? 0, t2: rawBonuses?.t2 ?? 0, t3: rawBonuses?.t3 ?? 0 };

  const scoringTiles = (board?.tiles ?? []).map((t) => ({
    id: t.id,
    position: t.position,
    title: t.title,
    scoringMode: t.scoringMode as "TIERED" | "POINTS",
    tiers: (t.tiers as TierDef[]) ?? [],
    pointsConfig: t.pointsConfig as PointsConfig | null,
    submissions: t.submissions,
  }));

  const { standings, totalPoints, totalTiles } = computeStandings(scoringTiles, teams, bonusConfig, size);
  const memberCountById = new Map(teams.map((t) => [t.id, t._count.participants]));
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-base text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8 relative">
          <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mb-2">{board?.name ?? "Bingo Event"}</p>
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow">Teams</h1>
          <div className="absolute left-0 top-0">
            <Link href="/" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              ← Home
            </Link>
          </div>
          <div className="absolute right-0 top-0">
            <Link href="/bingo/admin" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              Admin →
            </Link>
          </div>
        </div>

        <BoardTabNav />

        {standings.length === 0 ? (
          <p className="text-purple-500/60 text-center py-12">No teams yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {standings.map((team, i) => {
              const pct = totalPoints > 0 ? (team.earnedPoints / totalPoints) * 100 : 0;
              return (
                <Link
                  key={team.id}
                  href={`/bingo/team/${team.id}`}
                  className="flex items-center gap-4 px-5 py-4 bg-[#0e0820] border border-purple-900/40 rounded-xl hover:border-purple-700/60 hover:bg-[#130a28] transition-colors"
                >
                  <span className="text-base w-6 text-center shrink-0 select-none">
                    {medals[i] ?? <span className="text-purple-700 text-sm">{i + 1}</span>}
                  </span>
                  <span className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/10" style={{ background: team.color, boxShadow: `0 0 6px ${team.color}80` }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{team.name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 bg-purple-950/60 rounded-full overflow-hidden max-w-[120px]">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: team.color, boxShadow: `0 0 4px ${team.color}` }} />
                      </div>
                      <span className="text-[11px] text-purple-600 tabular-nums">{memberCountById.get(team.id) ?? 0} members</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums" style={{ color: team.color }}>{+team.earnedPoints.toFixed(1)}<span className="text-purple-600 font-normal"> / {+totalPoints.toFixed(1)}</span></p>
                    <p className="text-[11px] text-purple-600 tabular-nums">{team.completedTiles}/{totalTiles} tiles</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
