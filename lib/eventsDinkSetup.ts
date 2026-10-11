/**
 * The Dink setup players import with ::DinkImport, and the Discord message
 * that wraps it. Shared by the events admin page (copy buttons) and the
 * Discord /events command so both always say the same thing. No server-only
 * imports — the admin page uses this client-side.
 */

export function eventsWebhookUrl(origin: string, token: string): string {
  return `${origin}/api/webhook/events?token=${token}`;
}

// Settings for Dink's ::DinkImport command, which reads JSON from the
// clipboard. Webhook fields (discordWebhook, chatWebhook) are merged into the
// player's existing ones rather than replacing them; everything else is
// overwritten — so chatPatterns/chatMessageTypes replace any chat
// notifications the player had set up themselves.
export function dinkSettings(url: string, joinPhrases: string[] | null): Record<string, unknown> {
  const patterns = ["Your * count is: *", "* received a drop: *", ...(joinPhrases ?? [])];
  return {
    // Drops above the player's Min Loot value, with screenshots.
    discordWebhook: url,
    // Kill counts, cheap drops and check-ins go only here (when the player had
    // no chat override before), so their other webhooks aren't flooded.
    chatWebhook: url,
    notifyChat: true,
    // Dink attaches a screenshot to chat notifications by default — that'd be
    // an upload per kill that the events site just discards.
    chatSendImage: false,
    // GAME = kill count + drop lines; PRIVATE ("Non-Public Chats") = clan chat,
    // needed only by admins to see others' join phrase.
    chatMessageTypes: joinPhrases ? ["GAME", "PRIVATE"] : ["GAME"],
    chatPatterns: patterns.join("\n"),
  };
}

export function discordSetupMessage(url: string, joinPhrases: string[]): string {
  return [
    "**Clan events: one-time Dink setup**",
    "This lets the clan site record your kills and drops during events. It doesn't change your Kill Count or Loot settings, and your own Discord webhooks keep working.",
    "1. Copy the block below.",
    "2. In game, type `::DinkImport` in the chatbox and press Enter.",
    "Dink confirms in chat. You're done, and it works for every future event.",
    "",
    "```",
    JSON.stringify(dinkSettings(url, null)),
    "```",
    `During an event, type ${joinPhrases.map((p) => `\`${p}\``).join(" or ")} in clan chat to check in.`,
  ].join("\n");
}
