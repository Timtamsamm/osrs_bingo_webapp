"use client";

import { useState } from "react";
import { diffKCs, type BossKCs } from "@/lib/temple";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; kills: Array<{ boss: string; gained: number }> }
  | { status: "error"; message: string };

interface Props {
  memberName: string;
  snapshot: BossKCs | null;
}

export default function PlayerCard({ memberName, snapshot }: Props) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [expanded, setExpanded] = useState(false);

  async function loadKills() {
    setLoadState({ status: "loading" });
    try {
      const res = await fetch(`/api/players/${encodeURIComponent(memberName)}`);
      const json = await res.json();
      if (!res.ok) {
        setLoadState({ status: "error", message: json.error ?? "Request failed" });
        return;
      }
      const current = json.bosses as BossKCs;
      const kills = snapshot
        ? Object.entries(diffKCs(current, snapshot))
            .map(([boss, gained]) => ({ boss, gained }))
            .sort((a, b) => b.gained - a.gained)
        : Object.entries(current)
            .filter(([, v]) => v > 0)
            .map(([boss, gained]) => ({ boss, gained }))
            .sort((a, b) => b.gained - a.gained);
      setLoadState({ status: "done", kills });
    } catch {
      setLoadState({ status: "error", message: "Network error" });
    }
  }

  const hasSnapshot = snapshot !== null;

  return (
    <div className="rounded-xl border border-stone-700/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-5 py-4 flex items-center gap-4 bg-stone-900/90 hover:bg-stone-800/90 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white">{memberName}</p>
          {!hasSnapshot && (
            <p className="text-xs text-amber-500 mt-0.5">No snapshot — kills will show current totals</p>
          )}
        </div>
        <span
          className="text-gray-500 text-sm transition-transform duration-200 shrink-0"
          style={{ display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="border-t border-stone-700/60 bg-stone-950/90 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {loadState.status === "idle" && (
              <button
                type="button"
                onClick={loadKills}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                {hasSnapshot ? "Load kills this event" : "Load current kills"}
              </button>
            )}
            {loadState.status === "loading" && (
              <p className="text-sm text-gray-500">Loading…</p>
            )}
            {loadState.status === "done" && (
              <button
                type="button"
                onClick={loadKills}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                title="Refresh kill counts"
              >
                ↻ Refresh
              </button>
            )}
            {loadState.status === "error" && (
              <>
                <p className="text-sm text-red-400">{loadState.message}</p>
                <button
                  type="button"
                  onClick={loadKills}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ↻ Retry
                </button>
              </>
            )}
          </div>

          {loadState.status === "done" && loadState.kills.length === 0 && (
            <p className="text-sm text-gray-500">No boss kills found.</p>
          )}

          {loadState.status === "done" && loadState.kills.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                {hasSnapshot ? "Kills during this event" : "Current kill counts"}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {loadState.kills.map((k) => (
                  <div key={k.boss} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-300 truncate">{k.boss}</span>
                    <span className="text-sm text-green-400 tabular-nums shrink-0 font-semibold">{k.gained}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
