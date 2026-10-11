"use client";

import { useMemo, useState } from "react";

interface Props {
  bossNames: string[];
  /** Comma-separated list, as stored in ClanEvent.bossFilter. */
  value: string;
  onChange: (value: string) => void;
  inputClassName?: string;
}

function parse(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Multi-select boss picker: a search box with a dropdown of known bosses
 * (from the Boss Items database), selected bosses shown as removable chips.
 * Typing a name that isn't listed and pressing Enter adds it as-is.
 */
export default function BossFilterPicker({ bossNames, value, onChange, inputClassName }: Props) {
  const selected = parse(value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedLower = useMemo(() => new Set(selected.map((s) => s.toLowerCase())), [selected]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bossNames.filter((b) => !selectedLower.has(b.toLowerCase()) && (!q || b.toLowerCase().includes(q)));
  }, [bossNames, query, selectedLower]);

  function add(name: string) {
    const n = name.trim();
    if (!n || selectedLower.has(n.toLowerCase())) return;
    onChange([...selected, n].join(", "));
    setQuery("");
  }

  function remove(name: string) {
    onChange(selected.filter((s) => s !== name).join(", "));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Don't submit the whole event form — add the top match, or the typed text.
      e.preventDefault();
      if (query.trim()) add(matches[0] ?? query);
    } else if (e.key === "Backspace" && !query && selected.length) {
      remove(selected[selected.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const exactListed = bossNames.some((b) => b.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 bg-purple-800/40 border border-purple-700/50 text-purple-100 text-xs rounded-full pl-2.5 pr-1 py-0.5"
            >
              {s}
              <button
                type="button"
                onClick={() => remove(s)}
                aria-label={`Remove ${s}`}
                className="w-4 h-4 rounded-full text-purple-300 hover:text-white hover:bg-purple-600/50 leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={selected.length ? "Add another boss…" : "Search bosses… (blank = count everything)"}
          className={`w-full ${inputClassName ?? ""}`}
        />
        {open && (matches.length > 0 || (query.trim() && !exactListed)) && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#130a28] border border-purple-800/60 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {query.trim() && !exactListed && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(query)}
                className="w-full text-left px-3 py-1.5 text-sm text-purple-300 hover:bg-purple-800/40 transition-colors border-b border-purple-900/50"
              >
                Add &ldquo;{query.trim()}&rdquo; as typed
              </button>
            )}
            {matches.map((b) => (
              <button
                key={b}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(b)}
                className="w-full text-left px-3 py-1.5 text-sm text-purple-200 hover:bg-purple-800/40 transition-colors"
              >
                {b}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
