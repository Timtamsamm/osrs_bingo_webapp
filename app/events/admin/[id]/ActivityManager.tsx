"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LocalTime from "@/app/components/LocalTime";
import { confirmDialog } from "@/app/components/ConfirmDialog";

export interface ActivityItem {
  id: string;
  type: "KILL" | "LOOT";
  player: string;
  /** "Whisperer · KC 95" or "157 × Adamantite ore" */
  title: string;
  /** Boss/source for drops, kill time for kills — pre-formatted. */
  detail: string | null;
  value: string | null;
  at: string;
}

type Filter = "all" | "KILL" | "LOOT";

export default function ActivityManager({ eventId, items }: { eventId: string; items: ActivityItem[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const shown = items.filter(
    (i) => (filter === "all" || i.type === filter) && (!q || i.player.toLowerCase().includes(q) || i.title.toLowerCase().includes(q))
  );
  const kills = items.filter((i) => i.type === "KILL").length;

  async function remove(item: ActivityItem) {
    if (!(await confirmDialog({ title: `Remove this ${item.type === "KILL" ? "kill" : "drop"}?`, message: `${item.player}: ${item.title}`, confirmLabel: "Remove", danger: true }))) return;
    setRemoving(item.id);
    await fetch(`/api/admin/events/${eventId}/activity?activityId=${item.id}`, { method: "DELETE" });
    setRemoving(null);
    router.refresh();
  }

  const tab = (value: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
        filter === value ? "bg-purple-700 text-white" : "text-purple-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-semibold text-purple-100 text-sm">Kills &amp; drops</h2>
        <p className="text-xs text-purple-500/80 mt-1">
          Everything recorded for this event, newest first. Remove anything fake or wrong — it disappears from the public page
          straight away. Removing a player&apos;s kills doesn&apos;t remove them from attendance.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-[#130a28] border border-purple-900/50 rounded-lg p-0.5">
          {tab("all", `All (${items.length})`)}
          {tab("KILL", `Kills (${kills})`)}
          {tab("LOOT", `Drops (${items.length - kills})`)}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by player or item…"
          className="flex-1 min-w-40 bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-1.5 text-white text-sm placeholder-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
        />
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-purple-600/70">{items.length ? "Nothing matches." : "Nothing recorded yet."}</p>
      ) : (
        <ul className="divide-y divide-purple-900/30 max-h-[32rem] overflow-y-auto -mx-1 px-1">
          {shown.map((i) => (
            <li key={i.id} className="py-2 flex items-center gap-3 text-sm">
              <span
                className={`text-[10px] uppercase tracking-wider font-semibold rounded px-1.5 py-0.5 shrink-0 ${
                  i.type === "KILL" ? "bg-purple-800/50 text-purple-200" : "bg-amber-500/15 text-amber-300"
                }`}
              >
                {i.type === "KILL" ? "Kill" : "Drop"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-purple-100 truncate">{i.title}</p>
                <p className="text-[11px] text-purple-500/80 truncate">
                  {i.player}
                  {i.detail ? ` · ${i.detail}` : ""} · <LocalTime date={i.at} dateStyle="short" timeStyle="medium" />
                </p>
              </div>
              {i.value && <span className="text-amber-300/90 tabular-nums text-xs shrink-0">{i.value}</span>}
              <button
                onClick={() => remove(i)}
                disabled={removing === i.id}
                className="text-xs text-purple-500 hover:text-red-400 disabled:opacity-40 transition-colors shrink-0"
              >
                {removing === i.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
