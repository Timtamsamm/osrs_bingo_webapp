/**
 * Registers the Discord slash commands handled by /api/discord/interactions,
 * and optionally points the application's Interactions Endpoint URL at it.
 *
 * Usage:
 *   npx tsx scripts/register-discord-commands.ts
 *   npx tsx scripts/register-discord-commands.ts --endpoint https://www.bingobeasts.com/api/discord/interactions
 *
 * Requires DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in .env. Commands are
 * registered to that one server (guild commands update instantly; global
 * ones can take up to an hour). Re-running is safe — it overwrites the
 * server's command list with the one below.
 */

import "dotenv/config";

const API = "https://discord.com/api/v10";

const commands = [
  {
    name: "events",
    description: "Get the one-time Dink setup for clan events (only you can see the reply)",
    type: 1, // CHAT_INPUT
  },
];

async function discord(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json", ...init.headers },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID } = process.env;
  if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) throw new Error("DISCORD_BOT_TOKEN and DISCORD_GUILD_ID must be set in .env");

  const app = await discord("/applications/@me");

  const endpointIdx = process.argv.indexOf("--endpoint");
  if (endpointIdx !== -1) {
    const url = process.argv[endpointIdx + 1];
    if (!url) throw new Error("--endpoint needs a URL");
    // Discord validates the URL before saving: it must answer a signed PING
    // and reject a badly signed one, so the endpoint has to be deployed first.
    await discord("/applications/@me", { method: "PATCH", body: JSON.stringify({ interactions_endpoint_url: url }) });
    console.log(`Interactions endpoint set to ${url}`);
  }

  const registered = await discord(`/applications/${app.id}/guilds/${DISCORD_GUILD_ID}/commands`, {
    method: "PUT",
    body: JSON.stringify(commands),
  });
  console.log(`Registered ${registered.length} command(s) for ${app.name}: ${registered.map((c: { name: string }) => `/${c.name}`).join(", ")}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
