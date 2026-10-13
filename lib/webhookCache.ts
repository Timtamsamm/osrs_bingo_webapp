/**
 * Cached answers to "is this webhook token valid?" and "is anything live?"
 * for the Dink webhooks and the bingo Dynamic Config URL.
 *
 * Every player with the Dink setup sends notifications all day, events or
 * not. Without this, each one queried the database just to be rejected —
 * which kept Neon's compute awake around the clock (Neon bills compute while
 * awake and suspends the database once the Free plan's monthly hours run
 * out). With it, traffic outside a live event/bingo never touches the DB.
 *
 * The cache is cleared immediately (invalidate…) whenever an admin changes
 * something it holds; the daily revalidate is only a safety net. Live-ness is
 * computed per request from the cached start/end times, so events starting
 * or ending need no refresh.
 */

import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { inGridTiles } from "@/lib/scoring";

const EVENTS_TAG = "events-webhook";
const BINGO_TAG = "bingo-webhook";
const SAFETY_REVALIDATE_SECONDS = 86_400;

type TierDef = { dinkItems: Array<{ id: number; name: string }> };
type PointsConfig = { items: Array<{ id: number; name: string }> };

export type CachedEvent = { id: string; bossFilter: string | null; startsAt: string; endsAt: string };

/** Events webhook token + every event that hadn't ended when cached. */
export const getEventsWebhookState = unstable_cache(
  async (): Promise<{ token: string | null; events: CachedEvent[] }> => {
    const [settings, events] = await Promise.all([
      getSettings(),
      prisma.clanEvent.findMany({
        where: { endsAt: { gte: new Date() } },
        select: { id: true, bossFilter: true, startsAt: true, endsAt: true },
      }),
    ]);
    return {
      token: settings?.eventsWebhookToken ?? null,
      events: events.map((e) => ({ ...e, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString() })),
    };
  },
  ["events-webhook-state"],
  { tags: [EVENTS_TAG], revalidate: SAFETY_REVALIDATE_SECONDS }
);

export function liveEventsAt(events: CachedEvent[], now: Date): Array<{ id: string; bossFilter: string | null }> {
  const t = now.getTime();
  return events
    .filter((e) => Date.parse(e.startsAt) <= t && Date.parse(e.endsAt) >= t)
    .map(({ id, bossFilter }) => ({ id, bossFilter }));
}

/**
 * The active bingo board's Dink token, window and the item names its tiles
 * track (for the Dynamic Config URL's loot allowlist). Null = no active board.
 */
export const getBingoWebhookState = unstable_cache(
  async (): Promise<{ token: string | null; startsAt: string | null; endsAt: string | null; itemNames: string[] } | null> => {
    const board = await prisma.bingoBoard.findFirst({
      where: { active: true },
      select: {
        dinkToken: true,
        startsAt: true,
        endsAt: true,
        size: true,
        tiles: { select: { position: true, scoringMode: true, tiers: true, pointsConfig: true } },
      },
    });
    if (!board) return null;

    // Hidden out-of-grid tiles' items can't score — leave them out.
    const itemNames = new Set<string>();
    for (const tile of inGridTiles(board.tiles, board.size)) {
      if (tile.scoringMode === "POINTS") {
        for (const item of (tile.pointsConfig as PointsConfig | null)?.items ?? []) itemNames.add(item.name);
      } else {
        for (const tier of (tile.tiers as TierDef[]) ?? []) for (const item of tier.dinkItems) itemNames.add(item.name);
      }
    }
    return {
      token: board.dinkToken,
      startsAt: board.startsAt?.toISOString() ?? null,
      endsAt: board.endsAt?.toISOString() ?? null,
      itemNames: [...itemNames],
    };
  },
  ["bingo-webhook-state"],
  { tags: [BINGO_TAG], revalidate: SAFETY_REVALIDATE_SECONDS }
);

// { expire: 0 } = expire immediately, so the very next webhook call sees the
// change (the default stale-while-revalidate would serve the old value once).
export function invalidateEventsWebhookCache(): void {
  revalidateTag(EVENTS_TAG, { expire: 0 });
}

export function invalidateBingoWebhookCache(): void {
  revalidateTag(BINGO_TAG, { expire: 0 });
}
