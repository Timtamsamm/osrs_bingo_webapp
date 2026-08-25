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

/** Sums each participant's TempleOSRS stats into team-wide totals. */
export async function fetchTeamStats(rsns: string[]): Promise<TeamStats> {
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

  for (const s of statsList) {
    if (!s) continue;
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
  }

  for (const c of clogList) {
    if (c) totals.collectionFinished += c.finished;
  }

  return totals;
}
