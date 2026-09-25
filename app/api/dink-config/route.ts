import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type TierDef = { tier: number; points: number; requiredCount: number; dinkItems: Array<{ id: number; name: string }> };
type PointsConfig = { target: number; items: Array<{ id: number; name: string; basePoints: number }> };

// Dink's "Dynamic Config URL" feature (Advanced tab) fetches this on login and
// every ~3h, and merges the returned JSON straight into the player's local
// Dink settings. No auth header is sent, so the board's dinkToken doubles as
// the lookup key here (matches the webhook route's auth model).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  const board = await prisma.bingoBoard.findFirst({
    where: { active: true },
    select: {
      dinkToken: true,
      size: true,
      tiles: { select: { position: true, scoringMode: true, tiers: true, pointsConfig: true } },
    },
  });

  if (!board || !board.dinkToken || token !== board.dinkToken) {
    return NextResponse.json({ error: "bad_token" }, { status: 401 });
  }

  // Tiles outside the current grid size are hidden (not deleted) — see
  // lib/scoring.ts — so exclude them here too, or players would get notified
  // for items that can no longer score anything.
  const inRangeTiles = board.tiles.filter((t) => t.position < board.size * board.size);

  const itemNames = new Set<string>();
  for (const tile of inRangeTiles) {
    if (tile.scoringMode === "POINTS") {
      const cfg = tile.pointsConfig as PointsConfig | null;
      for (const item of cfg?.items ?? []) itemNames.add(item.name);
      continue;
    }
    const tiers = (tile.tiers as TierDef[]) ?? [];
    for (const tierDef of tiers) {
      for (const item of tierDef.dinkItems) {
        itemNames.add(item.name);
      }
    }
  }

  const webhookUrl = new URL("/api/webhook/dink", req.url);
  webhookUrl.searchParams.set("token", board.dinkToken);

  const url = webhookUrl.toString();

  return NextResponse.json({
    discordWebhook: url,
    lootEnabled: true,
    collectionLogEnabled: true,
    petEnabled: true,
    lootItemAllowlist: Array.from(itemNames).join("\n"),
    // A screenshot is required for a submission to auto-approve (see the
    // webhook route) — force these on so the dynamic config alone is enough.
    lootSendImage: true,
    collectionSendImage: true,
    petSendImage: true,
    // We intentionally do NOT set lootWebhook/collectionWebhook/petWebhook
    // (Dink's per-notifier "Webhook Override" fields). Dink reads override-
    // if-set, else primary — never both (BaseNotifier#createMessage). Most
    // players never touch these overrides, so they're blank and Dink falls
    // back to discordWebhook above, reaching both us and the player's own
    // channel. Forcing our URL into these fields (previously done here)
    // created an override from scratch for players who didn't have one,
    // which made Dink stop reading primary for those three notification
    // types — silently cutting the player's own channel off from Loot/
    // Collection/Pet notifications specifically. The one case this doesn't
    // cover — a player who already has their own per-notifier override set
    // — needs that player to manually add our webhook as an extra line in
    // their override box; not worth trading away the common case for.
  });
}
