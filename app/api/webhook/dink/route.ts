import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

type TierDef = { tier: number; points: number; requiredCount: number; dinkItems: Array<{ id: number; name: string }> };

function normalizeRsn(rsn: string): string {
  return rsn.trim().replace(/[_ ]/g, " ").toLowerCase();
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

  let payload: Record<string, unknown>;
  let imageFile: File | null = null;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const payloadJson = form.get("payload_json");
    if (!payloadJson) return NextResponse.json({ error: "missing payload_json" }, { status: 400 });
    try {
      payload = JSON.parse(payloadJson as string);
    } catch {
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }
    imageFile = form.get("file") as File | null;
  } else {
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "bad_json" }, { status: 400 });
    }
  }

  const type = payload.type as string | undefined;
  const playerName = payload.playerName as string | undefined;
  const extra = (payload.extra ?? {}) as Record<string, unknown>;

  if (!playerName) return NextResponse.json({ status: "ignored" });

  const board = await prisma.bingoBoard.findFirst({
    where: { active: true },
    select: {
      id: true,
      dinkToken: true,
      startsAt: true,
      endsAt: true,
      tiles: {
        select: {
          id: true,
          title: true,
          tiers: true,
        },
      },
    },
  });

  if (!board) return NextResponse.json({ error: "no_active_board" }, { status: 404 });
  if (!board.dinkToken || token !== board.dinkToken) {
    return NextResponse.json({ error: "bad_token" }, { status: 401 });
  }

  const now = new Date();
  if (board.startsAt && board.startsAt > now) return NextResponse.json({ status: "event_closed" });
  if (board.endsAt && board.endsAt < now) return NextResponse.json({ status: "event_closed" });

  const normalizedRsn = normalizeRsn(playerName);
  const allParticipants = await prisma.participant.findMany({
    select: { id: true, rsn: true, teamId: true },
  });

  const matchedParticipant = allParticipants.find(
    (p) => normalizeRsn(p.rsn) === normalizedRsn
  );

  if (!matchedParticipant) return NextResponse.json({ status: "not_on_team" });

  const droppedItems: { id: number; name: string }[] = [];

  if (type === "LOOT") {
    const items = (extra.items as Array<{ id: number; name: string }> | undefined) ?? [];
    for (const item of items) {
      if (typeof item.id === "number" && item.name) {
        droppedItems.push({ id: item.id, name: item.name });
      }
    }
  } else if (type === "COLLECTION") {
    const itemId = extra.itemId as number | undefined;
    const itemName = extra.itemName as string | undefined;
    if (itemId != null && itemName) {
      droppedItems.push({ id: itemId, name: itemName });
    }
  } else {
    return NextResponse.json({ status: "ignored" });
  }

  if (droppedItems.length === 0) return NextResponse.json({ status: "no_match" });

  // Map each item ID to the tile it belongs to, and every tier on that tile
  // whose item list includes it. Usually that's a single tier (each tier has
  // its own distinct items — e.g. T1 = rare drop, T3 = common drop). If the
  // *same* item is listed under more than one tier on a tile, that tile is
  // treated as a shared pool (e.g. "Any 3 pets" with the same pet IDs in
  // every tier box) — see the branch below.
  const itemToTile = new Map<number, { tileId: string; tileTitle: string; tierDefs: TierDef[] }>();
  for (const tile of board.tiles) {
    const tiers = (tile.tiers as TierDef[]) ?? [];
    const tiersByItem = new Map<number, TierDef[]>();
    for (const tierDef of tiers) {
      for (const entry of tierDef.dinkItems) {
        const arr = tiersByItem.get(entry.id) ?? [];
        arr.push(tierDef);
        tiersByItem.set(entry.id, arr);
      }
    }
    for (const [itemId, tierDefs] of tiersByItem) {
      if (!itemToTile.has(itemId)) {
        itemToTile.set(itemId, { tileId: tile.id, tileTitle: tile.title, tierDefs });
      }
    }
  }

  let imageUrl: string | null = null;
  if (imageFile && imageFile.size > 0) {
    const { url } = await put(
      `submissions/dink/${matchedParticipant.teamId}/${Date.now()}.png`,
      imageFile,
      { access: "public" }
    );
    imageUrl = url;
  }

  // Require a screenshot to auto-approve — a JSON-only payload (no image) is
  // far easier to forge than a real Dink client submission, so those fall to
  // manual review instead of silently counting.
  const verified = imageUrl !== null;
  const teamId = matchedParticipant.teamId;

  const matched: string[] = [];

  for (const item of droppedItems) {
    const match = itemToTile.get(item.id);
    if (!match) continue;
    const { tileId, tileTitle, tierDefs } = match;

    let targetTier: TierDef;

    if (tierDefs.length === 1) {
      // Normal case: this item only belongs to one tier on this tile.
      const tierDef = tierDefs[0];

      const alreadyClaimed = await prisma.submission.findFirst({
        where: { teamId, tileId, tier: tierDef.tier, dinkItemId: item.id, status: { not: "REJECTED" } },
        select: { id: true },
      });
      if (alreadyClaimed) continue;

      const activeCount = await prisma.submission.count({
        where: { teamId, tileId, tier: tierDef.tier, status: { not: "REJECTED" } },
      });
      if (activeCount >= tierDef.requiredCount) continue;

      targetTier = tierDef;
    } else {
      // Shared-pool case: the same item(s) are listed under multiple tiers
      // (e.g. "Any 3 pets" with identical pet IDs in every tier box). The
      // running count of distinct qualifying drops decides which tier this
      // one lands on. Requires each tier's requiredCount to be sequential
      // (1, 2, 3, ...) — a gap means a count can never land on it.
      const tierNums = tierDefs.map((t) => t.tier);

      const alreadyClaimed = await prisma.submission.findFirst({
        where: { teamId, tileId, tier: { in: tierNums }, dinkItemId: item.id, status: { not: "REJECTED" } },
        select: { id: true },
      });
      if (alreadyClaimed) continue;

      const currentCount = await prisma.submission.count({
        where: { teamId, tileId, tier: { in: tierNums }, status: { not: "REJECTED" } },
      });
      const next = tierDefs.find((t) => t.requiredCount === currentCount + 1);
      if (!next) continue;

      targetTier = next;
    }

    await prisma.submission.create({
      data: {
        teamId,
        tileId,
        imageUrl,
        status: verified ? "APPROVED" : "PENDING",
        reviewedAt: verified ? now : null,
        source: "dink",
        dinkItemId: item.id,
        dinkItemName: item.name,
        teamMember: playerName,
        tier: targetTier.tier,
      },
    });

    matched.push(`${tileTitle} (T${targetTier.tier})`);
  }

  return NextResponse.json({
    status: matched.length > 0 ? "ok" : "no_match",
    matched,
  });
}
