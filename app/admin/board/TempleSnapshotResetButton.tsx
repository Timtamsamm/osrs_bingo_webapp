"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  takenAt: string | null;
  snapshotCount: number;
}

export default function TempleSnapshotResetButton({ takenAt, snapshotCount }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/board/reset-temple-snapshot", { method: "DELETE" });
    setLoading(false);
    setConfirm(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Reset failed.");
    }
  }

  return (
    <div className="border border-purple-900/40 rounded-xl overflow-hidden">
      <div className="bg-[#0e0820] px-5 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-purple-200">TempleOSRS baseline</p>
          {takenAt ? (
            <p className="text-xs text-purple-600/70 mt-0.5">
              Taken <span suppressHydrationWarning>{new Date(takenAt).toLocaleString()}</span> for {snapshotCount} player{snapshotCount === 1 ? "" : "s"} — stats on Players/Team pages are showing gains since then.
            </p>
          ) : (
            <p className="text-xs text-purple-600/70 mt-0.5">
              Not taken yet — it fires automatically the first time someone visits Players or a team page after the board&apos;s start time.
            </p>
          )}
        </div>
        {!confirm && takenAt && (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="shrink-0 px-4 py-2 rounded-lg bg-purple-900/50 hover:bg-purple-800/60 border border-purple-700/40 text-purple-300 text-sm font-medium transition-colors"
          >
            Reset…
          </button>
        )}
      </div>

      {confirm && (
        <div className="bg-purple-950/20 px-5 py-4 flex items-center gap-3 border-t border-purple-900/40">
          <p className="text-sm text-purple-200 flex-1">
            Clear the baseline so it&apos;s retaken next visit? Useful for starting a new event on this board. Tiles and submissions are untouched.
          </p>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-sm text-purple-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {loading ? "Resetting…" : "Yes, reset"}
          </button>
        </div>
      )}

      {error && <div className="px-5 py-2 text-xs text-red-400 bg-[#0e0820]/40">{error}</div>}
    </div>
  );
}
