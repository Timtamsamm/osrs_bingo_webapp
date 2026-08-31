"use client";

import { useState } from "react";

const inputCls = "bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-2 text-white text-sm placeholder-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600/60";

export default function DiscordSettingsForm({ initialWebhookUrl }: { initialWebhookUrl: string | null }) {
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setStatus("idle");
    setError("");
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordWebhookUrl: webhookUrl }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to save");
      setStatus("error");
      return;
    }
    setStatus("saved");
  }

  return (
    <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5 flex flex-col gap-2">
      <h2 className="font-semibold text-purple-100">Discord Announcements</h2>
      <p className="text-xs text-purple-700/60">
        Paste a channel webhook URL (Channel Settings → Integrations → Webhooks) and every new event will post an announcement there automatically. Leave blank to disable.
      </p>
      <div className="flex gap-2">
        <input
          value={webhookUrl}
          onChange={(e) => { setWebhookUrl(e.target.value); setStatus("idle"); }}
          placeholder="https://discord.com/api/webhooks/…"
          className={`flex-1 ${inputCls} font-mono`}
        />
        <button
          onClick={save}
          disabled={saving}
          className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors purple-glow-sm shrink-0"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {status === "saved" && <p className="text-xs text-green-400">Saved.</p>}
      {status === "error" && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
