"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Submission {
  id: string;
  imageUrl: string;
  note: string | null;
  createdAt: Date;
  user: { username: string };
  tile: { title: string; requiredCount: number };
}

export default function SubmissionReviewer({ submission: s }: { submission: Submission }) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState(false);

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

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex gap-4 p-4 border-b border-gray-800 items-center">
        <div className="flex-1">
          <p className="font-medium text-white">{s.tile.title}</p>
          <p className="text-sm text-gray-400">
            by <span className="text-gray-200">{s.user.username}</span>
            {" · "}
            <span suppressHydrationWarning>{new Date(s.createdAt).toLocaleDateString()}</span>
          </p>
        </div>
        {s.tile.requiredCount > 1 && (
          <span className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-400">
            needs {s.tile.requiredCount} submissions
          </span>
        )}
      </div>

      <div className="flex gap-4 p-4">
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="relative w-64 h-36 shrink-0 rounded-lg overflow-hidden bg-gray-800 group cursor-zoom-in"
          title="Click to enlarge"
        >
          <Image src={s.imageUrl} alt="Submission" fill sizes="256px" className="object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <span className="text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity">⤢</span>
          </div>
        </button>

        {lightbox && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(false)}
          >
            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl leading-none transition-colors"
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
            <div className="bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300">
              <span className="text-gray-500 text-xs block mb-1">Player note</span>
              {s.note}
            </div>
          )}

          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={2}
            placeholder="Review note (optional, shown to player on rejection)"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />

          <div className="flex gap-2">
            <button
              onClick={() => decide("APPROVED")}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
            >
              Approve
            </button>
            <div className="flex flex-1 rounded-lg overflow-hidden border border-red-700/50">
              <button
                onClick={() => decide("REJECTED")}
                disabled={loading}
                className="flex-1 bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-2 text-sm transition-colors"
              >
                Reject
              </button>
              <div className="w-px bg-red-700/50" />
              <button
                onClick={remove}
                disabled={loading}
                title="Delete submission"
                className="px-3 bg-red-900/60 hover:bg-red-800 disabled:opacity-50 text-red-300 transition-colors"
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
