"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetBoardButton() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function reset() {
    setLoading(true);
    const res = await fetch("/api/admin/board/reset", { method: "DELETE" });
    const data = await res.json();
    setLoading(false);
    setConfirm(false);
    if (res.ok) {
      setResult(`Deleted ${data.deletedSubmissions} submission${data.deletedSubmissions !== 1 ? "s" : ""}, reset ${data.resetTiles} tile${data.resetTiles !== 1 ? "s" : ""}. `);
      router.refresh();
    } else {
      setResult(data.error ?? "Reset failed.");
    }
  }

  return (
    <div className="border border-red-900/40 rounded-xl overflow-hidden">
      <div className="bg-red-950/20 px-5 py-3 border-b border-red-900/40 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-red-300">Reset board</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Deletes all submissions and clears all tile content (titles, images, points). User accounts are untouched.
          </p>
        </div>
        {!confirm && (
          <button
            type="button"
            onClick={() => { setResult(null); setConfirm(true); }}
            className="shrink-0 px-4 py-2 rounded-lg bg-red-900/50 hover:bg-red-800 border border-red-700/50 text-red-300 text-sm font-medium transition-colors"
          >
            Reset…
          </button>
        )}
      </div>

      {confirm && (
        <div className="bg-red-950/30 px-5 py-4 flex items-center gap-3">
          <p className="text-sm text-red-200 flex-1">
            Delete <strong>all submissions</strong> and clear <strong>all tile content</strong>? This cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {loading ? "Resetting…" : "Yes, reset"}
          </button>
        </div>
      )}

      {result && !confirm && (
        <div className="px-5 py-2 text-xs text-gray-400 bg-gray-900/40">{result}</div>
      )}
    </div>
  );
}
