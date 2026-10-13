/**
 * TempleOSRS "Stats gained" for clan events — XP, EHP, EHB and boss KC gained
 * by each participant during the event.
 *
 * - Baseline: taken when a player is first recorded in the event (their first
 *   kill/drop). Event participants aren't known before then, and snapshotting
 *   the whole clan at the start time would mean hundreds of TempleOSRS calls.
 * - TempleOSRS only refreshes a player when asked, so every kill/drop also
 *   asks it to update that player (throttled), keeping the gains moving.
 * - Final: once the event is over (plus a grace period for players to log out
 *   — the hiscores update on logout), the latest TempleOSRS datapoint from
 *   before that cut-off is read from the player's history. Using history means
 *   the result is the same no matter how late the page is first viewed.
 *
 * Gains come from the hiscores, so they lag until a player logs out or hops.
 */

import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeRsn } from "@/lib/scoring";
import { diffTempleStats, fetchTempleStats, fetchTempleStatsFresh, type TempleStats } from "@/lib/templeosrs";
import type { Prisma } from "@prisma/client";

const USER_AGENT = "OSRS-Bingo-App/1.0";
const UPDATE_THROTTLE_MS = 15 * 60 * 1000;
export const FINAL_GRACE_MS = 30 * 60 * 1000;

async function requestTempleUpdate(rsn: string): Promise<void> {
  try {
    await fetch(`https://templeosrs.com/php/add_datapoint.php?player=${encodeURIComponent(rsn)}`, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // Best effort — the next kill or page view tries again.
  }
}

/**
 * Called whenever a player is recorded in a live event. Runs after the
 * response is sent, so Dink's webhook call never waits on TempleOSRS.
 */
export function trackEventStats(eventId: string, rsn: string): void {
  after(() => refreshPlayer(eventId, rsn).catch((e) => console.error("eventStats: refresh failed", e)));
}

async function refreshPlayer(eventId: string, rsn: string): Promise<void> {
  const rsnKey = normalizeRsn(rsn);
  const snap = await prisma.clanEventStatSnapshot.upsert({
    where: { eventId_rsnKey: { eventId, rsnKey } },
    create: { eventId, rsn: rsn.trim(), rsnKey },
    update: {},
  }).catch(() => prisma.clanEventStatSnapshot.findUnique({ where: { eventId_rsnKey: { eventId, rsnKey } } }));
  if (!snap) return;

  // Claim the update slot atomically — several kills can arrive at once.
  const now = new Date();
  const claimed = await prisma.clanEventStatSnapshot.updateMany({
    where: {
      id: snap.id,
      OR: [{ updateRequestedAt: null }, { updateRequestedAt: { lt: new Date(now.getTime() - UPDATE_THROTTLE_MS) } }],
    },
    data: { updateRequestedAt: now },
  });
  if (!claimed.count) return;

  await requestTempleUpdate(rsn);
  if (snap.baseline != null) return;

  const stats = await fetchTempleStatsFresh(rsn);
  await prisma.clanEventStatSnapshot.update({
    where: { id: snap.id },
    // No answer from TempleOSRS: clear the throttle so the next kill retries.
    data: stats ? { baseline: stats as unknown as Prisma.InputJsonValue, baselineAt: now } : { updateRequestedAt: null },
  });
}

/* ── Final stats from TempleOSRS history ───────────────────────────────── */

type Datapoints = Record<string, Record<string, number>>;

async function fetchDatapoints(rsn: string, secondsBack: number, bosses: boolean): Promise<Datapoints | null> {
  try {
    const url = `https://templeosrs.com/api/player_datapoints.php?player=${encodeURIComponent(rsn)}&time=${secondsBack}${bosses ? "&bosses=1" : ""}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json.error || !json.data ? null : (json.data as Datapoints);
  } catch {
    return null;
  }
}

/** Latest datapoint at or before `cutoff`. TempleOSRS timestamps are UTC "YYYY-MM-DD HH:MM:SS". */
function latestBefore(points: Datapoints, cutoff: Date): { at: Date; values: Record<string, number> } | null {
  let best: { at: Date; values: Record<string, number> } | null = null;
  for (const [stamp, values] of Object.entries(points)) {
    const at = new Date(stamp.replace(" ", "T") + "Z");
    if (isNaN(at.getTime()) || at > cutoff) continue;
    if (!best || at > best.at) best = { at, values };
  }
  return best;
}

const NOT_SKILLS = new Set(["Ehp", "im_ehp", "f2p_ehp", "lvl3_ehp", "uim_ehp", "1def_ehp"]);

/**
 * A player's stats as of `cutoff`, rebuilt from TempleOSRS history into the
 * same shape as a live snapshot (only the fields gains are computed from).
 */
async function fetchStatsAsOf(rsn: string, cutoff: Date, since: Date): Promise<{ at: Date; stats: TempleStats } | null> {
  // Window from a day before the baseline up to now.
  const secondsBack = Math.ceil((Date.now() - since.getTime()) / 1000) + 86_400;
  const [skillPoints, bossPoints] = await Promise.all([fetchDatapoints(rsn, secondsBack, false), fetchDatapoints(rsn, secondsBack, true)]);
  if (!skillPoints || !bossPoints) return null;
  const sk = latestBefore(skillPoints, cutoff);
  const bo = latestBefore(bossPoints, cutoff);
  if (!sk || !bo) return null;

  const skills: TempleStats["skills"] = {};
  for (const [name, xp] of Object.entries(sk.values)) {
    if (!NOT_SKILLS.has(name)) skills[name] = { xp: Number(xp) || 0, level: 0, rank: -1, ehp: 0 };
  }
  const bosses: TempleStats["bosses"] = {};
  for (const [name, kc] of Object.entries(bo.values)) {
    if (name.startsWith("Clue_") || name.startsWith("Ehb") || name === "LMS") continue;
    bosses[name] = { kc: Number(kc) || 0, ehb: 0 };
  }
  const v = bo.values;
  return {
    at: sk.at > bo.at ? sk.at : bo.at,
    stats: {
      ehp: Number(sk.values.Ehp) || 0,
      ehb: Number(v.Ehb) || 0,
      skills,
      bosses,
      clues: {
        all: Number(v.Clue_all) || 0,
        beginner: Number(v.Clue_beginner) || 0,
        easy: Number(v.Clue_easy) || 0,
        medium: Number(v.Clue_medium) || 0,
        hard: Number(v.Clue_hard) || 0,
        elite: Number(v.Clue_elite) || 0,
        master: Number(v.Clue_master) || 0,
      },
    },
  };
}

/**
 * Locks in final stats for an event that's past its end + grace period.
 * Call from the event page; runs after the response.
 */
export function finalizeEventStats(event: { id: string; endsAt: Date }): void {
  const cutoff = new Date(event.endsAt.getTime() + FINAL_GRACE_MS);
  if (Date.now() < cutoff.getTime()) return;
  after(async () => {
    const pending = await prisma.clanEventStatSnapshot.findMany({
      where: { eventId: event.id, finalAt: null, baselineAt: { not: null } },
    });
    for (const snap of pending) {
      const asOf = await fetchStatsAsOf(snap.rsn, cutoff, snap.baselineAt!);
      if (!asOf) continue; // TempleOSRS didn't answer — retried on the next view
      // If TempleOSRS has nothing newer than the baseline, no gains were recorded.
      const final = asOf.at >= snap.baselineAt! ? asOf.stats : (snap.baseline as unknown as TempleStats);
      await prisma.clanEventStatSnapshot.update({
        where: { id: snap.id },
        data: { final: final as unknown as Prisma.InputJsonValue, finalAt: new Date() },
      });
    }
  });
}

/* ── Gains for display ─────────────────────────────────────────────────── */

export type PlayerGains = {
  rsnKey: string;
  xp: number;
  ehp: number;
  ehb: number;
  skills: Array<{ name: string; xp: number }>;
  bosses: Array<{ name: string; kc: number }>;
};

/**
 * Gains per player: final − baseline once locked in, otherwise current
 * (TempleOSRS, cached a few minutes) − baseline. Players without a baseline
 * are left out.
 */
export async function eventGains(eventId: string): Promise<{ players: PlayerGains[]; final: boolean }> {
  const snaps = await prisma.clanEventStatSnapshot.findMany({ where: { eventId, baselineAt: { not: null } } });
  const players = await Promise.all(
    snaps.map(async (s): Promise<PlayerGains | null> => {
      const baseline = s.baseline as unknown as TempleStats;
      const latest = (s.final as unknown as TempleStats | null) ?? (await fetchTempleStats(s.rsn));
      if (!latest) return null;
      const d = diffTempleStats(latest, baseline);
      return {
        rsnKey: s.rsnKey,
        xp: d.skills.Overall?.xp ?? 0,
        ehp: d.ehp,
        ehb: d.ehb,
        skills: Object.entries(d.skills)
          .filter(([name, v]) => name !== "Overall" && v.xp > 0)
          .map(([name, v]) => ({ name, xp: v.xp }))
          .sort((a, b) => b.xp - a.xp),
        bosses: Object.entries(d.bosses)
          .filter(([, v]) => v.kc > 0)
          .map(([name, v]) => ({ name, kc: v.kc }))
          .sort((a, b) => b.kc - a.kc),
      };
    })
  );
  return {
    players: players.filter((p): p is PlayerGains => p != null),
    final: snaps.length > 0 && snaps.every((s) => s.finalAt != null),
  };
}
