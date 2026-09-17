"use client";

import { useState } from "react";
import { parseItemLines, itemLinesToText } from "@/lib/itemListFormat";

interface BossItem {
  id: string;
  itemId: number;
  name: string;
}

interface Boss {
  id: string;
  name: string;
  items: BossItem[];
}

interface BossRow {
  id: string;
  name: string;
  itemsText: string;
  saving: boolean;
  error: string;
}

const inputCls = "bg-[#130a28] border border-purple-900/50 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600/60 placeholder-purple-800";
const labelCls = "text-xs text-purple-400 font-medium";

function itemsToText(items: BossItem[]): string {
  return itemLinesToText(items.map((i) => ({ id: i.itemId, name: i.name })));
}

function parseItemsText(text: string): { itemId: number; name: string }[] {
  return parseItemLines(text).map((i) => ({ itemId: i.id, name: i.name }));
}

function bossToRow(b: Boss): BossRow {
  return { id: b.id, name: b.name, itemsText: itemsToText(b.items), saving: false, error: "" };
}

export default function BossDatabaseEditor({ initialBosses }: { initialBosses: Boss[] }) {
  const [rows, setRows] = useState<BossRow[]>(() => initialBosses.map(bossToRow).sort((a, b) => a.name.localeCompare(b.name)));
  const [search, setSearch] = useState("");
  const [newBossName, setNewBossName] = useState("");
  const [addingBoss, setAddingBoss] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  function updateRow(id: string, patch: Partial<BossRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function addBoss() {
    const name = newBossName.trim();
    if (!name) return;
    setAddingBoss(true);
    try {
      const res = await fetch("/api/admin/bosses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to add boss");
      const { boss } = await res.json();
      setRows((prev) => [...prev, bossToRow(boss)].sort((a, b) => a.name.localeCompare(b.name)));
      setOpenId(boss.id);
      setNewBossName("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add boss");
    } finally {
      setAddingBoss(false);
    }
  }

  async function saveBoss(row: BossRow) {
    updateRow(row.id, { saving: true, error: "" });
    try {
      const res = await fetch(`/api/admin/bosses/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: row.name, items: parseItemsText(row.itemsText) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      const { boss } = await res.json();
      updateRow(row.id, bossToRow(boss));
      setRows((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      updateRow(row.id, { error: err instanceof Error ? err.message : "Save failed" });
    } finally {
      updateRow(row.id, { saving: false });
    }
  }

  async function deleteBoss(row: BossRow) {
    if (!confirm(`Delete "${row.name}" and all its items? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/bosses/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete boss");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-4 flex flex-col gap-3">
        <h2 className="font-semibold text-purple-100 text-sm">Add a boss</h2>
        <div className="flex gap-2">
          <input
            value={newBossName}
            onChange={(e) => setNewBossName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addBoss()}
            placeholder="e.g. Cerberus"
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            onClick={addBoss}
            disabled={addingBoss || !newBossName.trim()}
            className="text-xs font-semibold bg-purple-700/60 hover:bg-purple-700/80 disabled:opacity-40 border border-purple-500 text-white rounded-lg px-4 py-1.5 transition-colors shrink-0"
          >
            Add boss
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls}>Search</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter bosses..."
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-2">
        {filtered.length === 0 && <p className="text-sm text-purple-600/70">No bosses match.</p>}
        {filtered.map((row) => {
          const itemCount = parseItemsText(row.itemsText).length;
          const isOpen = openId === row.id;
          return (
            <div key={row.id} className="bg-[#0e0820] border border-purple-900/40 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : row.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-purple-900/10 transition-colors"
              >
                <span className="text-sm font-semibold text-purple-100">{row.name}</span>
                <span className="text-xs text-purple-500 shrink-0">{itemCount} item{itemCount === 1 ? "" : "s"}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 flex flex-col gap-3 border-t border-purple-900/30 pt-3">
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Name</label>
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Items (itemId, item name)</label>
                    <textarea
                      value={row.itemsText}
                      onChange={(e) => updateRow(row.id, { itemsText: e.target.value })}
                      rows={Math.min(20, Math.max(4, itemCount + 1))}
                      placeholder={"11832 Bandos chestplate\n11834 Bandos tassets"}
                      className={`${inputCls} font-mono resize-y text-xs`}
                    />
                  </div>
                  {row.error && <p className="text-xs text-red-400">{row.error}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveBoss(row)}
                      disabled={row.saving}
                      className="text-xs font-semibold bg-purple-700/60 hover:bg-purple-700/80 disabled:opacity-40 border border-purple-500 text-white rounded-lg px-4 py-1.5 transition-colors"
                    >
                      {row.saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBoss(row)}
                      className="text-xs text-purple-600 hover:text-red-400 transition-colors px-2"
                    >
                      Delete boss
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
