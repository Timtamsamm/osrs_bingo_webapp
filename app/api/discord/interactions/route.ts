import { after, NextRequest, NextResponse } from "next/server";
import nacl from "tweetnacl";
import { discordSetupMessage, eventsWebhookUrl } from "@/lib/eventsDinkSetup";

// Discord "Interactions Endpoint URL" for the WongTongsEvent application.
// Discord POSTs every slash command use here; we answer /events with the
// Dink setup message as an ephemeral reply (only the person who ran it sees
// it), always built from the current events webhook token.
//
// Discord gives up ("The application did not respond") if it gets no answer
// within 3 seconds. A cold serverless start plus waking the database can take
// longer than that, so /events answers immediately with a deferred ("thinking…")
// reply and fills it in afterwards by editing that reply — Discord allows 15
// minutes for the edit. The DB-touching code is imported lazily so it isn't
// even loaded on the fast path.
//
// Register the command with scripts/register-discord-commands.ts.

// The application's public key — public by design (Discord signs requests
// with the matching private key), so it's safe to keep in source.
const DISCORD_PUBLIC_KEY =
  process.env.DISCORD_PUBLIC_KEY ?? "33b49c432dea2bc73c7443533be5131aec02d15e75be05bea5277b429d2ed6d3";

const InteractionType = { PING: 1, APPLICATION_COMMAND: 2 } as const;
const ResponseType = { PONG: 1, DEFERRED_CHANNEL_MESSAGE: 5 } as const;
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

  const interaction = JSON.parse(body) as { type: number; token: string; application_id: string; data?: { name?: string } };

  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: ResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND && interaction.data?.name === "events") {
    // Discord calls the public URL registered as the interactions endpoint,
    // so the request's own origin is the public site players should use.
    const origin = new URL(req.url).origin;
    after(() => sendSetupMessage(interaction.application_id, interaction.token, origin));
    return NextResponse.json({ type: ResponseType.DEFERRED_CHANNEL_MESSAGE, data: { flags: EPHEMERAL } });
  }

  return NextResponse.json({ error: "unknown interaction" }, { status: 400 });
}

/** Replaces the deferred "thinking…" reply with the Dink setup message. */
async function sendSetupMessage(applicationId: string, interactionToken: string, origin: string): Promise<void> {
  let content: string;
  try {
    // Usually answered from cache without touching the database.
    const { getEventsWebhookState } = await import("@/lib/webhookCache");
    let token = (await getEventsWebhookState()).token;
    if (!token) token = await (await import("@/lib/clanEvents")).ensureEventsToken();
    content = discordSetupMessage(eventsWebhookUrl(origin, token));
  } catch (e) {
    console.error("discord /events: building the setup message failed", e);
    content = "Sorry — something went wrong getting the setup. Try /events again in a minute, or ask an admin.";
  }

  const res = await fetch(`https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) console.error("discord /events: editing the reply failed", res.status, await res.text());
}
