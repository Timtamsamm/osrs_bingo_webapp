"use client";

import PlayerStatsCard from "@/app/components/PlayerStatsCard";
import type { TempleStats } from "@/lib/templeosrs";

export interface LeaderboardRow {
  rsn: string;
  team: { id: string; name: string; color: string };
  points: number;
  drops: number;
  temple: TempleStats | null;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl overflow-hidden purple-glow-sm">
      <div className="hidden sm:flex items-center gap-3 px-5 py-2.5 border-b border-purple-900/30 bg-surface/40 text-[11px] text-purple-400 uppercase tracking-[0.2em] font-semibold">
        <span className="w-6 text-center shrink-0">#</span>
        <span className="flex-1 min-w-0">Name</span>
        <span className="w-24 shrink-0">Team</span>
        <span className="w-16 text-right shrink-0">Pts</span>
        <span className="w-14 text-right shrink-0">Drops</span>
        <span className="w-14 text-right shrink-0">EHB</span>
        <span className="w-4 shrink-0" />
      </div>
      <div className="divide-y divide-purple-900/20">
        {rows.map((r, i) => (
          <PlayerStatsCard
            key={r.rsn}
            memberName={r.rsn}
            temple={r.temple}
            rank={MEDALS[i] ?? <span className="text-purple-700 text-xs">{i + 1}</span>}
            team={r.team}
            points={r.points}
            drops={r.drops}
          />
        ))}
      </div>
    </div>
  );
}
