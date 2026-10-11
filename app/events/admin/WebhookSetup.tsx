"use client";

import { useState } from "react";
import { discordSetupMessage, dinkSettings, eventsWebhookUrl } from "@/lib/eventsDinkSetup";

export default function WebhookSetup({
  origin,
  initialToken,
  joinPhrases,
}: {
  origin: string;
  initialToken: string;
  /** Join phrases of every event that hasn't ended, for the admin setup. */
  joinPhrases: string[];
}) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const url = eventsWebhookUrl(origin, token);
  const playerJson = JSON.stringify(dinkSettings(url, null));
  const adminJson = JSON.stringify(dinkSettings(url, joinPhrases));
  const discordMessage = discordSetupMessage(url, joinPhrases);

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000);
  }

  async function regenerate() {
    if (!confirm("Generate a new link? The old one stops working immediately — everyone using it will need to import the setup again.")) return;
    setRegenerating(true);
    const res = await fetch("/api/admin/events/token", { method: "POST" });
    setRegenerating(false);
    if (res.ok) setToken((await res.json()).token);
  }

  const primaryBtn =
    "bg-purple-700 hover:bg-purple-600 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors text-left";
  const secondaryBtn =
    "border border-purple-800/60 hover:border-purple-600/60 text-purple-200 hover:text-white rounded-lg px-4 py-2 text-sm transition-colors text-left";

  return (
    <section className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5 flex flex-col gap-5">
      <div>
        <h2 className="font-semibold text-purple-100 text-sm">Dink setup</h2>
        <p className="text-xs text-purple-500/80 mt-1">
          One-time and the same for every event. Copy the setup, then type <code className="text-purple-200">::DinkImport</code> in game.
          It reveals nothing about the bingo board.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button onClick={() => copy("discord", discordMessage)} className={primaryBtn}>
          <span className="block">{copied === "discord" ? "Copied!" : "Copy Discord message"}</span>
          <span className="block text-[11px] font-normal text-purple-200/80 mt-0.5">Steps + setup for players — paste in your clan Discord</span>
        </button>
        <button onClick={() => copy("player", playerJson)} className={secondaryBtn}>
          <span className="block font-semibold">{copied === "player" ? "Copied!" : "Copy player setup"}</span>
          <span className="block text-[11px] text-purple-400/80 mt-0.5">Kills &amp; drops</span>
        </button>
        <button onClick={() => copy("admin", adminJson)} className={secondaryBtn}>
          <span className="block font-semibold">{copied === "admin" ? "Copied!" : "Copy admin setup"}</span>
          <span className="block text-[11px] text-purple-400/80 mt-0.5">
            Kills &amp; drops + clan chat check-ins ({joinPhrases.join(", ")})
          </span>
        </button>
      </div>

      <ul className="text-xs text-purple-400/80 leading-relaxed list-disc list-inside space-y-0.5">
        <li>
          Admins: import the <b>admin setup</b> and be online in clan chat during events — that&apos;s what records{" "}
          {joinPhrases.join(" / ")} check-ins. Two admins is safer; duplicates are ignored.
        </li>
        <li>
          Importing replaces a player&apos;s own Dink <b>chat</b> filters (most players don&apos;t use them). Webhook links are added
          alongside existing ones, never replaced.
        </li>
        <li>If you add an event with a new join phrase, admins need to re-import the admin setup.</li>
      </ul>

      <details className="text-xs text-purple-300/90">
        <summary className="cursor-pointer text-purple-400 hover:text-purple-200">Webhook link &amp; manual setup</summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 min-w-0 bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-2 text-purple-200 break-all">
              {url}
            </code>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => copy("url", url)} className={secondaryBtn}>
                {copied === "url" ? "Copied!" : "Copy link"}
              </button>
              <button
                onClick={regenerate}
                disabled={regenerating}
                className="border border-purple-800/60 hover:border-red-700/60 text-purple-300 hover:text-red-300 rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-40"
              >
                {regenerating ? "…" : "New link"}
              </button>
            </div>
          </div>
          <ol className="list-decimal list-inside space-y-0.5 leading-relaxed">
            <li>Paste the link on a new line in <b>Primary Webhook URLs</b> (drops above your <b>Min Loot value</b>).</li>
            <li>Paste it in <b>Webhook Overrides → Chat Webhook Override</b>.</li>
            <li>In <b>Custom Chat Messages</b>, tick <b>Enable Chat Notifications</b> and untick <b>Send Image</b>.</li>
            <li>
              <b>Message Types</b>: <b>Game Engine</b> (admins also <b>Non-Public Chats</b>).
            </li>
            <li>
              <b>Message Filters</b>, one per line: <code>Your * count is: *</code>, <code>* received a drop: *</code> (admins also{" "}
              {joinPhrases.map((p, i) => (
                <span key={p}>
                  {i > 0 && ", "}
                  <code>{p}</code>
                </span>
              ))}
              ).
            </li>
          </ol>
        </div>
      </details>
    </section>
  );
}
