/**
 * Posts a best-effort announcement embed to a Discord channel webhook when
 * an event is created. Never throws — a bad/removed webhook URL or a
 * Discord-side failure shouldn't block creating the event itself.
 */

interface EventAnnouncement {
  title: string;
  description: string | null;
  imageUrl: string | null;
  startsAt: Date;
  endsAt: Date;
}

function discordTimestamp(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

export async function postEventAnnouncement(webhookUrl: string, event: EventAnnouncement): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: event.title,
            description: event.description || undefined,
            color: 0x9333ea,
            image: event.imageUrl ? { url: event.imageUrl } : undefined,
            fields: [
              { name: "Starts", value: discordTimestamp(event.startsAt), inline: true },
              { name: "Ends", value: discordTimestamp(event.endsAt), inline: true },
            ],
          },
        ],
      }),
    });
  } catch {
    // best-effort only
  }
}

const DISCORD_API = "https://discord.com/api/v10";
const EVENTS_PAGE_URL = "https://www.upthetongs.com/events";

async function imageUrlToDataUri(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Creates a real Discord Guild Scheduled Event (shows in the server's Events
 * tab, members can RSVP/get reminders) via the bot API. Best-effort — a
 * missing token/guild, revoked bot permission, or Discord-side failure
 * never blocks creating the event on the site itself.
 */
export async function createDiscordScheduledEvent(event: EventAnnouncement): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) return;

  try {
    const image = event.imageUrl ? await imageUrlToDataUri(event.imageUrl) : null;

    await fetch(`${DISCORD_API}/guilds/${guildId}/scheduled-events`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: event.title.slice(0, 100),
        description: event.description?.slice(0, 1000) || undefined,
        privacy_level: 2, // GUILD_ONLY — the only value Discord currently supports
        entity_type: 3, // EXTERNAL — not tied to a voice channel
        scheduled_start_time: event.startsAt.toISOString(),
        scheduled_end_time: event.endsAt.toISOString(),
        entity_metadata: { location: EVENTS_PAGE_URL },
        image: image ?? undefined,
      }),
    });
  } catch {
    // best-effort only
  }
}
