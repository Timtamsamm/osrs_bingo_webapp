"use client";

import { useState } from "react";
import Link from "next/link";
import ZoomableThumbnail from "@/app/components/ZoomableThumbnail";

export interface DropEntry {
  id: string;
  tier: number | null;
  source: string;
  dinkSource: string | null;
  teamMember: string | null;
  dinkItemName: string | null;
  pointsAwarded: number | null;
  imageUrl: string | null;
  createdAt: Date;
  tile: { title: string };
  team: { id: string; name: string; color: string } | null;
}

export default function RecentDropsFilter({ drops, bosses }: { drops: DropEntry[]; bosses: string[] }) {
  const [bossFilter, setBossFilter] = useState<string>("");

  const filtered = bossFilter ? drops.filter((d) => d.dinkSource === bossFilter) : drops;

  return (
    <div className="flex flex-col gap-4">
      {bosses.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={bossFilter}
            onChange={(e) => setBossFilter(e.target.value)}
            className="bg-[#0e0820] border border-purple-900/40 rounded-lg px-3 py-1.5 text-xs text-purple-300 focus:outline-none focus:border-purple-500"
          >
            <option value="">All bosses</option>
            {bosses.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          {bossFilter && (
            <button
              type="button"
              onClick={() => setBossFilter("")}
              className="text-xs text-purple-600 hover:text-purple-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-purple-600/70 text-center py-8">No drops match that filter.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#130a28]/60">
              {d.imageUrl && <ZoomableThumbnail src={d.imageUrl} />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-purple-100 truncate">
                  {d.tile.title}{" "}
                  {d.tier != null && <span className="text-purple-500">T{d.tier}</span>}
                  {d.dinkItemName && <span className="text-purple-500"> · {d.dinkItemName}</span>}
                  {d.pointsAwarded != null && <span className="text-purple-500"> · +{+d.pointsAwarded.toFixed(1)}pts</span>}
                </p>
                <p className="text-[11px] text-purple-700/70 flex items-center gap-1.5">
                  {d.team && (
                    <Link href={`/bingo/team/${d.team.id}`} className="inline-flex items-center gap-1 hover:text-purple-400 transition-colors">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.team.color }} />
                      {d.team.name}
                    </Link>
                  )}
                  {d.teamMember && <span>· {d.teamMember}</span>}
                  {d.dinkSource && <span>· from {d.dinkSource}</span>}
                  <span>· {d.source}</span>
                </p>
              </div>
              <span className="text-[11px] text-purple-700/60 shrink-0" suppressHydrationWarning>
                {new Date(d.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
