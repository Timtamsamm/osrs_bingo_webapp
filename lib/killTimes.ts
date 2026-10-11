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
// Raids print a wave/room duration before the overall time — prefer the overall one.
const COMPLETION_TIME = new RegExp(`completion time:? ${TIME_TEXT}`, "i");
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
  const m = COMPLETION_TIME.exec(message) ?? DURATION.exec(message);
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

/**
 * The fastest time per boss. Each kill takes its own time (from Dink) or the
 * same player's closest TIME row within the pairing window. Raid teammates
 * share the team's time, and several teammates reporting the same run are
 * merged into one entry with all their names.
 */
export function fastestKills(
  kills: KillRow[],
  times: TimeRow[],
  displayName: (rsn: string) => string | null
): FastestKill[] {
  const timesByPlayer = new Map<string, TimeRow[]>();
  for (const t of times) {
    if (t.durationMs == null) continue;
    const list = timesByPlayer.get(t.rsnKey) ?? [];
    list.push(t);
    timesByPlayer.set(t.rsnKey, list);
  }

  const best = new Map<string, FastestKill>();
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
    const current = best.get(key);
    if (!current || ms < current.ms - SAME_RUN_TOLERANCE_MS) {
      best.set(key, { boss: k.source, ms, isPb, players: team, killCount: k.killCount });
    } else if (Math.abs(ms - current.ms) <= SAME_RUN_TOLERANCE_MS) {
      // Same run reported by another teammate — merge the names.
      for (const name of team) if (!current.players.includes(name)) current.players.push(name);
      current.isPb ||= isPb;
    }
  }
  return [...best.values()].sort((a, b) => a.boss.localeCompare(b.boss));
}
