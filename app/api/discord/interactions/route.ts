import { NextRequest, NextResponse } from "next/server";
import nacl from "tweetnacl";
import { prisma } from "@/lib/prisma";
import { activeJoinPhrases, ensureEventsToken } from "@/lib/clanEvents";
import { discordSetupMessage, eventsWebhookUrl } from "@/lib/eventsDinkSetup";

// Discord "Interactions Endpoint URL" for the WongTongsEvent application.
// Discord POSTs every slash command use here; we answer /events with the
// Dink setup message as an ephemeral reply (only the person who ran it sees
// it), always built from the current events webhook token.
//
// Register the command with scripts/register-discord-commands.ts.

// The application's public key — public by design (Discord signs requests
// with the matching private key), so it's safe to keep in source.
const DISCORD_PUBLIC_KEY =
  process.env.DISCORD_PUBLIC_KEY ?? "33b49c432dea2bc73c7443533be5131aec02d15e75be05bea5277b429d2ed6d3";

const InteractionType = { PING: 1, APPLICATION_COMMAND: 2 } as const;
const ResponseType = { PONG: 1, CHANNEL_MESSAGE: 4 } as const;
const EPHEMERAL = 1 << 6;

function verifySignature(body: string, signature: string | null, timestamp: string | null): boolean {
  if (!signature || !timestamp) return false;
  try {
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, "hex"),
      Buffer.from(DISCORD_PUBLIC_KEY, "hex")
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Verify against the raw body — Discord rejects the endpoint outright if
  // requests with bad signatures aren't answered with 401.
  const body = await req.text();
  if (!verifySignature(body, req.headers.get("x-signature-ed25519"), req.headers.get("x-signature-timestamp"))) {
    return NextResponse.json({ error: "invalid request signature" }, { status: 401 });
  }

  const interaction = JSON.parse(body) as { type: number; data?: { name?: string } };

  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: ResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND && interaction.data?.name === "events") {
    const now = new Date();
    const [token, events] = await Promise.all([
      ensureEventsToken(),
      prisma.clanEvent.findMany({ where: { endsAt: { gte: now } }, select: { joinPhrase: true, endsAt: true } }),
    ]);
    // Discord calls the public URL registered as the interactions endpoint,
    // so the request's own origin is the public site players should use.
    const origin = new URL(req.url).origin;
    const content = discordSetupMessage(eventsWebhookUrl(origin, token), activeJoinPhrases(events, now));
    return NextResponse.json({ type: ResponseType.CHANNEL_MESSAGE, data: { content, flags: EPHEMERAL } });
  }

  return NextResponse.json({ error: "unknown interaction" }, { status: 400 });
}
