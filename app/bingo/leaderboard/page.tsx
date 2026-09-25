export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import BoardTabNav from "@/app/components/BoardTabNav";
import PageHeaderNav from "@/app/components/PageHeaderNav";
import LeaderboardTable from "./LeaderboardTable";
import { fetchTempleStats, diffTempleStats, ensureTempleSnapshotTaken, type TempleSnapshotEntry, type TempleStats } from "@/lib/templeosrs";
import {
  creditIndividualPoints,
  normalizeRsn,
  normalizedTeamSize,
  scaleFactorFor,
  type TierDef,
  type PointsConfig,
} from "@/lib/scoring";

interface SubmissionForCredit {
  tileId: string;
  tier: number | null;
  teamId: string | null;
  teamMember: string | null;
  pointsAwarded: number | null;
  dinkItemId: number | null;
}

export default async function LeaderboardPage() {
  const [board, participants] = await Promise.all([
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: {
        id: true,
        name: true,
        startsAt: true,
        size: true,
        scaleByTeamSize: true,
        tiles: {
          select: {
            id: true,
            position: true,
            scoringMode: true,
            tiers: true,
            pointsConfig: true,
            submissions: {
              where: { status: "APPROVED", teamId: { not: null } },
              select: { teamId: true, tier: true, teamMember: true, pointsAwarded: true, dinkItemId: true, createdAt: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    }),
    prisma.participant.findMany({
      include: { team: { select: { id: true, name: true, color: true } } },
      orderBy: { rsn: "asc" },
    }),
  ]);

  const size = board?.size ?? 5;
  // Tiles beyond the current grid size are hidden, not deleted — see lib/scoring.ts.
  const inRangeTiles = (board?.tiles ?? []).filter((t) => t.position < size * size);
  const tierDefsByTile = new Map(inRangeTiles.map((t) => [t.id, (t.tiers as TierDef[]) ?? []]));
  const pointsConfigByTile = new Map(
    inRangeTiles.map((t) => [t.id, t.scoringMode === "POINTS" ? (t.pointsConfig as PointsConfig | null) : null])
  );

  const teamSizeById = new Map<string, number>();
  for (const p of participants) {
    teamSizeById.set(p.team.id, (teamSizeById.get(p.team.id) ?? 0) + 1);
  }
  const maxTeamSize = board?.scaleByTeamSize
    ? Math.max(1, ...[...teamSizeById.values()].map(normalizedTeamSize))
    : 1;

  // Group approved submissions by team — tier/points progress is inherently
  // team-scoped (a tile's requirement is filled by the team collectively),
  // so points are credited to individuals one team's submissions at a time.
  const submissionsByTeam = new Map<string, SubmissionForCredit[]>();
  const dropsByRsn = new Map<string, number>();
  for (const tile of inRangeTiles) {
    for (const sub of tile.submissions) {
      if (!sub.teamId) continue;
      const arr = submissionsByTeam.get(sub.teamId) ?? [];
      arr.push({ ...sub, tileId: tile.id });
      submissionsByTeam.set(sub.teamId, arr);

      if (sub.teamMember) {
        const norm = normalizeRsn(sub.teamMember);
        dropsByRsn.set(norm, (dropsByRsn.get(norm) ?? 0) + 1);
      }
    }
  }

  const pointsByRsn = new Map<string, number>();
  for (const [teamId, subs] of submissionsByTeam) {
    const scaleFactor = board?.scaleByTeamSize
      ? scaleFactorFor(normalizedTeamSize(teamSizeById.get(teamId) ?? 1), maxTeamSize)
      : 1;
    for (const [norm, pts] of creditIndividualPoints(subs, tierDefsByTile, pointsConfigByTile, scaleFactor)) {
      pointsByRsn.set(norm, (pointsByRsn.get(norm) ?? 0) + pts);
    }
  }

  // Full TempleOSRS stats gained since the event started, same
  // baseline-snapshot approach the team page uses — fetched here (not lazily
  // per-row) since we're already listing everyone.
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
  const templeByRsn = new Map<string, TempleStats | null>();
  participants.forEach((p, i) => {
    const raw = rawTempleList[i];
    if (!raw) {
      templeByRsn.set(normalizeRsn(p.rsn), null);
      return;
    }
    const snapshot = snapshotsByRsn.get(p.rsn);
    templeByRsn.set(normalizeRsn(p.rsn), snapshot ? diffTempleStats(raw, snapshot.stats) : raw);
  });

  const rows = participants
    .map((p) => {
      const norm = normalizeRsn(p.rsn);
      return {
        rsn: p.rsn,
        team: { id: p.team.id, name: p.team.name, color: p.team.color },
        points: pointsByRsn.get(norm) ?? 0,
        drops: dropsByRsn.get(norm) ?? 0,
        temple: templeByRsn.get(norm) ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.drops - a.drops ||
        (b.temple?.ehb ?? -1) - (a.temple?.ehb ?? -1) ||
        a.rsn.localeCompare(b.rsn)
    );

  return (
    <div className="min-h-screen bg-base text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <PageHeaderNav>
            <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow pt-1">
              Leaderboard
            </h1>
            <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mt-3">{board?.name ?? "Bingo Event"}</p>
            <p className="text-xs text-purple-600/70 mt-2">
              {eventStarted
                ? "TempleOSRS stats shown are gained since the event started"
                : "TempleOSRS stats shown are lifetime totals — the event hasn't started yet"}
            </p>
          </PageHeaderNav>
        </div>

        <BoardTabNav />

        {rows.length === 0 ? (
          <p className="text-purple-500/60 text-center py-12">No players registered yet.</p>
        ) : (
          <LeaderboardTable rows={rows} />
        )}
      </div>
    </div>
  );
}
