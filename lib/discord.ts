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
