"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type TierDef = { tier: 1 | 2 | 3; points: number; requiredCount: number; dinkItems: Array<{ id: number; name: string }> };
type PointsItemDef = { id: number; name: string; basePoints: number };
type PointsConfig = { target: number; items: PointsItemDef[] };
type Tile = { id: string; title: string; scoringMode: "TIERED" | "POINTS"; tiers: TierDef[]; pointsConfig: PointsConfig | null };
type Team = { id: string; name: string };

const inputCls = "bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600/60";
const labelCls = "text-xs text-purple-400 font-medium";

export default function ManualAwardForm({ teams, tiles }: { teams: Team[]; tiles: Tile[] }) {
  const router = useRouter();
  const [teamId, setTeamId] = useState("");
  const [tileId, setTileId] = useState("");
  const [tier, setTier] = useState<number | "">("");
  const [itemId, setItemId] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const selectedTile = tiles.find((t) => t.id === tileId) ?? null;
  const isPoints = selectedTile?.scoringMode === "POINTS";
  const availableTiers = useMemo(() => (isPoints ? [] : selectedTile?.tiers ?? []), [selectedTile, isPoints]);
  const availableItems = useMemo(() => (isPoints ? selectedTile?.pointsConfig?.items ?? [] : []), [selectedTile, isPoints]);

  const canSubmit = teamId && tileId && (isPoints ? itemId !== "" : tier !== "");

  async function submit() {
    if (!canSubmit) return;
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/submissions/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isPoints ? { teamId, tileId, itemId, note } : { teamId, tileId, tier, note }),
    });
    setLoading(false);
    if (res.ok) {
      setMessage({ type: "ok", text: "Tile awarded." });
      setNote("");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setMessage({ type: "err", text: body.error ?? "Failed to award tile" });
    }
  }

  return (
    <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5 flex flex-col gap-3 mb-10">
      <h2 className="font-semibold text-purple-100 text-sm">Manually award a tile</h2>
      <p className="text-xs text-purple-700/70 -mt-1.5">Use this if Dink misses a drop — creates an approved submission directly.</p>

      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col gap-1.5 min-w-[160px]">
          <label className={labelCls}>Team</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputCls}>
            <option value="">Select team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <label className={labelCls}>Tile</label>
          <select
            value={tileId}
            onChange={(e) => { setTileId(e.target.value); setTier(""); setItemId(""); }}
            className={inputCls}
          >
            <option value="">Select tile…</option>
            {tiles.filter((t) => t.tiers.length > 0 || (t.pointsConfig?.items.length ?? 0) > 0).map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>

        {isPoints ? (
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className={labelCls}>Item</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : "")}
              disabled={!selectedTile}
              className={`${inputCls} disabled:opacity-50`}
            >
              <option value="">Select item…</option>
              {availableItems.map((it) => (
                <option key={it.id} value={it.id}>{it.name} — {it.basePoints} pts base</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className={labelCls}>Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value ? Number(e.target.value) : "")}
              disabled={!selectedTile}
              className={`${inputCls} disabled:opacity-50`}
            >
              <option value="">Select tier…</option>
              {availableTiers.map((td) => (
                <option key={td.tier} value={td.tier}>T{td.tier} — {td.points} pts</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <label className={labelCls}>Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. confirmed in Discord screenshot" className={inputCls} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={loading || !canSubmit}
          className="self-start bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 text-sm transition-colors"
        >
          {loading ? "Awarding…" : "Award tile"}
        </button>
        {message && (
          <span className={`text-xs ${message.type === "ok" ? "text-green-400" : "text-red-400"}`}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
