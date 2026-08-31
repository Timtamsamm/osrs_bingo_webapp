"use client";

import { useMemo, useState } from "react";

export interface MemberOption {
  username: string;
  displayName: string;
}

interface Props {
  members: MemberOption[];
  value: string;
  onChange: (value: string) => void;
  onPick?: (displayName: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Free-text input with a searchable dropdown of clan members (from Wise Old
 * Man) underneath. Picking a suggestion fills the input; typing a name that
 * doesn't match anyone still works as a plain manual entry.
 */
export default function MemberSearchInput({ members, value, onChange, onPick, placeholder, className, onKeyDown }: Props) {
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return [];
    return members.filter((m) => m.displayName.toLowerCase().includes(q)).slice(0, 8);
  }, [members, value]);

  function pick(displayName: string) {
    onChange(displayName);
    onPick?.(displayName);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? "Search members or type a name…"}
        className={className}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#130a28] border border-purple-800/60 rounded-lg overflow-hidden shadow-lg max-h-56 overflow-y-auto">
          {matches.map((m) => (
            <button
              key={m.username}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(m.displayName)}
              className="w-full text-left px-3 py-1.5 text-sm text-purple-200 hover:bg-purple-800/40 transition-colors"
            >
              {m.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
