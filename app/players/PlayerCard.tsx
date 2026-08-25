"use client";

import { useState } from "react";
import type { TempleStats, CollectionLogStats } from "@/lib/templeosrs";

type CollectionLogState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; stats: CollectionLogStats | null }
  | { status: "error" };

interface Props {
  memberName: string;
  temple: TempleStats | null;
}

const CLUE_LABELS: Array<[keyof TempleStats["clues"], string]> = [
  ["beginner", "Beginner"],
  ["easy", "Easy"],
  ["medium", "Medium"],
  ["hard", "Hard"],
  ["elite", "Elite"],
  ["master", "Master"],
];

export default function PlayerCard({ memberName, temple }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [clState, setClState] = useState<CollectionLogState>({ status: "idle" });

  async function loadCollectionLog() {
    setClState({ status: "loading" });
    try {
      const res = await fetch(`/api/players/${encodeURIComponent(memberName)}/collection-log`);
      const json = await res.json();
      if (!res.ok) {
        setClState({ status: "error" });
        return;
      }
      setClState({ status: "done", stats: json.stats });
    } catch {
      setClState({ status: "error" });
    }
  }

  const bossesWithKc = temple
    ? Object.entries(temple.bosses)
        .filter(([, s]) => s.kc > 0)
        .sort((a, b) => b[1].kc - a[1].kc)
    : [];

  return (
    <div className="rounded-xl border border-stone-700/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-5 py-4 flex items-center gap-4 bg-stone-900/90 hover:bg-stone-800/90 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-white">{memberName}</p>
            {temple && (
              <span className="text-xs font-semibold text-amber-400 tabular-nums shrink-0">{Math.round(temple.ehb)} EHB</span>
            )}
          </div>
          {!temple && (
            <p className="text-xs text-amber-500 mt-0.5">Not tracked on TempleOSRS yet</p>
          )}
        </div>
        <span
          className="text-gray-500 text-sm transition-transform duration-200 shrink-0"
          style={{ display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {expanded && temple && (
        <div className="border-t border-stone-700/60 bg-stone-950/90 p-4 flex flex-col gap-5">
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-500">EHP </span>
              <span className="text-green-400 font-semibold tabular-nums">{Math.round(temple.ehp)}</span>
            </div>
            <div>
              <span className="text-gray-500">EHB </span>
              <span className="text-amber-400 font-semibold tabular-nums">{Math.round(temple.ehb)}</span>
            </div>
            {temple.skills.Overall && (
              <div>
                <span className="text-gray-500">Total level </span>
                <span className="text-white font-semibold tabular-nums">{temple.skills.Overall.level}</span>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">Skills</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
              {Object.entries(temple.skills).map(([skill, s]) => (
                <div key={skill} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-300 truncate">{skill}</span>
                  <span className="text-sm text-blue-400 tabular-nums shrink-0 font-semibold">{s.level}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">Clue scrolls</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-1.5">
              {CLUE_LABELS.map(([key, label]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-[11px] text-gray-500">{label}</span>
                  <span className="text-sm text-teal-400 tabular-nums font-semibold">{temple.clues[key]}</span>
                </div>
              ))}
            </div>
          </div>

          {bossesWithKc.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Bosses &amp; activities</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {bossesWithKc.map(([boss, s]) => (
                  <div key={boss} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-300 truncate">{boss}</span>
                    <span className="text-sm text-green-400 tabular-nums shrink-0 font-semibold">{s.kc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 mb-2">Collection log</p>
            {clState.status === "idle" && (
              <button
                type="button"
                onClick={loadCollectionLog}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Load collection log
              </button>
            )}
            {clState.status === "loading" && <p className="text-sm text-gray-500">Loading…</p>}
            {clState.status === "error" && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-red-400">Failed to load</p>
                <button type="button" onClick={loadCollectionLog} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  ↻ Retry
                </button>
              </div>
            )}
            {clState.status === "done" && !clState.stats && (
              <p className="text-sm text-gray-500">Not available for this player.</p>
            )}
            {clState.status === "done" && clState.stats && (
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-gray-500">Items </span>
                  <span className="text-white font-semibold tabular-nums">{clState.stats.finished}/{clState.stats.available}</span>
                </div>
                <div>
                  <span className="text-gray-500">Categories </span>
                  <span className="text-white font-semibold tabular-nums">{clState.stats.categoriesFinished}/{clState.stats.categoriesAvailable}</span>
                </div>
                <div>
                  <span className="text-gray-500">EHC </span>
                  <span className="text-white font-semibold tabular-nums">{Math.round(clState.stats.ehc)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {expanded && !temple && (
        <div className="border-t border-stone-700/60 bg-stone-950/90 p-4">
          <p className="text-sm text-gray-500">This RSN hasn&apos;t been looked up on TempleOSRS yet, so no stats are available. Visiting their profile at templeosrs.com once will start tracking them.</p>
        </div>
      )}
    </div>
  );
}
