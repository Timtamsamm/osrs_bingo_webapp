"use client";

import { useState } from "react";
import Image from "next/image";

type Status = "PENDING" | "APPROVED" | "REJECTED";

export interface TileData {
  id: string;
  title: string;
  points: number;
  pointsPerSubmission: number;
  requiredCount: number;
  imageUrl: string | null;
  userSubmissions: Array<{ status: Status; teamMember: string | null }>;
}

interface Props {
  player: { id: string; username: string; earned: number; teamMembers: string[] };
  tiles: TileData[];
  totalPoints: number;
  rank: number | null;
  isCurrentUser: boolean;
  medals: string[];
}

export default function LeaderboardRow({ player, tiles, totalPoints, rank, isCurrentUser, medals }: Props) {
  const [expanded, setExpanded] = useState(false);
  const pct = totalPoints > 0 ? (player.earned / totalPoints) * 100 : 0;

  // Per-member stats — counts any non-rejected submission (mirrors main leaderboard logic)
  const memberStats: Map<string, { tileIds: Set<string>; points: number }> = new Map();
  for (const tile of tiles) {
    for (const sub of tile.userSubmissions) {
      if (sub.status === "REJECTED" || !sub.teamMember) continue;
      const existing = memberStats.get(sub.teamMember) ?? { tileIds: new Set<string>(), points: 0 };
      existing.tileIds.add(tile.id);
      existing.points += tile.pointsPerSubmission;
      memberStats.set(sub.teamMember, existing);
    }
  }

  const memberRows = player.teamMembers.map((name) => ({
    name,
    tiles: memberStats.get(name)?.tileIds.size ?? 0,
    points: memberStats.get(name)?.points ?? 0,
  }));

  return (
    <div className={`rounded-xl border overflow-hidden ${isCurrentUser ? "border-amber-500/40" : "border-gray-800"}`}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={`w-full px-5 py-4 flex items-center gap-4 transition-colors ${
          isCurrentUser ? "bg-amber-500/10 hover:bg-amber-500/20" : "bg-gray-900 hover:bg-gray-800"
        }`}
      >
        {/* Rank */}
        <div className="w-8 text-center shrink-0">
          {rank !== null && rank <= 3 ? (
            <span className="text-xl leading-none">{medals[rank - 1]}</span>
          ) : (
            <span className="text-sm font-semibold text-gray-500">{rank ?? "—"}</span>
          )}
        </div>

        {/* Name + progress bar */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`font-semibold truncate ${isCurrentUser ? "text-amber-300" : "text-white"}`}>
              {player.username}
            </span>
            {isCurrentUser && <span className="text-xs text-amber-500 shrink-0">you</span>}
          </div>
          {player.teamMembers.length > 0 && (
            <p className="text-xs text-gray-500 truncate mb-1.5">
              {player.teamMembers.join(" · ")}
            </p>
          )}
          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${isCurrentUser ? "bg-amber-400" : "bg-green-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Points + chevron */}
        <div className="shrink-0 flex items-center gap-3">
          <div className="text-right">
            <span className={`font-semibold tabular-nums ${isCurrentUser ? "text-amber-400" : "text-white"}`}>
              {+player.earned.toFixed(1)}
            </span>
            {totalPoints > 0 && <span className="text-gray-500 text-sm"> / {+totalPoints.toFixed(1)}</span>}
            <span className="text-gray-500 text-sm"> pts</span>
          </div>
          <span
            className="text-gray-500 text-sm transition-transform duration-200"
            style={{ display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▾
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-800 bg-gray-950 p-4 flex flex-col gap-4">
          {/* Mini 5×5 board */}
          <div className="grid grid-cols-5 gap-1.5">
            {tiles.map((tile) => {
              const approved = tile.userSubmissions.filter((s) => s.status === "APPROVED").length;
              const active = tile.userSubmissions.filter((s) => s.status !== "REJECTED").length;
              const onlyRejected = tile.userSubmissions.length > 0 && active === 0;
              const completed = approved >= tile.requiredCount;
              const inProgress = tile.requiredCount > 1 && active > 0 && !completed;
              const awaiting = !completed && !inProgress && active > 0;

              const borderStyle = completed ? "border-green-500"
                : inProgress ? "border-orange-500"
                : awaiting ? "border-green-700"
                : onlyRejected ? "border-red-700"
                : "border-gray-700";

              const bgStyle = completed ? "bg-green-500/15"
                : inProgress ? "bg-orange-500/10"
                : awaiting ? "bg-green-900/15"
                : onlyRejected ? "bg-red-900/10"
                : "bg-gray-900";

              const textStyle = completed ? "text-green-200"
                : inProgress ? "text-orange-200"
                : "text-gray-300";

              return (
                <div
                  key={tile.id}
                  className={`relative aspect-square rounded-lg border-2 overflow-hidden ${borderStyle} ${bgStyle}`}
                >
                  {tile.imageUrl && (
                    <Image src={tile.imageUrl} alt={tile.title} fill sizes="120px" className="object-cover" />
                  )}
                  {tile.imageUrl && <div className={`absolute inset-0 ${bgStyle} opacity-50`} />}

                  <div className="absolute top-1 right-1 z-10">
                    {completed    && <span className="text-green-400 text-xs leading-none">✓</span>}
                    {inProgress   && <span className="text-orange-400 font-bold leading-none" style={{ fontSize: "9px" }}>{active}/{tile.requiredCount}</span>}
                    {awaiting     && <span className="block w-1.5 h-1.5 rounded-full bg-green-500" />}
                    {onlyRejected && <span className="text-red-400 text-xs leading-none">✕</span>}
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 z-10 px-1 pt-3 pb-1 text-center bg-gradient-to-t from-black/80 to-transparent">
                    <p className={`line-clamp-2 leading-tight ${textStyle}`} style={{ fontSize: "9px" }}>
                      {tile.title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-member breakdown */}
          {memberRows.length > 0 && (
            <div className="border-t border-gray-800 pt-4">
              <p className="text-xs text-gray-500 mb-3">Team members</p>
              <div className="flex flex-col gap-2">
                {memberRows.map((m) => {
                  const memberPct = totalPoints > 0 ? (m.points / totalPoints) * 100 : 0;
                  return (
                    <div key={m.name} className="flex items-center gap-3">
                      <span className="text-sm text-gray-300 w-28 truncate shrink-0">{m.name}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500/70"
                          style={{ width: `${memberPct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 tabular-nums shrink-0 w-14 text-right">
                        {m.tiles} {m.tiles === 1 ? "tile" : "tiles"}
                      </span>
                      <span className="text-xs text-amber-400 tabular-nums shrink-0 w-14 text-right">
                        {+m.points.toFixed(1)} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
