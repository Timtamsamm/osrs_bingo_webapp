"use client";

import { useState } from "react";

interface BossItem {
  itemId: number;
  name: string;
}

interface Boss {
  id: string;
  name: string;
  items: BossItem[];
}

export default function BossItemPickerButton({ onAdd }: { onAdd: (items: BossItem[]) => void }) {
  const [open, setOpen] = useState(false);
  const [bosses, setBosses] = useState<Boss[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedBoss, setSelectedBoss] = useState<Boss | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  async function openPicker() {
    setOpen(true);
    setSelectedBoss(null);
    setChecked(new Set());
    setSearch("");
    // Refetch every open rather than caching — an admin might just have
    // fixed a wrong item on the Boss Items page and come straight back here.
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bosses");
      if (res.ok) {
        const { bosses: fetched } = await res.json();
        setBosses(fetched);
      }
    } finally {
      setLoading(false);
    }
  }

  function backToBossList() {
    setSelectedBoss(null);
    setChecked(new Set());
  }

  function toggle(itemId: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function confirmAdd() {
    if (!selectedBoss) return;
    const items = selectedBoss.items.filter((i) => checked.has(i.itemId));
    onAdd(items);
    setOpen(false);
  }

  const filteredBosses = (bosses ?? []).filter((b) => b.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className="text-[10px] text-purple-400 hover:text-purple-200 underline decoration-dotted transition-colors shrink-0"
      >
        + Add from boss
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#0e0820] border border-purple-900/50 rounded-2xl max-w-sm w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-purple-900/30 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-purple-100">{selectedBoss ? selectedBoss.name : "Choose a boss"}</p>
                <button type="button" onClick={() => setOpen(false)} className="text-purple-500 hover:text-white transition-colors text-lg leading-none" aria-label="Close">
                  ✕
                </button>
              </div>
              {!selectedBoss && (
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bosses..."
                  className="w-full bg-[#130a28] border border-purple-900/50 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loading && <p className="text-sm text-purple-600/70 p-2">Loading...</p>}
              {!loading && !selectedBoss &&
                filteredBosses.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBoss(b)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-purple-900/30 flex items-center justify-between gap-2 transition-colors"
                  >
                    <span className="text-sm text-purple-200">{b.name}</span>
                    <span className="text-[10px] text-purple-600 shrink-0">{b.items.length}</span>
                  </button>
                ))}
              {!loading && !selectedBoss && filteredBosses.length === 0 && (
                <p className="text-sm text-purple-600/70 p-2">No bosses found.</p>
              )}
              {selectedBoss &&
                selectedBoss.items.map((i) => (
                  <label key={i.itemId} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-purple-900/20 cursor-pointer">
                    <input type="checkbox" checked={checked.has(i.itemId)} onChange={() => toggle(i.itemId)} className="accent-purple-600" />
                    <span className="text-sm text-purple-200">{i.name}</span>
                  </label>
                ))}
              {selectedBoss && selectedBoss.items.length === 0 && (
                <p className="text-sm text-purple-600/70 p-2">This boss has no items yet — add some in the Boss Items admin page.</p>
              )}
            </div>
            <div className="p-3 border-t border-purple-900/30 flex gap-2 items-center">
              {selectedBoss && (
                <button type="button" onClick={backToBossList} className="text-xs text-purple-500 hover:text-purple-300 px-2 py-1.5 transition-colors">
                  ← Back
                </button>
              )}
              <div className="flex-1" />
              {selectedBoss && (
                <button
                  type="button"
                  onClick={confirmAdd}
                  disabled={checked.size === 0}
                  className="text-xs font-semibold bg-purple-700/60 hover:bg-purple-700/80 disabled:opacity-40 border border-purple-500 text-white rounded-lg px-4 py-1.5 transition-colors"
                >
                  Add {checked.size > 0 ? checked.size : ""} item{checked.size === 1 ? "" : "s"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
