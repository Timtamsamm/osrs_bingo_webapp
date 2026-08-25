"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Submission {
  id: string;
  imageUrl: string | null;
  note: string | null;
  createdAt: Date;
  status: string;
  source: string;
  dinkItemName: string | null;
  teamMember: string | null;
  tier: number | null;
  team: { name: string } | null;
  tile: { title: string };
}

export default function SubmissionReviewer({ submission: s }: { submission: Submission }) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const isDink = s.source === "dink";
  const isApproved = s.status === "APPROVED";

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  async function decide(status: "APPROVED" | "REJECTED") {
    setLoading(true);
    await fetch(`/api/admin/submissions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNote: reviewNote.trim() || null }),
    });
    setLoading(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this submission permanently?")) return;
    setLoading(true);
    await fetch(`/api/admin/submissions/${s.id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  const submitterLabel = s.team?.name
    ? `${s.team.name}${s.teamMember ? ` · RSN: ${s.teamMember}` : ""}`
    : s.teamMember ?? "Unknown";

  return (
    <div className={`bg-[#0e0820] border rounded-xl overflow-hidden ${isDink ? "border-purple-700/50" : "border-purple-900/40"}`}>
      <div className="flex gap-4 p-4 border-b border-purple-900/40 items-center">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-white">{s.tile.title}</p>
            {s.tier != null && (
              <span className="text-xs font-bold bg-purple-900/40 text-purple-200 border border-purple-700/40 rounded px-1.5 py-0.5">
                T{s.tier}
              </span>
            )}
            {isDink && (
              <span className="text-xs font-semibold bg-purple-600/20 text-purple-400 border border-purple-600/30 rounded px-1.5 py-0.5">
                Dink
              </span>
            )}
            {isApproved && (
              <span className="text-xs font-semibold bg-green-600/20 text-green-400 border border-green-600/30 rounded px-1.5 py-0.5">
                Auto-approved
              </span>
            )}
          </div>
          <p className="text-sm text-purple-500/80 mt-0.5">
            {submitterLabel}
            {s.dinkItemName && (
              <> · <span className="text-purple-300">{s.dinkItemName}</span></>
            )}
            {" · "}
            <span suppressHydrationWarning>{new Date(s.createdAt).toLocaleDateString()}</span>
          </p>
        </div>
      </div>

      <div className="flex gap-4 p-4">
        {s.imageUrl ? (
          <button
            type="button"
            onClick={() => setLightbox(true)}
            className="relative w-64 h-36 shrink-0 rounded-lg overflow-hidden bg-[#130a28] group cursor-zoom-in"
            title="Click to enlarge"
          >
            <Image src={s.imageUrl} alt="Submission" fill sizes="256px" className="object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity">⤢</span>
            </div>
          </button>
        ) : (
          <div className="w-64 h-36 shrink-0 rounded-lg bg-[#130a28] border border-purple-900/40 flex items-center justify-center">
            <p className="text-xs text-purple-700/60 text-center px-4">No screenshot<br />(Dink auto-claim)</p>
          </div>
        )}

        {lightbox && s.imageUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(false)}
          >
            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="absolute top-4 right-4 text-purple-400 hover:text-white text-2xl leading-none transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.imageUrl}
              alt="Submission full size"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <div className="flex-1 flex flex-col gap-3">
          {s.note && (
            <div className="bg-[#130a28] rounded-lg px-3 py-2 text-sm text-purple-200">
              <span className="text-purple-600 text-xs block mb-1">Note</span>
              {s.note}
            </div>
          )}

          {!isApproved && (
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              placeholder="Review note (optional)"
              className="bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-2 text-white text-sm placeholder-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 resize-none"
            />
          )}

          <div className="flex gap-2">
            {!isApproved && (
              <button
                onClick={() => decide("APPROVED")}
                disabled={loading}
                className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
              >
                Approve
              </button>
            )}
            <div className={`flex rounded-lg overflow-hidden border border-red-800/50 ${isApproved ? "flex-1" : ""}`}>
              <button
                onClick={() => decide("REJECTED")}
                disabled={loading}
                className="flex-1 bg-red-900/70 hover:bg-red-800 disabled:opacity-50 text-white font-semibold py-2 text-sm transition-colors"
              >
                Reject
              </button>
              <div className="w-px bg-red-800/50" />
              <button
                onClick={remove}
                disabled={loading}
                title="Delete submission"
                className="px-3 bg-red-950/60 hover:bg-red-900 disabled:opacity-50 text-red-400 transition-colors"
              >
                🗑
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
