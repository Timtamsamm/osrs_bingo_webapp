"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LocalTime from "@/app/components/LocalTime";
import MemberSearchInput, { type MemberOption } from "@/app/components/MemberSearchInput";

interface Attendee {
  id: string;
  rsn: string;
  detail: string;
  isGuest: boolean;
  firstSeenAt: string;
}

export default function AttendeeManager({
  eventId,
  attendees,
  members,
}: {
  eventId: string;
  attendees: Attendee[];
  members: MemberOption[];
}) {
  const router = useRouter();
  const [rsn, setRsn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!rsn.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/events/${eventId}/attendees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rsn }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Failed to add");
      return;
    }
    setRsn("");
    router.refresh();
  }

  async function remove(a: Attendee) {
    if (!confirm(`Remove ${a.rsn} from this event's attendance?`)) return;
    await fetch(`/api/admin/events/${eventId}/attendees?attendeeId=${a.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-semibold text-purple-100 text-sm">Attendance ({attendees.length})</h2>
        <p className="text-xs text-purple-500/80 mt-1">
          Filled in automatically. Add anyone the check-in missed, or remove anyone who shouldn&apos;t count.
        </p>
      </div>

      <form onSubmit={add} className="flex gap-2">
        <div className="flex-1 min-w-0">
          <MemberSearchInput
            members={members}
            value={rsn}
            onChange={setRsn}
            placeholder="Search clan members or type an RSN…"
            className="w-full bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-2 text-white text-sm placeholder-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !rsn.trim()}
          className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors shrink-0"
        >
          Add
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {attendees.length === 0 ? (
        <p className="text-sm text-purple-600/70">Nobody recorded yet.</p>
      ) : (
        <ul className="divide-y divide-purple-900/30">
          {attendees.map((a) => (
            <li key={a.id} className="py-2 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="text-purple-100 truncate">
                  {a.rsn}
                  {a.isGuest && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-300/90 border border-amber-500/40 rounded-full px-1.5 py-0.5">
                      Not in clan
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-purple-500/80">
                  {a.detail} · <LocalTime date={a.firstSeenAt} dateStyle="short" />
                </p>
              </div>
              <button onClick={() => remove(a)} className="text-xs text-purple-500 hover:text-red-400 transition-colors shrink-0">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
