"use client";

import { useState } from "react";
import PlayerCard from "./PlayerCard";
import type { BossKCs } from "@/lib/temple";

export type PlayerEntry = {
  memberName: string;
  teamUsername: string;
  snapshot: BossKCs | null;
};

interface Props {
  players: PlayerEntry[];
  teams: string[];
  bosses: string[];
}

export default function PlayersFilter({ players, teams, bosses }: Props) {
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [bossFilter, setBossFilter] = useState<string>("");

  const filtered = players.filter((p) => {
    if (teamFilter && p.teamUsername !== teamFilter) return false;
    if (bossFilter && (!p.snapshot || !p.snapshot[bossFilter])) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Team filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTeamFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              teamFilter === null
                ? "bg-amber-500 text-gray-950"
                : "bg-stone-800/80 text-stone-400 hover:text-white"
            }`}
          >
            All teams
          </button>
          {teams.map((team) => (
            <button
              key={team}
              type="button"
              onClick={() => setTeamFilter(teamFilter === team ? null : team)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                teamFilter === team
                  ? "bg-amber-500 text-gray-950"
                  : "bg-stone-800/80 text-stone-400 hover:text-white"
              }`}
            >
              {team}
            </button>
          ))}
        </div>

        {/* Boss filter dropdown */}
        {bosses.length > 0 && (
          <select
            value={bossFilter}
            onChange={(e) => setBossFilter(e.target.value)}
            className="bg-stone-800/80 border border-stone-700/60 rounded-lg px-3 py-1 text-xs text-gray-300 focus:outline-none focus:border-amber-500 ml-auto"
          >
            <option value="">All bosses</option>
            {bosses.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        )}
      </div>

      {/* Player list */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm">No players match the current filters.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(({ memberName, teamUsername, snapshot }) => (
            <div key={memberName}>
              <p className="text-xs text-gray-600 mb-1 px-1">{teamUsername}</p>
              <PlayerCard memberName={memberName} snapshot={snapshot} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
