"use client";

import { useState } from "react";
import PlayerCard from "./PlayerCard";
import type { BossKCs } from "@/lib/temple";

export type PlayerEntry = {
  memberName: string;
  teamName: string;
  snapshot: BossKCs | null;
  ehb: number | null;
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
    if (teamFilter && p.teamName !== teamFilter) return false;
    if (bossFilter && (!p.snapshot || !p.snapshot[bossFilter])) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTeamFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              teamFilter === null
                ? "text-white purple-glow-sm"
                : "bg-[#0e0820] border border-purple-900/40 text-purple-400 hover:text-purple-200"
            }`}
            style={teamFilter === null ? { backgroundColor: "rgb(var(--accent) / 0.55)" } : undefined}
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
                  ? "text-white purple-glow-sm"
                  : "bg-[#0e0820] border border-purple-900/40 text-purple-400 hover:text-purple-200"
              }`}
              style={teamFilter === team ? { backgroundColor: "rgb(var(--accent) / 0.55)" } : undefined}
            >
              {team}
            </button>
          ))}
        </div>

        {bosses.length > 0 && (
          <select
            value={bossFilter}
            onChange={(e) => setBossFilter(e.target.value)}
            className="bg-[#0e0820] border border-purple-900/40 rounded-lg px-3 py-1 text-xs text-purple-300 focus:outline-none focus:border-purple-500 ml-auto"
          >
            <option value="">All bosses</option>
            {bosses.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-purple-500/60 text-sm">No players match the current filters.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(({ memberName, teamName, snapshot, ehb }) => (
            <div key={memberName}>
              <p className="text-xs text-purple-700/70 mb-1 px-1">{teamName}</p>
              <PlayerCard memberName={memberName} snapshot={snapshot} ehb={ehb} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
