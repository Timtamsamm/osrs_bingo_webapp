"use client";

import { useMemo, useState } from "react";
import PlayerStatsCard from "@/app/components/PlayerStatsCard";
import type { WomMember } from "@/lib/wiseoldman";

interface Props {
  members: WomMember[];
}

type SortKey = "ehb" | "ehp" | "name";

const roleLabels: Record<string, string> = {
  owner: "Owner",
  deputy_owner: "Deputy Owner",
  administrator: "Admin",
  moderator: "Moderator",
};

export default function MembersTable({ members }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ehb");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? members.filter((m) => m.displayName.toLowerCase().includes(q)) : members;
    return [...list].sort((a, b) => {
      if (sortKey === "name") return a.displayName.localeCompare(b.displayName);
      return b[sortKey] - a[sortKey];
    });
  }, [members, search, sortKey]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members…"
          className="bg-[#0e0820] border border-purple-900/40 rounded-lg px-3 py-1.5 text-sm text-white placeholder-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600/60"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="bg-[#0e0820] border border-purple-900/40 rounded-lg px-3 py-1.5 text-sm text-purple-300 focus:outline-none focus:border-purple-500"
        >
          <option value="ehb">Sort by EHB</option>
          <option value="ehp">Sort by EHP</option>
          <option value="name">Sort by name</option>
        </select>
        <span className="text-xs text-purple-600 ml-auto">{filtered.length} / {members.length} members</span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-purple-500/60 text-sm text-center py-12">No members match &quot;{search}&quot;.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((m) => (
            <PlayerStatsCard
              key={m.username}
              memberName={m.displayName}
              headerRight={
                <>
                  {roleLabels[m.role] && (
                    <span className="text-[10px] uppercase tracking-wide text-purple-400 border border-purple-800/50 rounded-full px-2 py-0.5 shrink-0">
                      {roleLabels[m.role]}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-amber-400 tabular-nums shrink-0">{Math.round(m.ehb)} EHB</span>
                  <span className="text-xs font-semibold text-green-400 tabular-nums shrink-0">{Math.round(m.ehp)} EHP</span>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
