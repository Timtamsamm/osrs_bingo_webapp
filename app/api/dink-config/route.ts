import { NextRequest, NextResponse } from "next/server";
import { getBingoWebhookState } from "@/lib/webhookCache";

// Dink's "Dynamic Config URL" feature (Advanced tab) fetches this on login and
// every ~3h, and merges the returned JSON straight into the player's local
// Dink settings. No auth header is sent, so the board's dinkToken doubles as
// the lookup key here (matches the webhook route's auth model). Answered from
// cache (lib/webhookCache) — every player's Dink polls this, so it mustn't
// wake the database.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  const board = await getBingoWebhookState();
  if (!board || !board.token || token !== board.token) {
    return NextResponse.json({ error: "bad_token" }, { status: 401 });
  }
  // In-range tiles' item names, computed when the cache was filled.
  const itemNames = board.itemNames;

  const webhookUrl = new URL("/api/webhook/dink", req.url);
  webhookUrl.searchParams.set("token", board.token);

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
