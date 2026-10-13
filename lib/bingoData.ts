/**
 * Cached data loaders for the public bingo pages.
 *
 * During a bingo, dozens of players refresh the board/teams/leaderboard
 * constantly, and every view used to re-run the same queries (the whole board
 * with every submission) plus a TempleOSRS snapshot check that writes to the
 * DB. These loaders share one cached copy across all views for
 * PAGE_CACHE_SECONDS. New Dink submissions therefore show up within that
 * window; admin changes clear the cache straight away (invalidateBingoPages).
 *
 * unstable_cache stores JSON, so Dates come back as strings — the exported
 * wrappers turn them back into Dates, keeping the page code unchanged.
 */

import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureTempleSnapshotTaken } from "@/lib/templeosrs";

const TAG = "bingo-pages";
const PAGE_CACHE_SECONDS = 30;

const toDate = (s: string | null) => (s ? new Date(s) : null);

/** Clears every cached bingo page loader — call after any admin change. */
export function invalidateBingoPages(): void {
  revalidateTag(TAG, { expire: 0 });
}

/* ── Active board with tiles and their non-rejected submissions ───────── */

const loadActiveBoard = unstable_cache(
  async () => {
    const board = await prisma.bingoBoard.findFirst({
      where: { active: true },
      select: {
        id: true,
        name: true,
        description: true,
        startsAt: true,
        endsAt: true,
        rowColBonuses: true,
        size: true,
        scaleByTeamSize: true,
        tiles: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            position: true,
            title: true,
            description: true,
            imageUrl: true,
            scoringMode: true,
            tiers: true,
            pointsConfig: true,
            submissions: {
              where: { status: { not: "REJECTED" }, teamId: { not: null } },
              select: { teamId: true, status: true, tier: true, pointsAwarded: true, dinkItemId: true, teamMember: true, createdAt: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });
    return board ? JSON.parse(JSON.stringify(board)) as typeof board : null;
  },
  ["bingo-active-board"],
  { tags: [TAG], revalidate: PAGE_CACHE_SECONDS }
);

/**
 * The active board, its tiles (position order) and every PENDING/APPROVED
 * team submission (oldest first). Pages filter further, e.g. APPROVED only.
 */
export async function getActiveBoard() {
  const board = await loadActiveBoard();
  if (!board) return null;
  return {
    ...board,
    startsAt: toDate(board.startsAt as unknown as string | null),
    endsAt: toDate(board.endsAt as unknown as string | null),
    tiles: board.tiles.map((t) => ({
      ...t,
      submissions: t.submissions.map((s) => ({ ...s, createdAt: new Date(s.createdAt as unknown as string) })),
    })),
  };
}

/* ── Teams, participants ──────────────────────────────────────────────── */

/** Every team with its member count, by name. */
export const getTeamsWithSize = unstable_cache(
  async () => {
    const teams = await prisma.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, _count: { select: { participants: true } } },
    });
    return teams.map((t) => ({ id: t.id, name: t.name, color: t.color, size: t._count.participants }));
  },
  ["bingo-teams"],
  { tags: [TAG], revalidate: PAGE_CACHE_SECONDS }
);

/** Every participant with their team, by RSN. */
export const getParticipantsWithTeam = unstable_cache(
  async () =>
    prisma.participant.findMany({
      select: { rsn: true, team: { select: { id: true, name: true, color: true } } },
      orderBy: { rsn: "asc" },
    }),
  ["bingo-participants"],
  { tags: [TAG], revalidate: PAGE_CACHE_SECONDS }
);

/** One team with its members (RSN order), or null. */
export const getTeam = unstable_cache(
  async (id: string) =>
    prisma.team.findUnique({
      where: { id },
      select: { id: true, name: true, color: true, participants: { select: { rsn: true }, orderBy: { rsn: "asc" } } },
    }),
  ["bingo-team"],
  { tags: [TAG], revalidate: PAGE_CACHE_SECONDS }
);

/* ── Per-team submissions and recent drops ────────────────────────────── */

const loadTeamSubmissions = unstable_cache(
  async (teamId: string, boardId: string) => {
    const subs = await prisma.submission.findMany({
      where: { teamId, tile: { boardId } },
      select: { id: true, tileId: true, tier: true, status: true, source: true, teamMember: true, dinkItemName: true, dinkItemId: true, dinkSource: true, imageUrl: true, note: true, createdAt: true, pointsAwarded: true },
      orderBy: { createdAt: "asc" },
    });
    return JSON.parse(JSON.stringify(subs)) as typeof subs;
  },
  ["bingo-team-submissions"],
  { tags: [TAG], revalidate: PAGE_CACHE_SECONDS }
);

/** All of a team's submissions on a board (every status), oldest first. */
export async function getTeamSubmissions(teamId: string, boardId: string) {
  const subs = await loadTeamSubmissions(teamId, boardId);
  return subs.map((s) => ({ ...s, createdAt: new Date(s.createdAt as unknown as string) }));
}

const loadRecentDrops = unstable_cache(
  async (boardId: string, limit: number) => {
    const drops = await prisma.submission.findMany({
      where: { status: "APPROVED", tile: { boardId } },
      select: {
        id: true,
        tier: true,
        source: true,
        dinkSource: true,
        teamMember: true,
        dinkItemName: true,
        pointsAwarded: true,
        imageUrl: true,
        createdAt: true,
        tile: { select: { title: true } },
        team: { select: { id: true, name: true, color: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return JSON.parse(JSON.stringify(drops)) as typeof drops;
  },
  ["bingo-recent-drops"],
  { tags: [TAG], revalidate: PAGE_CACHE_SECONDS }
);

/** The latest approved drops on a board, newest first. */
export async function getRecentDrops(boardId: string, limit: number) {
  const drops = await loadRecentDrops(boardId, limit);
  return drops.map((d) => ({ ...d, createdAt: new Date(d.createdAt as unknown as string) }));
}

/* ── TempleOSRS snapshots ─────────────────────────────────────────────── */

/** The board's TempleOSRS baseline snapshots. */
export const getTempleSnapshots = unstable_cache(
  async (boardId: string) =>
    prisma.templeSnapshot.findMany({
      where: { boardId },
      select: { rsn: true, stats: true, collectionFinished: true },
    }),
  ["bingo-temple-snapshots"],
  { tags: [TAG], revalidate: PAGE_CACHE_SECONDS }
);

/**
 * ensureTempleSnapshotTaken does DB writes and reads on every call; through
 * the cache it runs at most once a minute instead of on every page view.
 */
const snapshotCheck = unstable_cache(
  async (boardId: string, startsAtIso: string | null) => {
    await ensureTempleSnapshotTaken(boardId, startsAtIso ? new Date(startsAtIso) : null);
    return true;
  },
  ["bingo-temple-snapshot-check"],
  { tags: [TAG], revalidate: 60 }
);

export async function ensureTempleSnapshotThrottled(boardId: string, startsAt: Date | null): Promise<void> {
  await snapshotCheck(boardId, startsAt?.toISOString() ?? null);
}

/* ── Pre-start gate ───────────────────────────────────────────────────── */

const loadGateBoard = unstable_cache(
  async () => {
    const board = await prisma.bingoBoard.findFirst({
      where: { active: true },
      select: { name: true, description: true, startsAt: true },
    });
    return board ? { ...board, startsAt: board.startsAt?.toISOString() ?? null } : null;
  },
  ["bingo-gate-board"],
  { tags: [TAG], revalidate: PAGE_CACHE_SECONDS }
);

/** The active board if it hasn't started yet (checked against the current time per call). */
export async function getUpcomingBoard() {
  const board = await loadGateBoard();
  const startsAt = toDate(board?.startsAt ?? null);
  return board && startsAt && startsAt > new Date() ? { ...board, startsAt } : null;
}
