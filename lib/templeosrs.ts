/**
 * TempleOSRS integration — skills, bosses, clues and collection log per player.
 *
 * Uses TempleOSRS's public per-player endpoints (no group/API key needed).
 * TempleOSRS returns HTTP 200 with an `error` field for untracked names or
 * bad requests, so that's treated the same as a network failure — callers
 * just don't get data for that player/section.
 *
 * Skills and bosses are parsed generically off the flat player_stats.php
 * payload (any `X` + `X_level` pair is a skill, any `X` + `X_ehb` pair is a
 * boss) rather than hardcoding TempleOSRS's skill/boss name list, so this
 * keeps working as they add new content.
 */

import { prisma } from "@/lib/prisma";

const USER_AGENT = "OSRS-Bingo-App/1.0";

export interface SkillStat {
  xp: number;
  level: number;
  rank: number;
  ehp: number;
}

export interface BossStat {
  kc: number;
  ehb: number;
}

export interface ClueStats {
  all: number;
  beginner: number;
  easy: number;
  medium: number;
  hard: number;
  elite: number;
  master: number;
}

export interface CollectionLogStats {
  finished: number;
  available: number;
  categoriesFinished: number;
  categoriesAvailable: number;
  ehc: number;
  rank: number;
}

export interface TempleStats {
  ehp: number;
  ehb: number;
  skills: Record<string, SkillStat>;
  bosses: Record<string, BossStat>;
  clues: ClueStats;
}

async function templeFetch(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error || !json.data) return null;
    return json.data as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function fetchTempleStats(rsn: string): Promise<TempleStats | null> {
  const url = `https://templeosrs.com/api/player_stats.php?player=${encodeURIComponent(rsn)}&bosses=1`;
  const data = await templeFetch(url);
  if (!data) return null;

  const skills: Record<string, SkillStat> = {};
  const bosses: Record<string, BossStat> = {};

  const NON_ACTIVITY_KEYS = new Set(["info", "date", "LMS"]);
  const EHP_VARIANT_KEYS = new Set(["Im_ehp", "Lvl3_ehp", "F2p_ehp", "Uim_ehp", "1def_ehp", "Gim_ehp"]);

  for (const key of Object.keys(data)) {
    if (NON_ACTIVITY_KEYS.has(key) || EHP_VARIANT_KEYS.has(key)) continue;
    if (key.startsWith("Clue_") || key.startsWith("Ehp") || key.startsWith("Ehb")) continue;
    // suffix fields (e.g. "Attack_level", "Zulrah_ehb") are consumed via their base key below
    if (/_(level|rank|ehp|ehb)$/.test(key)) continue;

    if (`${key}_level` in data) {
      skills[key] = {
        xp: Number(data[key]) || 0,
        level: Number(data[`${key}_level`]) || 0,
        rank: Number(data[`${key}_rank`]) || -1,
        ehp: Number(data[`${key}_ehp`]) || 0,
      };
    } else {
      // boss/minigame activity — not all of these have a published EHB rate
      bosses[key] = {
        kc: Number(data[key]) || 0,
        ehb: Number(data[`${key}_ehb`]) || 0,
      };
    }
  }

  return {
    ehp: Number(data.Ehp) || 0,
    ehb: Number(data.Ehb) || 0,
    skills,
    bosses,
    clues: {
      all: Number(data.Clue_all) || 0,
      beginner: Number(data.Clue_beginner) || 0,
      easy: Number(data.Clue_easy) || 0,
      medium: Number(data.Clue_medium) || 0,
      hard: Number(data.Clue_hard) || 0,
      elite: Number(data.Clue_elite) || 0,
      master: Number(data.Clue_master) || 0,
    },
  };
}

export async function fetchCollectionLogStats(rsn: string): Promise<CollectionLogStats | null> {
  const url = `https://templeosrs.com/api/collection-log/player_collection_log.php?player=${encodeURIComponent(rsn)}`;
  const data = await templeFetch(url);
  if (!data) return null;

  return {
    finished: Number(data.total_collections_finished) || 0,
    available: Number(data.total_collections_available) || 0,
    categoriesFinished: Number(data.total_categories_finished) || 0,
    categoriesAvailable: Number(data.total_categories_available) || 0,
    ehc: Number(data.ehc) || 0,
    rank: Number(data.collections_hiscores_rank) || -1,
  };
}

export interface TeamStats {
  ehb: number;
  ehp: number;
  overallXp: number;
  clues: ClueStats;
  bosses: Record<string, number>;
  collectionFinished: number;
  trackedCount: number;
  totalCount: number;
}

export interface TempleSnapshotEntry {
  stats: TempleStats;
  collectionFinished: number;
}

const clamp0 = (n: number) => (n > 0 ? n : 0);

/**
 * Subtracts a baseline snapshot from a player's current stats to get
 * "gained since the event started." Level/rank are kept as current values
 * (a level isn't meaningfully "gained"); everything else becomes a delta,
 * clamped to 0 in case TempleOSRS's crawl was briefly stale at baseline time.
 */
export function diffTempleStats(current: TempleStats, baseline: TempleStats | null): TempleStats {
  if (!baseline) return current;

  const skills: Record<string, SkillStat> = {};
  for (const [name, cur] of Object.entries(current.skills)) {
    const base = baseline.skills[name];
    skills[name] = {
      xp: clamp0(cur.xp - (base?.xp ?? 0)),
      level: cur.level,
      rank: cur.rank,
      ehp: clamp0(cur.ehp - (base?.ehp ?? 0)),
    };
  }

  const bosses: Record<string, BossStat> = {};
  for (const [name, cur] of Object.entries(current.bosses)) {
    const base = baseline.bosses[name];
    bosses[name] = {
      kc: clamp0(cur.kc - (base?.kc ?? 0)),
      ehb: clamp0(cur.ehb - (base?.ehb ?? 0)),
    };
  }

  return {
    ehp: clamp0(current.ehp - baseline.ehp),
    ehb: clamp0(current.ehb - baseline.ehb),
    skills,
    bosses,
    clues: {
      all: clamp0(current.clues.all - baseline.clues.all),
      beginner: clamp0(current.clues.beginner - baseline.clues.beginner),
      easy: clamp0(current.clues.easy - baseline.clues.easy),
      medium: clamp0(current.clues.medium - baseline.clues.medium),
      hard: clamp0(current.clues.hard - baseline.clues.hard),
      elite: clamp0(current.clues.elite - baseline.clues.elite),
      master: clamp0(current.clues.master - baseline.clues.master),
    },
  };
}

/**
 * Takes a one-time TempleOSRS baseline snapshot of every participant, so
 * stats can be shown as "gained since the event started" instead of lifetime
 * totals. Safe to call on every page load that shows Temple stats — it's a
 * no-op unless the board has actually started and no snapshot exists yet.
 * The atomic conditional update means only one concurrent caller actually
 * does the work; the rest see count 0 and return immediately.
 */
export async function ensureTempleSnapshotTaken(boardId: string, startsAt: Date | null): Promise<void> {
  if (!startsAt || startsAt > new Date()) return;

  const claimed = await prisma.bingoBoard.updateMany({
    where: { id: boardId, templeSnapshotTakenAt: null },
    data: { templeSnapshotTakenAt: new Date() },
  });
  if (claimed.count === 0) return;

  const participants = await prisma.participant.findMany({ select: { rsn: true } });
  await Promise.all(
    participants.map(async (p) => {
      const [stats, clog] = await Promise.all([fetchTempleStats(p.rsn), fetchCollectionLogStats(p.rsn)]);
      if (!stats) return;
      await prisma.templeSnapshot.upsert({
        where: { boardId_rsn: { boardId, rsn: p.rsn } },
        create: { boardId, rsn: p.rsn, stats: JSON.parse(JSON.stringify(stats)), collectionFinished: clog?.finished ?? 0 },
        update: { stats: JSON.parse(JSON.stringify(stats)), collectionFinished: clog?.finished ?? 0 },
      });
    })
  );
}

/** Sums each participant's TempleOSRS stats into team-wide totals, diffed
 * against their baseline snapshot when one exists for this board. */
export async function fetchTeamStats(rsns: string[], snapshotsByRsn?: Map<string, TempleSnapshotEntry>): Promise<TeamStats> {
  const [statsList, clogList] = await Promise.all([
    Promise.all(rsns.map((rsn) => fetchTempleStats(rsn))),
    Promise.all(rsns.map((rsn) => fetchCollectionLogStats(rsn))),
  ]);

  const totals: TeamStats = {
    ehb: 0,
    ehp: 0,
    overallXp: 0,
    clues: { all: 0, beginner: 0, easy: 0, medium: 0, hard: 0, elite: 0, master: 0 },
    bosses: {},
    collectionFinished: 0,
    trackedCount: statsList.filter((s) => s !== null).length,
    totalCount: rsns.length,
  };

  statsList.forEach((raw, i) => {
    if (!raw) return;
    const snapshot = snapshotsByRsn?.get(rsns[i]);
    const s = snapshot ? diffTempleStats(raw, snapshot.stats) : raw;
    totals.ehb += s.ehb;
    totals.ehp += s.ehp;
    totals.overallXp += s.skills.Overall?.xp ?? 0;
    for (const key of Object.keys(totals.clues) as (keyof ClueStats)[]) {
      totals.clues[key] += s.clues[key];
    }
    for (const [boss, stat] of Object.entries(s.bosses)) {
      if (stat.kc <= 0) continue;
      totals.bosses[boss] = (totals.bosses[boss] ?? 0) + stat.kc;
    }
  });

  clogList.forEach((c, i) => {
    if (!c) return;
    const snapshot = snapshotsByRsn?.get(rsns[i]);
    totals.collectionFinished += snapshot ? clamp0(c.finished - snapshot.collectionFinished) : c.finished;
  });

  return totals;
}
