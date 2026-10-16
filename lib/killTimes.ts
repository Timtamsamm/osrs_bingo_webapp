/**
 * Kill/raid completion times for the events "Fastest kills" section. Pure
 * helpers — no DB access — so they're easy to test.
 *
 * Times arrive two ways:
 * - a game line the chat notifier forwards ("Fight duration: 1:23.40 (new
 *   personal best).", "...Duration: 46:31.80 Personal best: 40:24.60",
 *   "...Theatre of Blood completion time: 25:00.00"), stored as a TIME row and
 *   matched to the same player's nearest kill when the page is built — the
 *   line never names the boss, and it can reach us before or after the kill.
 * - Dink's own KILL_COUNT notification (extra.time), stored on the KILL row.
 */

// "1:23.40", "46:31.80", "1:00:56.50", "0:56"
const TIME_TEXT = "(\\d+(?::\\d{2}){1,2}(?:\\.\\d+)?)";
// Raids print a wave/room duration before the overall time, and phased bosses
// print per-phase splits ("Nightmare P3 boss complete! Duration: 3:15.60
// Total: 12:42.00") — prefer the overall/cumulative time over the phase one.
const COMPLETION_TIME = new RegExp(`completion time:? ${TIME_TEXT}`, "i");
const TOTAL = new RegExp(`total:? ${TIME_TEXT}`, "i");
const DURATION = new RegExp(`(?:duration|subdued in):? ${TIME_TEXT}`, "i");

export function parseTimeText(text: string): number | null {
  const parts = text.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const seconds = parseFloat(parts.pop()!);
  const minutes = parseInt(parts.pop()!, 10);
  const hours = parts.length ? parseInt(parts.pop()!, 10) : 0;
  if ([seconds, minutes, hours].some((n) => !Number.isFinite(n))) return null;
  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
}

export function parseTimeLine(message: string): { ms: number; isPb: boolean } | null {
  const m = COMPLETION_TIME.exec(message) ?? TOTAL.exec(message) ?? DURATION.exec(message);
  if (!m) return null;
  const ms = parseTimeText(m[1]);
  if (ms == null || ms <= 0) return null;
  return { ms, isPb: /\(new personal best\)/i.test(message) };
}

/** Dink's KILL_COUNT `extra.time` is an ISO-8601 duration, e.g. "PT46M34.2S". */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const ms = Math.round(((+(m[1] ?? 0) * 60 + +(m[2] ?? 0)) * 60 + +(m[3] ?? 0)) * 1000);
  return ms > 0 ? ms : null;
}

export function formatDuration(ms: number): string {
  const totalCs = Math.round(ms / 10);
  const cs = totalCs % 100;
  const totalS = Math.floor(totalCs / 100);
  const s = totalS % 60;
  const totalM = Math.floor(totalS / 60);
  const m = totalM % 60;
  const h = Math.floor(totalM / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h ? `${h}:${pad(m)}` : m}:${pad(s)}.${pad(cs)}`;
}

// A time line and its kill line arrive within a few game ticks of each other.
const PAIR_WINDOW_MS = 20_000;
// Teammates' reports of one raid can differ by a tick of rounding.
const SAME_RUN_TOLERANCE_MS = 50;
// In a group kill every player's game prints its own "Your X kill count is"
// line, so each player's Dink reports the kill — all within a second or two.
// Separate kills of the same boss are minutes apart.
const GROUP_KILL_WINDOW_MS = 15_000;

/**
 * Groups kill rows into actual kills: reports of the same boss within
 * GROUP_KILL_WINDOW_MS of a group's first report are one group kill.
 * Returns a group id per row.
 */
export function groupKillIds<T extends { source: string | null; createdAt: Date }>(kills: T[]): Map<T, number> {
  const byBoss = new Map<string, T[]>();
  for (const k of kills) {
    const key = (k.source ?? "").trim().toLowerCase();
    const list = byBoss.get(key) ?? [];
    list.push(k);
    byBoss.set(key, list);
  }
  const ids = new Map<T, number>();
  let next = 0;
  for (const list of byBoss.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let groupStart = -Infinity;
    let id = -1;
    for (const k of list) {
      const t = k.createdAt.getTime();
      if (t - groupStart > GROUP_KILL_WINDOW_MS) {
        groupStart = t;
        id = next++;
      }
      ids.set(k, id);
    }
  }
  return ids;
}


type KillRow = {
  rsn: string;
  rsnKey: string;
  source: string | null;
  killCount: number | null;
  durationMs: number | null;
  isPb: boolean;
  party: unknown;
  createdAt: Date;
};
type TimeRow = { rsnKey: string; durationMs: number | null; isPb: boolean; createdAt: Date };

export type FastestKill = {
  boss: string;
  ms: number;
  isPb: boolean;
  /** Everyone credited with this time — the reporter plus raid teammates. */
  players: string[];
  killCount: number | null;
};

export type BossTimes = {
  boss: string;
  /** Fastest first; each player appears once, with their best time. */
  times: FastestKill[];
};

/**
 * Kill times per boss, for the Fastest kills section. Each kill takes its own
 * time (from Dink) or the same player's closest TIME row within the pairing
 * window. Raid teammates share the team's time, and several teammates
 * reporting the same run are merged into one entry with all their names.
 * Ranked fastest first, keeping only each player's best run.
 */
export function killTimesByBoss(
  kills: KillRow[],
  times: TimeRow[],
  displayName: (rsn: string) => string | null,
  /** Group event: every player's report of one kill is the same run. */
  mergeGroupKills = false
): BossTimes[] {
  const timesByPlayer = new Map<string, TimeRow[]>();
  for (const t of times) {
    if (t.durationMs == null) continue;
    const list = timesByPlayer.get(t.rsnKey) ?? [];
    list.push(t);
    timesByPlayer.set(t.rsnKey, list);
  }

  const groupOf = mergeGroupKills ? groupKillIds(kills) : new Map<KillRow, number>();
  const runGroup = new Map<FastestKill, number>();
  const runsByBoss = new Map<string, FastestKill[]>();
  for (const k of kills) {
    if (!k.source) continue;
    let ms = k.durationMs;
    let isPb = k.isPb;
    if (ms == null) {
      let closest: TimeRow | null = null;
      for (const t of timesByPlayer.get(k.rsnKey) ?? []) {
        const gap = Math.abs(t.createdAt.getTime() - k.createdAt.getTime());
        if (gap <= PAIR_WINDOW_MS && (!closest || gap < Math.abs(closest.createdAt.getTime() - k.createdAt.getTime()))) closest = t;
      }
      if (!closest) continue;
      ms = closest.durationMs!;
      isPb = closest.isPb;
    }

    const team = [k.rsn, ...(Array.isArray(k.party) ? (k.party as unknown[]).filter((p): p is string => typeof p === "string") : [])]
      .map(displayName)
      .filter((n): n is string => n != null);
    if (!team.length) continue;

    const key = k.source.trim().toLowerCase();
    const runs = runsByBoss.get(key) ?? [];
    // Same run reported by another player in the group (same group kill, or
    // an identical time) — merge the names. Players' reported times for one
    // group kill can differ by a tick, so keep the fastest.
    const group = groupOf.get(k);
    const sameRun = runs.find((r) => runGroup.get(r) === group || Math.abs(r.ms - ms!) <= SAME_RUN_TOLERANCE_MS);
    if (sameRun) {
      for (const name of team) if (!sameRun.players.includes(name)) sameRun.players.push(name);
      sameRun.isPb ||= isPb;
      sameRun.ms = Math.min(sameRun.ms, ms);
    } else {
      const run = { boss: k.source, ms, isPb, players: team, killCount: k.killCount };
      runs.push(run);
      if (group != null) runGroup.set(run, group);
    }
    runsByBoss.set(key, runs);
  }

  const result: BossTimes[] = [];
  for (const runs of runsByBoss.values()) {
    runs.sort((a, b) => a.ms - b.ms);
    const seen = new Set<string>();
    const ranked: FastestKill[] = [];
    for (const run of runs) {
      // Keep a run only if someone in it hasn't already got a faster one.
      if (run.players.every((p) => seen.has(p))) continue;
      run.players.forEach((p) => seen.add(p));
      ranked.push(run);
    }
    result.push({ boss: ranked[0].boss, times: ranked });
  }
  return result.sort((a, b) => a.boss.localeCompare(b.boss));
}
