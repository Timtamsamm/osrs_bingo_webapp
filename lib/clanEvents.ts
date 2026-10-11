import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings, updateSettings } from "@/lib/settings";
import { normalizeRsn } from "@/lib/scoring";
import { fetchGroupMembers, type WomMember } from "@/lib/wiseoldman";

export type AttendanceVia = "join" | "kill" | "loot" | "party" | "manual";

export const VIA_LABELS: Record<string, string> = {
  join: "Checked in",
  kill: "Kill",
  loot: "Drop",
  party: "Raid party",
  manual: "Added by admin",
};

export function generateEventsToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Returns the events webhook token, creating one the first time it's needed. */
export async function ensureEventsToken(): Promise<string> {
  const settings = await getSettings();
  if (settings?.eventsWebhookToken) return settings.eventsWebhookToken;
  const token = generateEventsToken();
  await updateSettings({ eventsWebhookToken: token });
  return token;
}

/**
 * Whether a boss/NPC name passes an event's boss filter. The filter is a
 * comma-separated list matched case-insensitively as a substring, so
 * "Chambers of Xeric" also catches "Chambers of Xeric Challenge Mode".
 * A leading "The" is ignored on both sides.
 * No filter means every source counts.
 */
export function matchesBossFilter(filter: string | null, source: string | null | undefined): boolean {
  const terms = (filter ?? "").split(",").map(bossKey).filter(Boolean);
  if (!terms.length) return true;
  if (!source) return false;
  const s = bossKey(source);
  return terms.some((t) => s.includes(t));
}

// Boss names in the picker come from the Boss Items database ("The
// Nightmare", "The Gauntlet"), but Dink often reports them without the
// article ("Nightmare", "Gauntlet"), so ignore a leading "the" on both sides.
function bossKey(name: string): string {
  return name.trim().toLowerCase().replace(/^the\s+/, "");
}

/**
 * Records a player as attending (or bumps lastSeenAt if they already are).
 * Several clan members' Dink clients report the same "!join" message at
 * once, so concurrent creates for the same player are expected — the losing
 * insert hits the unique constraint and falls back to an update.
 */
export async function recordAttendance(eventId: string, rsn: string, via: AttendanceVia, at = new Date()): Promise<void> {
  const rsnKey = normalizeRsn(rsn);
  if (!rsnKey) return;
  try {
    await prisma.clanEventAttendee.upsert({
      where: { eventId_rsnKey: { eventId, rsnKey } },
      create: { eventId, rsn: rsn.trim(), rsnKey, via, firstSeenAt: at, lastSeenAt: at },
      update: { lastSeenAt: at },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      await prisma.clanEventAttendee.update({
        where: { eventId_rsnKey: { eventId, rsnKey } },
        data: { lastSeenAt: at },
      });
      return;
    }
    throw e;
  }
}

/**
 * RSN key for matching against the Wise Old Man roster. OSRS treats "-",
 * "_" and " " as interchangeable in names, and WOM's own usernames fold
 * them all to spaces, so fold hyphens too on top of normalizeRsn.
 */
function rosterKey(rsn: string): string {
  return normalizeRsn(rsn).replace(/-/g, " ");
}

export type ClanRoster = { size: number; byKey: Map<string, WomMember> };

/**
 * The clan's WOM group, keyed by both current display name and WOM
 * username. Null when WOM is unreachable — callers then treat everyone as a
 * member rather than hiding the whole attendance list as "guests".
 */
export async function getClanRoster(): Promise<ClanRoster | null> {
  const members = await fetchGroupMembers();
  if (!members.length) return null;
  const byKey = new Map<string, WomMember>();
  for (const m of members) {
    byKey.set(rosterKey(m.displayName), m);
    byKey.set(rosterKey(m.username), m);
  }
  return { size: members.length, byKey };
}

export function findClanMember(roster: ClanRoster | null, rsn: string): WomMember | null {
  return roster?.byKey.get(rosterKey(rsn)) ?? null;
}

/** Splits attendees into clan members (with their WOM entry) and guests. */
export function splitByRoster<T extends { rsn: string }>(
  attendees: T[],
  roster: ClanRoster | null
): { members: Array<T & { clan: WomMember | null }>; guests: T[] } {
  if (!roster) return { members: attendees.map((a) => ({ ...a, clan: null })), guests: [] };
  const members: Array<T & { clan: WomMember | null }> = [];
  const guests: T[] = [];
  for (const a of attendees) {
    const clan = findClanMember(roster, a.rsn);
    if (clan) members.push({ ...a, clan });
    else guests.push(a);
  }
  return { members, guests };
}

/** "wily" → "Wily", "deputy_owner" → "Deputy owner" */
export function formatClanRole(role: string): string {
  const s = role.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatGp(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}b`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString();
}

export type EventStatus = "upcoming" | "live" | "ended";

export function eventStatus(event: { startsAt: Date; endsAt: Date }, now = new Date()): EventStatus {
  if (now < event.startsAt) return "upcoming";
  if (now > event.endsAt) return "ended";
  return "live";
}
