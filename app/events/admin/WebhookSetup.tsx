"use client";

import { useState } from "react";

export default function WebhookSetup({ origin, initialToken }: { origin: string; initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const url = `${origin}/api/webhook/events?token=${token}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerate() {
    if (!confirm("Generate a new link? The old one stops working immediately — everyone using it will need the new one.")) return;
    setRegenerating(true);
    const res = await fetch("/api/admin/events/token", { method: "POST" });
    setRegenerating(false);
    if (res.ok) setToken((await res.json()).token);
  }

  return (
    <section className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-semibold text-purple-100 text-sm">Events webhook link</h2>
        <p className="text-xs text-purple-500/80 mt-1">
          One link for every event. It only receives data — it reveals nothing about the bingo board.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <code className="flex-1 min-w-0 bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-2 text-xs text-purple-200 break-all">
          {url}
        </code>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={copy}
            className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
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

      <div className="grid gap-4 sm:grid-cols-2 text-xs text-purple-300/90 leading-relaxed">
        <div>
          <p className="font-semibold text-purple-100 mb-1">Admins — check-ins (needed)</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>In Dink, paste the link on a new line in <b>Primary Webhook URLs</b> (or in <b>Webhook Overrides → Chat Webhook Override</b>, to keep check-ins out of your own Discord).</li>
            <li>In <b>Custom Chat Messages</b>, tick <b>Enable Chat Notifications</b>.</li>
            <li>In <b>Message Types</b>, select <b>Non-Public Chats</b> (where clan chat lives).</li>
            <li>In <b>Message Filters</b>, add the event&apos;s join phrase (e.g. <code>!join</code>) on its own line.</li>
          </ol>
          <p className="mt-1.5 text-purple-500/80">You must be online and in clan chat during the event. Two admins doing this is safer — duplicates are ignored.</p>
        </div>
        <div>
          <p className="font-semibold text-purple-100 mb-1">Players — kills &amp; drops (optional)</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>
              <b>Kills:</b> paste the link in <b>Webhook Overrides → Chat Webhook Override</b>. In <b>Custom Chat Messages</b>, tick{" "}
              <b>Enable Chat Notifications</b>, keep <b>Game Engine</b> selected in <b>Message Types</b>, and add{" "}
              <code>Your * count is: *</code> to <b>Message Filters</b>. Every kill is sent only to this site — your Kill Count Interval and
              other webhooks are untouched.
            </li>
            <li>
              <b>Drops:</b> paste the link on a new line in <b>Primary Webhook URLs</b> (existing lines keep working) and tick{" "}
              <b>Enable loot</b> — <b>Min Loot value</b> decides which drops are reported.
            </li>
          </ol>
          <p className="mt-1.5 text-purple-500/80">Data outside an event&apos;s time window is ignored. A kill or drop during an event also counts as checking in.</p>
        </div>
      </div>
    </section>
  );
}
