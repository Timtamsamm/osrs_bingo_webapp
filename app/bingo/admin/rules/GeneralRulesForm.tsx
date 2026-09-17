"use client";

import { useState } from "react";

export default function GeneralRulesForm({ initialRules }: { initialRules: string }) {
  const [rules, setRules] = useState(initialRules);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setStatus("idle");
    setError("");
    const res = await fetch("/api/admin/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generalRules: rules }),
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
    <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5 flex flex-col gap-3 max-w-2xl">
      <h2 className="font-semibold text-purple-100 text-sm">General Rules</h2>
      <p className="text-xs text-purple-700/60">
        Clan-wide rules that apply to the whole event — cheating, account sharing, screenshot requirements, etc.
        Line breaks are preserved on the public page.
      </p>
      <textarea
        value={rules}
        onChange={(e) => { setRules(e.target.value); setStatus("idle"); }}
        rows={16}
        placeholder={"1. No account sharing or boosting.\n2. Every drop must be verified via Dink or a screenshot.\n3. ..."}
        className="bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-2 text-white text-sm placeholder-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600/60 resize-y font-mono"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors purple-glow-sm shrink-0"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {status === "saved" && <p className="text-xs text-green-400">Saved.</p>}
        {status === "error" && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
