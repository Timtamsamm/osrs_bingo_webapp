"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initialMembers: string[];
  maxTeamSize: number;
}

export default function TeamEditor({ initialMembers, maxTeamSize }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState<string[]>(
    initialMembers.length > 0 ? initialMembers : [""]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function updateMember(i: number, val: string) {
    setSaved(false);
    setMembers((prev) => prev.map((m, idx) => (idx === i ? val : m)));
  }

  function addMember() {
    if (members.length < maxTeamSize) {
      setSaved(false);
      setMembers((prev) => [...prev, ""]);
    }
  }

  function removeMember(i: number) {
    setSaved(false);
    setMembers((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length === 0 ? [""] : next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamMembers: members.map((m) => m.trim()).filter(Boolean) }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
    } else {
      setSaved(true);
      router.refresh();
    }
  }

  const filledCount = members.filter((m) => m.trim()).length;

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Players <span className="text-gray-600">({filledCount} / {maxTeamSize})</span>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {members.map((m, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-xs text-gray-600 w-5 text-right shrink-0">{i + 1}</span>
              <input
                value={m}
                onChange={(e) => updateMember(i, e.target.value)}
                placeholder="Player name"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => removeMember(i)}
                className="text-gray-600 hover:text-red-400 transition-colors px-1"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {members.length < maxTeamSize && (
          <button
            type="button"
            onClick={addMember}
            className="self-start text-xs text-amber-500 hover:text-amber-400 transition-colors"
          >
            + Add player
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg px-6 py-2 text-sm transition-colors"
        >
          {saving ? "Saving…" : "Save roster"}
        </button>
        {saved && <span className="text-sm text-green-400">Saved</span>}
      </div>
    </form>
  );
}
