"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "deleting" }
  | { status: "done"; saved: string[]; skipped: string[]; failed: string[] }
  | { status: "error"; message: string };

interface Props {
  snapshotCount: number;
  snapshotTakenAt: string | null;
}

export default function SnapshotButton({ snapshotCount, snapshotTakenAt }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });
  const router = useRouter();

  async function handleSnapshot() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/admin/snapshot", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: json.error ?? "Request failed" });
        return;
      }
      setState({ status: "done", saved: json.saved, skipped: json.skipped, failed: json.failed });
      router.refresh();
    } catch {
      setState({ status: "error", message: "Network error" });
    }
  }

  async function handleDelete() {
    if (!confirm("Delete all snapshots for the active board?")) return;
    setState({ status: "deleting" });
    try {
      const res = await fetch("/api/admin/snapshot", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: json.error ?? "Delete failed" });
        return;
      }
      setState({ status: "idle" });
      router.refresh();
    } catch {
      setState({ status: "error", message: "Network error" });
    }
  }

  const busy = state.status === "loading" || state.status === "deleting";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Player KC Snapshot
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          Captures current boss kill counts for all team members from the OSRS hiscores.
          Take this just before the bingo starts. Existing snapshots are skipped.
        </p>
        {snapshotTakenAt ? (
          <p className="text-xs text-amber-400/80 mb-3">
            ● Snapshot active — {snapshotCount} {snapshotCount === 1 ? "member" : "members"},{" "}
            taken <span suppressHydrationWarning>{new Date(snapshotTakenAt).toLocaleString()}</span>
          </p>
        ) : (
          <p className="text-xs text-gray-600 mb-3">○ No snapshot taken yet</p>
        )}
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleSnapshot}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
          >
            {state.status === "loading" ? "Snapshotting…" : "Snapshot Player KCs"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-red-900/60 hover:bg-red-800/60 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-red-300 transition-colors"
          >
            {state.status === "deleting" ? "Deleting…" : "Delete Snapshot"}
          </button>
        </div>
      </div>

      {state.status === "error" && (
        <p className="text-sm text-red-400">{state.message}</p>
      )}

      {state.status === "done" && (
        <div className="text-xs text-gray-400 flex flex-col gap-0.5">
          {state.saved.length > 0 && (
            <p><span className="text-green-400">Saved:</span> {state.saved.join(", ")}</p>
          )}
          {state.skipped.length > 0 && (
            <p><span className="text-gray-500">Skipped (already snapshotted):</span> {state.skipped.join(", ")}</p>
          )}
          {state.failed.length > 0 && (
            <p><span className="text-red-400">Failed:</span> {state.failed.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
