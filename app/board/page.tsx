export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import BoardTabNav from "@/app/components/BoardTabNav";
import Countdown from "@/app/components/Countdown";
import BoardView from "./BoardView";
import type { TileSummary, LineSummary, BonusConfig } from "./BoardView";
import { computeStandings, getLineBonusTier, getRows, getCols, type TierDef } from "@/lib/scoring";

export default async function BoardPage() {
  const [board, teams] = await Promise.all([
    prisma.bingoBoard.findFirst({
      where: { active: true },
      include: {
        tiles: {
          orderBy: { position: "asc" },
          include: {
            submissions: {
              where: { status: { not: "REJECTED" }, teamId: { not: null } },
              select: { teamId: true, status: true, tier: true },
            },
          },
        },
      },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
  ]);

  const size = board?.size ?? 5;
  const rawBonuses = board?.rowColBonuses as { t1?: number; t2?: number; t3?: number } | null;
  const bonusConfig: BonusConfig = {
    t1: rawBonuses?.t1 ?? 0,
    t2: rawBonuses?.t2 ?? 0,
    t3: rawBonuses?.t3 ?? 0,
  };

  // Tiles beyond the current grid size are left in the DB (from a previous
  // larger size) but excluded from scoring and display — see lib/scoring.ts.
  const scoringTiles = (board?.tiles ?? [])
    .filter((tile) => tile.position < size * size)
    .map((tile) => ({
      id: tile.id,
      position: tile.position,
      title: tile.title,
      tiers: (tile.tiers as TierDef[]) ?? [],
      submissions: tile.submissions,
    }));

  const { standings: teamList, totalPoints, totalTiles } = computeStandings(scoringTiles, teams, bonusConfig, size);
  const boardTileById = new Map((board?.tiles ?? []).map((t) => [t.id, t]));

  const tiles: TileSummary[] = scoringTiles.map((tile) => {
    const boardTile = boardTileById.get(tile.id)!;
    return {
      id: tile.id,
      position: tile.position,
      title: tile.title,
      description: boardTile.description,
      points: tile.tiers.reduce((sum, t) => sum + t.points, 0),
      tiers: tile.tiers.map((t) => ({ tier: t.tier, points: t.points, requiredCount: t.requiredCount })),
      imageUrl: boardTile.imageUrl,
      teamStatuses: teams.map((team) => {
        const teamSubs = tile.submissions.filter((s) => s.teamId === team.id);
        const achievedTiers = tile.tiers
          .filter((td) => teamSubs.filter((s) => s.tier === td.tier && s.status === "APPROVED").length >= td.requiredCount)
          .map((td) => td.tier);
        return {
          teamId: team.id,
          completed: achievedTiers.includes(1),
          inProgress: !achievedTiers.includes(1) && achievedTiers.length > 0,
          achievedTiers,
        };
      }),
    };
  });

  // Line summaries for the board grid
  const rowSummaries: LineSummary[] = getRows(size).map((positions, i) => ({
    index: i,
    statuses: teams.map((team) => ({
      teamId: team.id,
      bonusTier: getLineBonusTier(scoringTiles, positions, team.id),
    })),
  }));

  const colSummaries: LineSummary[] = getCols(size).map((positions, i) => ({
    index: i,
    statuses: teams.map((team) => ({
      teamId: team.id,
      bonusTier: getLineBonusTier(scoringTiles, positions, team.id),
    })),
  }));

  const boardIsEmpty = !board || scoringTiles.every((t) => !t.title.trim());

  if (board?.startsAt && board.startsAt > new Date()) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center p-6">
        <div className="text-center flex flex-col items-center gap-6">
          <p className="text-xs tracking-[0.3em] text-purple-500 uppercase">Upcoming Event</p>
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow">
            {board.name}
          </h1>
          {board.description && <p className="text-purple-300/70 text-sm max-w-sm">{board.description}</p>}
          <Countdown endsAt={board.startsAt.toISOString()} label="Starts in" reloadOnExpire />
          <p className="text-sm text-purple-500/60">
            {board.startsAt.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-base text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8 relative">
          <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mb-2">
            {board?.description ?? "Bingo Event"}
          </p>
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl md:text-5xl font-black text-white heading-glow">
            {board?.name ?? "Bingo Board"}
          </h1>
          {board?.endsAt && (
            <div className="mt-4">
              <Countdown endsAt={board.endsAt.toISOString()} label="Ends in" />
            </div>
          )}
          <div className="absolute right-0 top-0">
            <Link href="/admin" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              Admin →
            </Link>
          </div>
        </div>

        {/* Team standings */}
        {teamList.length > 0 && (
          <div className="mb-8 border border-purple-900/40 rounded-2xl overflow-hidden purple-glow-sm">
            <div className="px-5 py-3 border-b border-purple-900/30 bg-surface/40">
              <p className="text-xs tracking-[0.2em] text-purple-400 uppercase font-semibold">Standings</p>
            </div>
            <div className="divide-y divide-purple-900/20">
              {teamList.map((team, i) => {
                const pct = totalPoints > 0 ? (team.earnedPoints / totalPoints) * 100 : 0;
                return (
                  <div key={team.id} className="flex items-center gap-4 px-5 py-3.5 bg-surface/60 hover:bg-raised/60 transition-colors">
                    <span className="text-base w-6 text-center shrink-0 select-none">
                      {medals[i] ?? <span className="text-purple-700 text-sm">{i + 1}</span>}
                    </span>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/10" style={{ background: team.color, boxShadow: `0 0 6px ${team.color}80` }} />
                    <Link href={`/team/${team.id}`} className="text-sm font-semibold text-white flex-1 truncate hover:underline">{team.name}</Link>
                    <div className="hidden sm:flex items-center gap-2 w-36">
                      <div className="flex-1 h-1.5 bg-purple-950/60 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: team.color, boxShadow: `0 0 4px ${team.color}` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <span className="text-xs tabular-nums">
                        <span className="font-bold text-sm" style={{ color: team.color }}>{+team.earnedPoints.toFixed(1)}</span>
                        <span className="text-purple-600"> / {+totalPoints.toFixed(1)} pts</span>
                      </span>
                      <span className="text-xs text-purple-600 tabular-nums w-16 text-right hidden sm:block">
                        {team.completedTiles}/{totalTiles} tiles
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <BoardTabNav />

        {boardIsEmpty ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-5xl mb-5 opacity-40">⬛</p>
            <p className="text-lg font-semibold text-purple-200/60">The board is still being set up</p>
            <p className="text-sm text-purple-500/40 mt-1">Check back soon.</p>
          </div>
        ) : (
          <BoardView
            tiles={tiles}
            teams={teamList}
            rowSummaries={rowSummaries}
            colSummaries={colSummaries}
            bonusConfig={bonusConfig}
            size={size}
          />
        )}
      </div>
    </div>
  );
}
