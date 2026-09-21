"use client";

import { useState } from "react";

export interface TileRuleInput {
  id: string;
  title: string;
  rules: string;
}

export default function TileRulesForm({ initialTiles }: { initialTiles: TileRuleInput[] }) {
  const [tiles, setTiles] = useState(initialTiles);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  function updateRules(id: string, value: string) {
    setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, rules: value } : t)));
    setStatus("idle");
  }

  async function save() {
    setSaving(true);
    setStatus("idle");
    setError("");
    const res = await fetch("/api/admin/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tileRules: tiles.map((t) => ({ id: t.id, rules: t.rules })) }),
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
      <div>
        <h2 className="font-semibold text-purple-100 text-sm">Board Rules</h2>
        <p className="text-xs text-purple-700/60 mt-1">
          Formal rules/clarifications shown on the public Rules page for each tile — separate from that tile&apos;s
          Description (still edited in Board &amp; Tiles).
        </p>
      </div>

      {tiles.length === 0 ? (
        <p className="text-xs text-purple-700/60">No tiles yet — add tiles in Board &amp; Tiles first.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tiles.map((t) => (
            <div key={t.id} className="flex flex-col gap-1">
              <label className="text-xs text-purple-400 font-medium">{t.title}</label>
              <textarea
                value={t.rules}
                onChange={(e) => updateRules(t.id, e.target.value)}
                rows={2}
                placeholder="Formal rules/clarifications for this tile"
                className="bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-2 text-white text-sm placeholder-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600/60 resize-y"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || tiles.length === 0}
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
