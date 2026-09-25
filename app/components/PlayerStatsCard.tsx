"use client";

import { useState } from "react";
import Link from "next/link";
import type { TempleStats, CollectionLogStats } from "@/lib/templeosrs";

type CollectionLogState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; stats: CollectionLogStats | null }
  | { status: "error" };

type TempleState =
  | { status: "loading" }
  | { status: "done"; stats: TempleStats | null }
  | { status: "error" };

interface Props {
  memberName: string;
  /**
   * Pass a value (including null) to use it directly — the card never fetches.
   * Omit entirely to fetch TempleOSRS stats lazily the first time the card is
   * expanded, so a page listing hundreds of names doesn't fan out on load.
   */
  temple?: TempleStats | null;
  /** Rank medal/number shown before the name (e.g. "🥇" or "4"). */
  rank?: React.ReactNode;
  /** Team badge — omit for a bare player card with no team context. */
  team?: { id: string; name: string; color: string };
  /** Bingo points/drops shown in the collapsed row, alongside EHB from temple. */
  points?: number;
  drops?: number;
}

const CLUE_LABELS: Array<[keyof TempleStats["clues"], string]> = [
  ["beginner", "Beginner"],
  ["easy", "Easy"],
  ["medium", "Medium"],
  ["hard", "Hard"],
  ["elite", "Elite"],
  ["master", "Master"],
];

export default function PlayerStatsCard({ memberName, temple: providedTemple, rank, team, points, drops }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [clState, setClState] = useState<CollectionLogState>({ status: "idle" });
  const [fetchedTemple, setFetchedTemple] = useState<TempleState | null>(null);

  const onDemand = providedTemple === undefined;
  const temple = onDemand ? (fetchedTemple?.status === "done" ? fetchedTemple.stats : null) : providedTemple;
  const templeLoading = onDemand && fetchedTemple?.status === "loading";
  const templeError = onDemand && fetchedTemple?.status === "error";
  const showingStats = points != null || drops != null || team != null;

  async function loadTempleStats() {
    setFetchedTemple({ status: "loading" });
    try {
      const res = await fetch(`/api/members/${encodeURIComponent(memberName)}/temple`);
      const json = await res.json();
      if (!res.ok) { setFetchedTemple({ status: "error" }); return; }
      setFetchedTemple({ status: "done", stats: json.stats });
    } catch {
      setFetchedTemple({ status: "error" });
    }
  }

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next && onDemand && fetchedTemple === null) loadTempleStats();
  }

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
    <div>
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full px-5 py-3.5 flex items-center gap-3 bg-surface/60 hover:bg-raised/60 transition-colors text-left"
      >
        {rank !== undefined && <span className="text-sm w-6 text-center shrink-0 select-none">{rank}</span>}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{memberName}</p>
          {!onDemand && !temple && (
            <p className="text-xs text-amber-500 mt-0.5">Not tracked on TempleOSRS yet</p>
          )}
          {onDemand && fetchedTemple?.status === "done" && !temple && (
            <p className="text-xs text-amber-500 mt-0.5">Not tracked on TempleOSRS yet</p>
          )}
        </div>
        {showingStats && (
          <div className="flex items-center gap-4 sm:gap-6 shrink-0 text-right">
            {team && (
              <Link
                href={`/bingo/team/${team.id}`}
                onClick={(e) => e.stopPropagation()}
                className="hidden sm:flex w-24 shrink-0 items-center gap-1.5 text-xs text-purple-300 hover:text-purple-100 transition-colors truncate"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: team.color, boxShadow: `0 0 4px ${team.color}` }} />
                <span className="truncate">{team.name}</span>
              </Link>
            )}
            {points != null && (
              <div className="w-12 sm:w-16">
                <p className="text-sm font-bold text-white tabular-nums">{+points.toFixed(1)}</p>
                <p className="text-[10px] text-purple-600 uppercase tracking-wide">Pts</p>
              </div>
            )}
            {drops != null && (
              <div className="w-10 sm:w-14">
                <p className="text-sm text-purple-200 tabular-nums">{drops}</p>
                <p className="text-[10px] text-purple-600 uppercase tracking-wide">Drops</p>
              </div>
            )}
            <div className="w-10 sm:w-14">
              <p className="text-sm font-semibold text-amber-400 tabular-nums">{temple ? Math.round(temple.ehb) : "—"}</p>
              <p className="text-[10px] text-purple-600 uppercase tracking-wide">EHB</p>
            </div>
          </div>
        )}
        <span
          className="text-purple-600 text-sm transition-transform duration-200 shrink-0"
          style={{ display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {expanded && temple && (
        <div className="border-t border-purple-900/30 bg-[#130a28]/60 p-4 flex flex-col gap-5">
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-purple-600">EHP </span>
              <span className="text-green-400 font-semibold tabular-nums">{Math.round(temple.ehp)}</span>
            </div>
            <div>
              <span className="text-purple-600">EHB </span>
              <span className="text-amber-400 font-semibold tabular-nums">{Math.round(temple.ehb)}</span>
            </div>
            {temple.skills.Overall && (
              <div>
                <span className="text-purple-600">Total level </span>
                <span className="text-white font-semibold tabular-nums">{temple.skills.Overall.level}</span>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-purple-500 mb-2">Skills</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
              {Object.entries(temple.skills).map(([skill, s]) => (
                <div key={skill} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-purple-300 truncate">{skill}</span>
                  <span className="text-sm text-blue-400 tabular-nums shrink-0 font-semibold">{s.level}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-purple-500 mb-2">Clue scrolls</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-1.5">
              {CLUE_LABELS.map(([key, label]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-[11px] text-purple-700/70">{label}</span>
                  <span className="text-sm text-teal-400 tabular-nums font-semibold">{temple.clues[key]}</span>
                </div>
              ))}
            </div>
          </div>

          {bossesWithKc.length > 0 && (
            <div>
              <p className="text-xs text-purple-500 mb-2">Bosses &amp; activities</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {bossesWithKc.map(([boss, s]) => (
                  <div key={boss} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-purple-300 truncate">{boss}</span>
                    <span className="text-sm text-green-400 tabular-nums shrink-0 font-semibold">{s.kc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-purple-500 mb-2">Collection log</p>
            {clState.status === "idle" && (
              <button
                type="button"
                onClick={loadCollectionLog}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                Load collection log
              </button>
            )}
            {clState.status === "loading" && <p className="text-sm text-purple-600">Loading…</p>}
            {clState.status === "error" && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-red-400">Failed to load</p>
                <button type="button" onClick={loadCollectionLog} className="text-xs text-purple-600 hover:text-purple-300 transition-colors">
                  ↻ Retry
                </button>
              </div>
            )}
            {clState.status === "done" && !clState.stats && (
              <p className="text-sm text-purple-600">Not available for this player.</p>
            )}
            {clState.status === "done" && clState.stats && (
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-purple-600">Items </span>
                  <span className="text-white font-semibold tabular-nums">{clState.stats.finished}/{clState.stats.available}</span>
                </div>
                <div>
                  <span className="text-purple-600">Categories </span>
                  <span className="text-white font-semibold tabular-nums">{clState.stats.categoriesFinished}/{clState.stats.categoriesAvailable}</span>
                </div>
                <div>
                  <span className="text-purple-600">EHC </span>
                  <span className="text-white font-semibold tabular-nums">{Math.round(clState.stats.ehc)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {expanded && templeLoading && (
        <div className="border-t border-purple-900/30 bg-[#130a28]/60 p-4">
          <p className="text-sm text-purple-600">Loading TempleOSRS stats…</p>
        </div>
      )}

      {expanded && templeError && (
        <div className="border-t border-purple-900/30 bg-[#130a28]/60 p-4 flex items-center gap-3">
          <p className="text-sm text-red-400">Failed to load stats</p>
          <button type="button" onClick={loadTempleStats} className="text-xs text-purple-600 hover:text-purple-300 transition-colors">↻ Retry</button>
        </div>
      )}

      {expanded && !temple && !templeLoading && !templeError && (
        <div className="border-t border-purple-900/30 bg-[#130a28]/60 p-4">
          <p className="text-sm text-purple-600">This RSN hasn&apos;t been looked up on TempleOSRS yet, so no stats are available. Visiting their profile at templeosrs.com once will start tracking them.</p>
        </div>
      )}
    </div>
  );
}
