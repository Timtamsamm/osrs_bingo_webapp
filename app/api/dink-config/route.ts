import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type TierDef = { tier: number; points: number; requiredCount: number; dinkItems: Array<{ id: number; name: string }> };

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
      tiles: { select: { tiers: true } },
    },
  });

  if (!board || !board.dinkToken || token !== board.dinkToken) {
    return NextResponse.json({ error: "bad_token" }, { status: 401 });
  }

  const itemNames = new Set<string>();
  for (const tile of board.tiles) {
    const tiers = (tile.tiers as TierDef[]) ?? [];
    for (const tierDef of tiers) {
      for (const item of tierDef.dinkItems) {
        itemNames.add(item.name);
      }
    }
  }

  const webhookUrl = new URL("/api/webhook/dink", req.url);
  webhookUrl.searchParams.set("token", board.dinkToken);

  return NextResponse.json({
    discordWebhook: webhookUrl.toString(),
    lootEnabled: true,
    collectionLogEnabled: true,
    minLootValue: 2147483647,
    lootItemAllowlist: Array.from(itemNames).join("\n"),
  });
}
