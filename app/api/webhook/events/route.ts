import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { normalizeRsn } from "@/lib/scoring";
import { matchesBossFilter, recordAttendance } from "@/lib/clanEvents";

// Dink webhook for clan events — completely separate from the bingo webhook
// (/api/webhook/dink), with its own token, so handing this URL out reveals
// nothing about a bingo board.
//
// Three notification types matter:
// - CHAT: an admin's Dink, with the chat notifier matching the join phrase,
//   reports every clan member who types it. Clan chat is cross-world, so one
//   admin covers everyone — the sender is extra.source, not playerName.
// - KILL_COUNT / LOOT: sent by players who've opted in to drop/KC tracking.
//   They report from their own client, so worlds and instances don't matter.

const CHAT_TYPES = new Set(["CLAN_CHAT", "CLAN_GUEST_CHAT", "FRIENDSCHAT"]);
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
    const boss = extra.boss as string | undefined;
    const matching = liveEvents.filter((e) => matchesBossFilter(e.bossFilter, boss));
    for (const event of matching) {
      await prisma.clanEventActivity.create({
        data: {
          eventId: event.id,
          rsn: playerName,
          rsnKey: normalizeRsn(playerName),
          type: "KILL",
          source: boss ?? null,
          killCount: toInt(extra.count),
          createdAt: now,
        },
      });
      await recordAttendance(event.id, playerName, "kill", now);
      // Raid party members count as attending even if they don't run the
      // events webhook themselves.
      for (const member of party) await recordAttendance(event.id, member, "party", now);
    }
    return NextResponse.json({ status: matching.length ? "recorded" : "ignored" });
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

  for (const event of matching) {
    await prisma.clanEventActivity.createMany({
      data: items.map((item) => ({
        eventId: event.id,
        rsn: playerName,
        rsnKey: normalizeRsn(playerName),
        type: "LOOT",
        source: source ?? null,
        itemId: item.id as number,
        itemName: item.name as string,
        quantity: toInt(item.quantity) ?? 1,
        priceEach: toInt(item.priceEach),
        imageUrl,
        createdAt: now,
      })),
    });
    await recordAttendance(event.id, playerName, "loot", now);
    for (const member of party) await recordAttendance(event.id, member, "party", now);
  }
  return NextResponse.json({ status: "recorded" });
}
