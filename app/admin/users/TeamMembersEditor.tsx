"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  members: string[];
}

export default function TeamMembersEditor({ id, members }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function openModal() {
    setText(members.join("\n"));
    setError(null);
    setOpen(true);
  }

  async function save() {
    const teamMembers = text.split("\n").map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamMembers }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Save failed");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-xs text-gray-400 hover:text-amber-400 transition-colors"
      >
        {members.length === 0 ? (
          <span className="text-gray-600">None — edit</span>
        ) : (
          <>{members.join(", ")}</>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm flex flex-col gap-4">
            <div>
              <h3 className="font-semibold text-white">Edit Team Members</h3>
              <p className="text-xs text-gray-500 mt-1">One member name per line.</p>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-amber-500"
              placeholder={"PlayerOne\nPlayerTwo\nPlayerThree"}
              autoFocus
            />

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 text-sm font-semibold rounded-lg transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
