export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchTeamStats, ensureTempleSnapshotTaken, type TempleSnapshotEntry, type TempleStats } from "@/lib/templeosrs";
import TeamProgressChart from "./TeamProgressChart";
import TeamBoardGrid from "./TeamBoardGrid";
import BoardTabNav from "@/app/components/BoardTabNav";
import ZoomableThumbnail from "@/app/components/ZoomableThumbnail";
import { computeStandings, bonusPts, getRows, getCols, type TierDef, type BonusConfig, type PointsConfig } from "@/lib/scoring";

interface PointEvent {
  date: Date;
  delta: number;
  label: string;
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TeamPage({ params }: Props) {
  const { id } = await params;

  const [team, board, allTeams] = await Promise.all([
    prisma.team.findUnique({
      where: { id },
      select: { id: true, name: true, color: true, participants: { select: { rsn: true }, orderBy: { rsn: "asc" } } },
    }),
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: {
        id: true,
        name: true,
        startsAt: true,
        rowColBonuses: true,
        size: true,
        tiles: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            position: true,
            title: true,
            imageUrl: true,
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
    prisma.team.findMany({ select: { id: true, name: true, color: true } }),
  ]);

  if (!team) notFound();

  const submissions = board
    ? await prisma.submission.findMany({
        where: { teamId: team.id, tile: { boardId: board.id } },
        select: { id: true, tileId: true, tier: true, status: true, source: true, teamMember: true, dinkItemName: true, imageUrl: true, note: true, createdAt: true, pointsAwarded: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const size = board?.size ?? 5;
  // Tiles beyond the current grid size are left in the DB but hidden from
  // display/scoring — see lib/scoring.ts.
  const inRangeTiles = (board?.tiles ?? []).filter((t) => t.position < size * size);
  const tileById = new Map(inRangeTiles.map((t) => [t.id, t]));
  const allTileTitleById = new Map((board?.tiles ?? []).map((t) => [t.id, t.title]));
  const tierDefsByTile = new Map(inRangeTiles.map((t) => [t.id, (t.tiers as TierDef[]) ?? []]));
  const pointsConfigByTile = new Map(
    inRangeTiles.map((t) => [t.id, t.scoringMode === "POINTS" ? (t.pointsConfig as PointsConfig | null) : null])
  );
  const isConfiguredTile = (tileId: string) =>
    (tierDefsByTile.get(tileId) ?? []).length > 0 || !!pointsConfigByTile.get(tileId);
  const rawBonuses = board?.rowColBonuses as { t1?: number; t2?: number; t3?: number } | null;
  const bonusConfig: BonusConfig = { t1: rawBonuses?.t1 ?? 0, t2: rawBonuses?.t2 ?? 0, t3: rawBonuses?.t3 ?? 0 };
  const LINES = [...getRows(size).map((p, i) => ({ key: `row-${i}`, label: `Row ${i + 1}`, positions: p })),
    ...getCols(size).map((p, i) => ({ key: `col-${i}`, label: `Column ${i + 1}`, positions: p }))];

  const approved = submissions.filter((s) => s.status === "APPROVED");

  // Replay approved submissions chronologically to build a points-over-time timeline.
  const countByTileTier = new Map<string, number>();
  const achievedByTile = new Map<string, Set<number>>();
  const lineBonusTier = new Map<string, number | null>();
  for (const l of LINES) lineBonusTier.set(l.key, null);

  function bestTierForTile(tileId: string): number | null {
    const s = achievedByTile.get(tileId);
    if (!s || s.size === 0) return null;
    return Math.min(...s);
  }

  function computeLineTier(positions: number[]): number | null {
    const best = positions.map((p) => {
      const tile = [...tileById.values()].find((t) => t.position === p);
      if (!tile) return null;
      if (!isConfiguredTile(tile.id)) return null;
      return bestTierForTile(tile.id);
    });
    if (best.some((b) => b === null)) return null;
    return Math.max(...(best as number[]));
  }

  const events: PointEvent[] = [];
  let runningTotal = 0;
  const pointsTotalByTile = new Map<string, number>();

  for (const sub of approved) {
    let tile: (typeof inRangeTiles)[number] | undefined;

    if (sub.tier === null) {
      // Points-mode drop — unlimited duplicates, each already diminished at
      // creation time (see lib/scoring.ts's diminishingPoints). Credit is
      // capped at the tile's target, same as computeStandings().
      if (sub.pointsAwarded == null) continue;
      const cfg = pointsConfigByTile.get(sub.tileId);
      if (!cfg) continue;

      const prevTotal = pointsTotalByTile.get(sub.tileId) ?? 0;
      if (prevTotal >= cfg.target) continue;
      const newTotal = Math.min(prevTotal + sub.pointsAwarded, cfg.target);
      pointsTotalByTile.set(sub.tileId, newTotal);
      const delta = newTotal - prevTotal;
      if (delta <= 0) continue;

      tile = tileById.get(sub.tileId);
      runningTotal += delta;
      events.push({ date: sub.createdAt, delta, label: `${tile?.title ?? "Tile"} (+${+delta.toFixed(1)}pts)` });

      if (newTotal >= cfg.target) {
        // Treat reaching the target as equivalent to a T1 completion for
        // line-bonus purposes — matches getLineBonusTier in lib/scoring.ts.
        const set = achievedByTile.get(sub.tileId) ?? new Set<number>();
        set.add(1);
        achievedByTile.set(sub.tileId, set);
      }
    } else {
      const tierDefs = tierDefsByTile.get(sub.tileId) ?? [];
      const tierDef = tierDefs.find((t) => t.tier === sub.tier);
      if (!tierDef) continue;

      const key = `${sub.tileId}:${sub.tier}`;
      const newCount = (countByTileTier.get(key) ?? 0) + 1;
      countByTileTier.set(key, newCount);
      if (newCount !== tierDef.requiredCount) continue;

      tile = tileById.get(sub.tileId);
      runningTotal += tierDef.points;
      events.push({ date: sub.createdAt, delta: tierDef.points, label: `${tile?.title ?? "Tile"} (T${sub.tier})` });

      const set = achievedByTile.get(sub.tileId) ?? new Set<number>();
      set.add(sub.tier);
      achievedByTile.set(sub.tileId, set);
    }

    if (!tile) continue;
    for (const line of LINES) {
      if (!line.positions.includes(tile.position)) continue;
      const newTier = computeLineTier(line.positions);
      const oldTier = lineBonusTier.get(line.key) ?? null;
      if (newTier === oldTier) continue;
      const delta = bonusPts(newTier, bonusConfig) - bonusPts(oldTier, bonusConfig);
      if (delta !== 0) {
        runningTotal += delta;
        events.push({ date: sub.createdAt, delta, label: `${line.label} bonus` });
      }
      lineBonusTier.set(line.key, newTier);
    }
  }

  const chartPoints: { date: string; cumulative: number }[] = [];
  let running = 0;
  if (events.length > 0) {
    chartPoints.push({ date: events[0].date.toISOString(), cumulative: 0 });
    for (const e of events) {
      running += e.delta;
      chartPoints.push({ date: e.date.toISOString(), cumulative: running });
    }
  }

  const completedTiles = [...achievedByTile.values()].filter((s) => s.has(1)).length;
  const totalTiles = inRangeTiles.filter((t) => t.title.trim()).length;

  // Rank among all teams — same shared scoring rule the board page uses, so they always agree.
  const scoringTiles = inRangeTiles.map((t) => ({
    id: t.id,
    position: t.position,
    title: t.title,
    scoringMode: t.scoringMode as "TIERED" | "POINTS",
    tiers: (t.tiers as TierDef[]) ?? [],
    pointsConfig: t.pointsConfig as PointsConfig | null,
    submissions: t.submissions,
  }));
  const { standings } = computeStandings(scoringTiles, allTeams, bonusConfig, size);
  const rank = standings.findIndex((s) => s.id === team.id) + 1;

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

  const teamStats = await fetchTeamStats(team.participants.map((p) => p.rsn), snapshotsByRsn);
  const topBosses = Object.entries(teamStats.bosses).sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <div className="min-h-screen bg-base text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full shrink-0 ring-1 ring-white/10" style={{ background: team.color, boxShadow: `0 0 8px ${team.color}80` }} />
            <div>
              <p className="text-xs tracking-[0.2em] text-purple-500 uppercase">{board?.name ?? "Bingo Event"}</p>
              <h1 className="font-[family-name:var(--font-cinzel)] text-3xl font-black text-white heading-glow">{team.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">← Home</Link>
            <Link href="/bingo/teams" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">Back to teams</Link>
          </div>
        </div>

        <BoardTabNav />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Rank" value={rank > 0 ? `#${rank} / ${allTeams.length}` : "—"} />
          <StatTile label="Points" value={`${+runningTotal.toFixed(1)}`} />
          <StatTile label="Tiles" value={`${completedTiles}/${totalTiles}`} />
          <StatTile label="Members" value={`${team.participants.length}`} />
        </div>

        {chartPoints.length > 1 && (
          <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5">
            <p className="text-xs tracking-[0.2em] text-purple-400 uppercase font-semibold mb-4">Points over time</p>
            <TeamProgressChart points={chartPoints} color={team.color} />
          </div>
        )}

        <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5">
          <p className="text-xs tracking-[0.2em] text-purple-400 uppercase font-semibold mb-1">Combined team stats (TempleOSRS)</p>
          <p className="text-[11px] text-purple-700/60 mb-4">
            {eventStarted ? "Gained since the event started" : "Lifetime totals — the event hasn't started yet"}
          </p>
          {teamStats.trackedCount === 0 ? (
            <p className="text-sm text-purple-600/70">None of this team&apos;s players are tracked on TempleOSRS yet.</p>
          ) : (
            <>
              <p className="text-[11px] text-purple-700/60 mb-4">{teamStats.trackedCount}/{teamStats.totalCount} members tracked</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <StatTile label="Total EHB" value={Math.round(teamStats.ehb).toLocaleString()} accent="text-amber-400" />
                <StatTile label="Total EHP" value={Math.round(teamStats.ehp).toLocaleString()} accent="text-green-400" />
                <StatTile label="Combined XP" value={Math.round(teamStats.overallXp).toLocaleString()} accent="text-blue-400" />
                <StatTile label="CL items" value={teamStats.collectionFinished.toLocaleString()} accent="text-teal-400" />
              </div>

              <p className="text-xs text-purple-500 mb-2">Clue scrolls (combined)</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-1.5 mb-5">
                {(["beginner", "easy", "medium", "hard", "elite", "master"] as const).map((k) => (
                  <div key={k} className="flex flex-col">
                    <span className="text-[11px] text-purple-700/70 capitalize">{k}</span>
                    <span className="text-sm text-teal-400 tabular-nums font-semibold">{teamStats.clues[k]}</span>
                  </div>
                ))}
              </div>

              {topBosses.length > 0 && (
                <>
                  <p className="text-xs text-purple-500 mb-2">Top bosses/activities (combined KC)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
                    {topBosses.map(([boss, kc]) => (
                      <div key={boss} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-purple-300 truncate">{boss}</span>
                        <span className="text-sm text-purple-100 tabular-nums shrink-0 font-semibold">{kc.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5">
          <p className="text-xs tracking-[0.2em] text-purple-400 uppercase font-semibold mb-4">Board progress</p>
          <TeamBoardGrid
            size={size}
            teamColor={team.color}
            tiles={inRangeTiles.filter((t) => t.title.trim()).map((tile) => {
              const cfg = pointsConfigByTile.get(tile.id);
              return {
                id: tile.id,
                position: tile.position,
                title: tile.title,
                imageUrl: tile.imageUrl,
                // Points-mode tiles have no discrete tiers — represent the
                // whole tile as a single synthetic "tier" worth its target,
                // achieved only once the target is fully reached, so the
                // existing tier-based grid component can render it as-is.
                tiers: cfg
                  ? [{ tier: 1, points: cfg.target, requiredCount: 1 }]
                  : ((tile.tiers as TierDef[]) ?? []).map((td) => ({ tier: td.tier, points: td.points, requiredCount: td.requiredCount })),
                achievedTiers: [...(achievedByTile.get(tile.id) ?? new Set<number>())],
              };
            })}
          />
        </div>

        <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5">
          <p className="text-xs tracking-[0.2em] text-purple-400 uppercase font-semibold mb-4">Activity</p>
          {submissions.length === 0 ? (
            <p className="text-sm text-purple-600/70">No submissions yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {[...submissions].reverse().map((s) => {
                const tileTitle = allTileTitleById.get(s.tileId) ?? "Tile";
                return (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#130a28]/60">
                    {s.imageUrl && <ZoomableThumbnail src={s.imageUrl} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-purple-100 truncate">
                        {tileTitle}{" "}
                        {s.tier != null && <span className="text-purple-500">T{s.tier}</span>}
                        {s.dinkItemName && <span className="text-purple-500"> · {s.dinkItemName}</span>}
                        {s.pointsAwarded != null && <span className="text-purple-500"> · +{+s.pointsAwarded.toFixed(1)}pts</span>}
                      </p>
                      <p className="text-[11px] text-purple-700/70">
                        {s.teamMember ?? "—"} · {s.source}
                        {s.status !== "APPROVED" && <span className="text-amber-500"> · {s.status.toLowerCase()}</span>}
                      </p>
                    </div>
                    <span className="text-[11px] text-purple-700/60 shrink-0" suppressHydrationWarning>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl px-4 py-3">
      <p className="text-[11px] text-purple-600 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}
