import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

type DinkItemEntry = { id: number; name: string };

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

  // Parse body — Dink sends multipart/form-data when a screenshot is attached,
  // plain JSON otherwise. payload_json holds the notification; file holds the image.
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

  // Validate token and load board with tile dinkItems
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
          requiredCount: true,
          dinkItems: true,
        },
      },
    },
  });

  if (!board) return NextResponse.json({ error: "no_active_board" }, { status: 404 });
  if (!board.dinkToken || token !== board.dinkToken) {
    return NextResponse.json({ error: "bad_token" }, { status: 401 });
  }

  // Check event window
  const now = new Date();
  if (board.startsAt && board.startsAt > now) return NextResponse.json({ status: "event_closed" });
  if (board.endsAt && board.endsAt < now) return NextResponse.json({ status: "event_closed" });

  // Match RSN to a team (user with this name in their teamMembers array)
  const normalizedRsn = normalizeRsn(playerName);
  const allPlayers = await prisma.user.findMany({
    where: { role: "PLAYER" },
    select: { id: true, teamMembers: true },
  });

  const matchedUser = allPlayers.find((u) =>
    u.teamMembers.some((m) => normalizeRsn(m) === normalizedRsn)
  );

  if (!matchedUser) return NextResponse.json({ status: "not_on_team" });

  // Extract dropped items from the notification payload
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
    // DEATH, LEVEL, SLAYER, etc. — not relevant for bingo
    return NextResponse.json({ status: "ignored" });
  }

  if (droppedItems.length === 0) return NextResponse.json({ status: "no_match" });

  // Build itemId → tile lookup from all tile dinkItems
  const itemTileMap = new Map<number, { id: string; title: string; requiredCount: number }>();
  for (const tile of board.tiles) {
    const entries = (tile.dinkItems as DinkItemEntry[]) ?? [];
    for (const entry of entries) {
      if (!itemTileMap.has(entry.id)) {
        itemTileMap.set(entry.id, { id: tile.id, title: tile.title, requiredCount: tile.requiredCount });
      }
    }
  }

  // Upload screenshot once if present, reuse URL for all matched tiles
  let imageUrl: string | null = null;
  if (imageFile && imageFile.size > 0) {
    const { url } = await put(
      `submissions/dink/${matchedUser.id}/${Date.now()}.png`,
      imageFile,
      { access: "public" }
    );
    imageUrl = url;
  }

  const matched: string[] = [];

  for (const item of droppedItems) {
    const tile = itemTileMap.get(item.id);
    if (!tile) continue;

    // Skip if this exact item already has a non-rejected Dink submission for this tile/user
    const alreadyClaimed = await prisma.submission.findFirst({
      where: {
        userId: matchedUser.id,
        tileId: tile.id,
        dinkItemId: item.id,
        status: { not: "REJECTED" },
      },
      select: { id: true },
    });
    if (alreadyClaimed) continue;

    // Skip if tile is already at requiredCount with non-rejected submissions
    const activeCount = await prisma.submission.count({
      where: { userId: matchedUser.id, tileId: tile.id, status: { not: "REJECTED" } },
    });
    if (activeCount >= tile.requiredCount) continue;

    await prisma.submission.create({
      data: {
        userId: matchedUser.id,
        tileId: tile.id,
        imageUrl,
        status: "APPROVED",
        reviewedAt: now,
        source: "dink",
        dinkItemId: item.id,
        dinkItemName: item.name,
        teamMember: playerName,
      },
    });

    matched.push(tile.title);
  }

  return NextResponse.json({
    status: matched.length > 0 ? "ok" : "no_match",
    matched,
  });
}
