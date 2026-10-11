import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { normalizeRsn } from "@/lib/scoring";
import { matchesBossFilter, recordAttendance } from "@/lib/clanEvents";
import { lookupItem } from "@/lib/osrsItems";
import type { Prisma } from "@prisma/client";

// Dink webhook for clan events — completely separate from the bingo webhook
// (/api/webhook/dink), with its own token, so handing this URL out reveals
// nothing about a bingo board.
//
// Three notification types matter:
// - CHAT, from Dink's chat notifier (players route it here with the Chat
//   Webhook Override, so their other webhooks aren't flooded):
//   - the join phrase typed in clan chat — clan chat is cross-world, so one
//     admin's Dink covers everyone; the sender is extra.source, not playerName
//   - game lines "Your X kill count is: N." — every kill, without lowering
//     Dink's global Kill Count Interval
//   - game lines "X received a drop: Item (Boss)" — drops below the player's
//     Dink Min Loot value
// - KILL_COUNT / LOOT: Dink's own notifiers, from players who've added the
//   events link. Reports of the same kill/drop arriving both ways are merged.
// All of it comes from the player's own client, so worlds and instances
// don't matter.

const CHAT_TYPES = new Set(["CLAN_CHAT", "CLAN_GUEST_CHAT", "FRIENDSCHAT"]);
// Messages typed by players — never trusted as kill/drop lines.
const PLAYER_CHAT_TYPES = new Set([
  ...CHAT_TYPES,
  "CLAN_GIM_CHAT",
  "PUBLICCHAT",
  "PRIVATECHAT",
  "PRIVATECHATOUT",
  "MODCHAT",
  "MODPRIVATECHAT",
  "AUTOTYPER",
  "MODAUTOTYPER",
]);

// "Sausage Samy received a drop: Adamant longsword (Giant Mole)." — also
// accepts "300 x Rune arrow" quantities and a "(1,234 coins)" value instead
// of a source.
const DROP_LINE = /^(.+?) received a drop: (?:([\d,]+) x )?(.+?)(?: \(([^()]+)\))?\.?$/;

type ChatDrop = { player: string; itemName: string; quantity: number; source: string | null; totalValue: number | null };

function parseDropMessage(message: string): ChatDrop | null {
  const m = DROP_LINE.exec(message.trim());
  if (!m) return null;
  const paren = m[4]?.trim() ?? null;
  const coins = paren ? /^([\d,]+) coins?$/i.exec(paren) : null;
  return {
    player: m[1].trim(),
    itemName: m[3].trim(),
    quantity: m[2] ? parseInt(m[2].replace(/,/g, ""), 10) : 1,
    source: coins ? null : paren,
    totalValue: coins ? parseInt(coins[1].replace(/,/g, ""), 10) : null,
  };
}

// How long two reports of the same item for the same player are treated as
// one drop (chat line + Dink Loot notification arrive seconds apart).
const DROP_MERGE_WINDOW_MS = 2 * 60 * 1000;

// The game's own kill count messages, e.g. "Your Giant Mole kill count is: 37."
// Same patterns Dink's KillCountNotifier uses. Players can forward these via
// Dink's chat notifier (Message Filter "Your * count is: *") to get every
// kill reported without lowering Dink's global Kill Count Interval, which
// would also flood their other webhooks.
const KC_PRIMARY = /Your (.+)\s(kill|chest|completion|harvest|success|opened|lap|Total Ticket)\s?count is: ?([\d,]+)\b/i;
const KC_SECONDARY = /Your (?:completed|subdued) (.+) count is: ([\d,]+)\b/;

function parseKillCountMessage(message: string): { boss: string; count: number } | null {
  const primary = KC_PRIMARY.exec(message);
  if (primary) {
    // Agility lap counts use the same message shape — they aren't kills.
    if (primary[2].toLowerCase() === "lap") return null;
    return { boss: primary[1].trim(), count: parseInt(primary[3].replace(/,/g, ""), 10) };
  }
  const secondary = KC_SECONDARY.exec(message);
  if (secondary) return { boss: secondary[1].trim(), count: parseInt(secondary[2].replace(/,/g, ""), 10) };
  return null;
}

const INT_MAX = 2_147_483_647;

function toInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(Math.round(value), INT_MAX);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("action") === "ping") {
    return NextResponse.json({ status: "ok", version: 1 });
  }
  return NextResponse.json({ status: "ok" });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  const settings = await getSettings();
  if (!settings?.eventsWebhookToken || token !== settings.eventsWebhookToken) {
    return NextResponse.json({ error: "bad_token" }, { status: 401 });
  }

  // Dink sends multipart (payload_json + screenshot) when an image is
  // attached, plain JSON otherwise. Only LOOT screenshots are kept.
  let payload: Record<string, unknown>;
  let imageFile: File | null = null;
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const payloadJson = form.get("payload_json");
      if (!payloadJson) return NextResponse.json({ error: "missing payload_json" }, { status: 400 });
      payload = JSON.parse(payloadJson as string);
      imageFile = form.get("file") as File | null;
    } else {
      payload = await req.json();
    }
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const type = payload.type as string | undefined;
  const playerName = payload.playerName as string | undefined;
  const extra = (payload.extra ?? {}) as Record<string, unknown>;

  if (type !== "CHAT" && type !== "KILL_COUNT" && type !== "LOOT") {
    return NextResponse.json({ status: "ignored" });
  }

  const now = new Date();
  const liveEvents = await prisma.clanEvent.findMany({
    where: { startsAt: { lte: now }, endsAt: { gte: now } },
    select: { id: true, joinPhrase: true, bossFilter: true },
  });
  if (!liveEvents.length) return NextResponse.json({ status: "no_live_event" });

  if (type === "CHAT") {
    const chatType = extra.type as string | undefined;
    const rawMessage = (extra.message as string | undefined) ?? "";

    // Lines the game/client prints (not typed by a player — otherwise anyone
    // could type "Bob received a drop: Twisted bow (Vorkath)" in clan chat).
    if (chatType && !PLAYER_CHAT_TYPES.has(chatType)) {
      const drop = parseDropMessage(rawMessage);
      if (drop) {
        const recorded = await recordChatDrop(liveEvents, drop, now);
        return NextResponse.json({ status: recorded ? "recorded" : "ignored" });
      }
      const kc = playerName ? parseKillCountMessage(rawMessage) : null;
      if (kc && playerName) {
        const recorded = await recordKill(liveEvents, playerName, kc.boss, kc.count, [], now);
        return NextResponse.json({ status: recorded ? "recorded" : "ignored" });
      }
    }

    const sender = extra.source as string | undefined;
    const message = (extra.message as string | undefined)?.trim().toLowerCase();
    if (!chatType || !CHAT_TYPES.has(chatType) || !sender || !message) {
      return NextResponse.json({ status: "ignored" });
    }
    let joined = 0;
    for (const event of liveEvents) {
      if (message === event.joinPhrase.trim().toLowerCase()) {
        await recordAttendance(event.id, sender, "join", now);
        joined++;
      }
    }
    return NextResponse.json({ status: joined ? "joined" : "ignored" });
  }

  if (!playerName) return NextResponse.json({ status: "ignored" });

  const party = Array.isArray(extra.party)
    ? (extra.party as unknown[]).filter((p): p is string => typeof p === "string" && normalizeRsn(p) !== normalizeRsn(playerName))
    : [];

  if (type === "KILL_COUNT") {
    const recorded = await recordKill(liveEvents, playerName, extra.boss as string | undefined, toInt(extra.count), party, now);
    return NextResponse.json({ status: recorded ? "recorded" : "ignored" });
  }

  // LOOT
  const source = extra.source as string | undefined;
  const items = ((extra.items as Array<Record<string, unknown>> | undefined) ?? []).filter(
    (i) => typeof i.id === "number" && typeof i.name === "string"
  );
  const matching = liveEvents.filter((e) => matchesBossFilter(e.bossFilter, source));
  if (!items.length || !matching.length) return NextResponse.json({ status: "ignored" });

  // Upload once per notification (not per event/item) — every item row from
  // this drop shares the same screenshot.
  let imageUrl: string | null = null;
  if (imageFile && imageFile.size > 0) {
    try {
      const { url } = await put(`events/${normalizeRsn(playerName).replace(/ /g, "_")}/${Date.now()}.png`, imageFile, {
        access: "public",
        addRandomSuffix: true,
      });
      imageUrl = url;
    } catch (e) {
      // A failed upload shouldn't lose the drop itself — record it without a screenshot.
      console.error("events webhook: screenshot upload failed", e);
    }
  }

  const rsnKey = normalizeRsn(playerName);
  for (const event of matching) {
    await withPlayerLock(event.id, rsnKey, async (tx) => {
      for (const item of items) {
        const data = {
          rsn: playerName,
          source: source ?? null,
          itemId: item.id as number,
          itemName: item.name as string,
          quantity: toInt(item.quantity) ?? 1,
          priceEach: toInt(item.priceEach),
          imageUrl,
          origin: "dink",
        };
        // The same drop may already be in from a forwarded chat line — Dink's
        // version is better (exact ID/price, screenshot), so upgrade that row
        // instead of adding a second one.
        const fromChat = await findRecentDrop(tx, event.id, rsnKey, data.itemName, now, "chat");
        if (fromChat) {
          await tx.clanEventActivity.update({ where: { id: fromChat.id }, data });
        } else {
          await tx.clanEventActivity.create({ data: { ...data, eventId: event.id, rsnKey, type: "LOOT", createdAt: now } });
        }
      }
    });
    await recordAttendance(event.id, playerName, "loot", now);
    for (const member of party) await recordAttendance(event.id, member, "party", now);
  }
  return NextResponse.json({ status: "recorded" });
}

/**
 * Records one kill against every live event whose boss filter it passes.
 * A kill can arrive twice — once as a KILL_COUNT notification (when the
 * player's Kill Count Interval happens to hit) and once as a forwarded KC
 * chat message — so skip it if the same player already has this kill count
 * for this boss recorded.
 */
async function recordKill(
  liveEvents: Array<{ id: string; bossFilter: string | null }>,
  playerName: string,
  boss: string | undefined,
  killCount: number | null,
  party: string[],
  now: Date
): Promise<boolean> {
  const rsnKey = normalizeRsn(playerName);
  const matching = liveEvents.filter((e) => matchesBossFilter(e.bossFilter, boss));
  for (const event of matching) {
    // Both reports of one kill arrive within moments of each other, so the
    // check-then-insert has to be serialized per player.
    const created = await withPlayerLock(event.id, rsnKey, async (tx) => {
      if (killCount != null) {
        const duplicate = await tx.clanEventActivity.findFirst({
          where: {
            eventId: event.id,
            rsnKey,
            type: "KILL",
            killCount,
            source: { equals: boss ?? "", mode: "insensitive" },
          },
          select: { id: true },
        });
        if (duplicate) return false;
      }
      await tx.clanEventActivity.create({
        data: { eventId: event.id, rsn: playerName, rsnKey, type: "KILL", source: boss ?? null, killCount, createdAt: now },
      });
      return true;
    });
    if (!created) continue;
    await recordAttendance(event.id, playerName, "kill", now);
    // Raid party members count as attending even if they don't run the
    // events webhook themselves.
    for (const member of party) await recordAttendance(event.id, member, "party", now);
  }
  return matching.length > 0;
}

/**
 * Records a drop from a forwarded chat line. These carry only the item's
 * name, so its ID (for the icon) and price come from the wiki prices API.
 * Skipped if the same player already has that item recorded moments ago —
 * from Dink's Loot notifier, or from another clan member's Dink forwarding
 * the same line.
 */
async function recordChatDrop(
  liveEvents: Array<{ id: string; bossFilter: string | null }>,
  drop: ChatDrop,
  now: Date
): Promise<boolean> {
  // Without a source (the "(N coins)" form) there's no way to check a boss
  // filter, so such lines only count for events that track every boss.
  const matching = liveEvents.filter((e) => matchesBossFilter(e.bossFilter, drop.source));
  if (!matching.length) return false;

  const item = await lookupItem(drop.itemName);
  const priceEach = drop.totalValue != null ? Math.round(drop.totalValue / drop.quantity) : item.price;
  const rsnKey = normalizeRsn(drop.player);

  for (const event of matching) {
    const created = await withPlayerLock(event.id, rsnKey, async (tx) => {
      if (await findRecentDrop(tx, event.id, rsnKey, drop.itemName, now)) return false;
      await tx.clanEventActivity.create({
        data: {
          eventId: event.id,
          rsn: drop.player,
          rsnKey,
          type: "LOOT",
          source: drop.source,
          itemId: item.id,
          itemName: drop.itemName,
          quantity: drop.quantity,
          priceEach: toInt(priceEach),
          origin: "chat",
          createdAt: now,
        },
      });
      return true;
    });
    if (created) await recordAttendance(event.id, drop.player, "loot", now);
  }
  return true;
}

function findRecentDrop(
  tx: Prisma.TransactionClient,
  eventId: string,
  rsnKey: string,
  itemName: string,
  now: Date,
  origin?: "dink" | "chat"
) {
  return tx.clanEventActivity.findFirst({
    where: {
      eventId,
      rsnKey,
      type: "LOOT",
      itemName: { equals: itemName, mode: "insensitive" },
      createdAt: { gte: new Date(now.getTime() - DROP_MERGE_WINDOW_MS) },
      ...(origin ? { origin } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
}

/**
 * Runs `fn` in a transaction holding a Postgres advisory lock for this
 * player in this event, so concurrent reports of the same kill/drop can't
 * both pass a "not recorded yet" check.
 */
function withPlayerLock<T>(eventId: string, rsnKey: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${eventId}:${rsnKey}`}))`;
    return fn(tx);
  });
}
