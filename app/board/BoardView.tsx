"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export type TileSummary = {
  id: string;
  title: string;
  description: string | null;
  points: number;
  pointsPerSubmission: number;
  requiredCount: number;
  imageUrl: string | null;
  active: number;
  approved: number;
  completed: boolean;
  inProgress: boolean;
  awaiting: boolean;
  onlyRejected: boolean;
};

type View = "grid" | "list";

interface Props {
  tiles: TileSummary[];
}

function tileStyles(tile: TileSummary) {
  if (tile.completed)    return { border: "border-green-500",      bg: "bg-green-500/15",   text: "text-green-200" };
  if (tile.inProgress)   return { border: "border-orange-500",     bg: "bg-orange-500/10",  text: "text-orange-200" };
  if (tile.awaiting)     return { border: "border-green-700",      bg: "bg-green-900/15",   text: "text-gray-200" };
  if (tile.onlyRejected) return { border: "border-red-700",        bg: "bg-red-900/10",     text: "text-gray-300" };
  return                        { border: "border-stone-600/80 hover:border-amber-700/60", bg: "bg-stone-900/80", text: "text-gray-300" };
}

function StatusBadge({ tile }: { tile: TileSummary }) {
  if (tile.completed)    return <span className="text-xs font-semibold text-green-400">Completed</span>;
  if (tile.inProgress)   return <span className="text-xs font-semibold text-orange-400">{tile.active}/{tile.requiredCount} submitted</span>;
  if (tile.awaiting)     return <span className="text-xs font-semibold text-amber-400">Awaiting review</span>;
  if (tile.onlyRejected) return <span className="text-xs font-semibold text-red-400">Rejected</span>;
  return <span className="text-xs text-stone-500">Not started</span>;
}

export default function BoardView({ tiles }: Props) {
  const [view, setView] = useState<View>("grid");

  useEffect(() => {
    const saved = localStorage.getItem("boardView") as View | null;
    if (saved === "grid" || saved === "list") setView(saved);
  }, []);

  function switchView(v: View) {
    setView(v);
    localStorage.setItem("boardView", v);
  }

  return (
    <div>
      {/* Toggle */}
      <div className="flex justify-end mb-3">
        <div className="flex rounded-lg border border-stone-700/60 overflow-hidden">
          <button
            type="button"
            onClick={() => switchView("grid")}
            title="Grid view"
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              view === "grid" ? "bg-stone-700 text-white" : "bg-stone-900/80 text-stone-400 hover:text-white"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => switchView("list")}
            title="List view"
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-stone-700/60 ${
              view === "list" ? "bg-stone-700 text-white" : "bg-stone-900/80 text-stone-400 hover:text-white"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="5" width="18" height="2" rx="1"/><rect x="3" y="11" width="18" height="2" rx="1"/><rect x="3" y="17" width="18" height="2" rx="1"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Grid view */}
      {view === "grid" && (
        <div className="grid grid-cols-5 gap-2">
          {tiles.map((tile) => {
            const { border, bg, text } = tileStyles(tile);
            return (
              <Link
                key={tile.id}
                href={`/submit?tileId=${tile.id}`}
                className={`relative aspect-square rounded-xl border-2 text-xs font-medium transition-all hover:scale-[1.03] overflow-hidden ${border} ${bg}`}
              >
                {tile.imageUrl && (
                  <Image src={tile.imageUrl} alt={tile.title} fill sizes="160px" className="object-cover" />
                )}
                {tile.imageUrl && <div className={`absolute inset-0 ${bg} opacity-50`} />}

                <div className="absolute top-1.5 right-1.5 z-10">
                  {tile.completed    && <span className="text-green-400 text-sm leading-none">✓</span>}
                  {tile.inProgress   && <span className="text-orange-400 text-xs font-bold leading-none">{tile.active}/{tile.requiredCount}</span>}
                  {tile.awaiting     && <span className="block w-2 h-2 rounded-full bg-green-500" />}
                  {tile.onlyRejected && <span className="text-red-400 text-sm leading-none">✕</span>}
                </div>

                <div className="absolute bottom-0 left-0 right-0 z-10 px-1.5 pt-4 pb-1.5 text-center bg-gradient-to-t from-black/80 to-transparent">
                  <p className={`line-clamp-2 leading-tight ${text}`}>{tile.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{+tile.points.toFixed(1)}pt</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="flex flex-col gap-1.5">
          {tiles.map((tile) => {
            const { border, bg } = tileStyles(tile);
            return (
              <Link
                key={tile.id}
                href={`/submit?tileId=${tile.id}`}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all hover:brightness-110 ${border} ${bg}`}
              >
                {tile.imageUrl && (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                    <Image src={tile.imageUrl} alt={tile.title} fill sizes="40px" className="object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{tile.title}</p>
                  {tile.description && (
                    <p className="text-xs text-stone-400 truncate mt-0.5">{tile.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <StatusBadge tile={tile} />
                  <span className="text-xs text-stone-400 tabular-nums w-12 text-right">{+tile.points.toFixed(1)} pts</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-green-500 bg-green-500/15" />Completed</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-orange-500 bg-orange-500/10" />In progress</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-green-700 bg-green-900/15" />Awaiting review</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-red-700 bg-red-900/10" />Rejected</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-stone-600/80 bg-stone-900/80" />Not started</span>
      </div>
    </div>
  );
}
