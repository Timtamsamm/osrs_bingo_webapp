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
    // Deliberately NOT setting minLootValue here — it's a single global
    // threshold shared across every destination configured for the Loot
    // notifier (not scoped to our webhook), so importing a value here
    // clobbers the player's own threshold and silences their other webhooks
    // for anything below it. lootItemAllowlist below is enough on its own to
    // guarantee board items notify regardless of value.
    lootItemAllowlist: Array.from(itemNames).join("\n"),
    // A screenshot is required for a submission to auto-approve (see the
    // webhook route) — force these on so the dynamic config alone is enough.
    lootSendImage: true,
    collectionSendImage: true,
    petSendImage: true,
    // Dink lets a player set a per-notifier "Webhook Override" (Loot/
    // Collection/Pet) that, if non-blank, REPLACES the primary webhook for
    // that notification type only — so a player who's pointed one of these
    // at their own Discord channel silently stops reaching us for that
    // notifier, even though discordWebhook above is set correctly. Confirmed
    // in production: a Collection Log pet notification reached the player's
    // own channel but never hit this endpoint. These three keys are
    // Dink-side "merge" (append-as-new-line) config keys on import, not
    // replace — so setting our own URL here adds us alongside whatever
    // override the player already has, rather than clobbering it.
    lootWebhook: url,
    collectionWebhook: url,
    petWebhook: url,
  });
}
