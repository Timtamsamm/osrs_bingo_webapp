"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface EventFormValues {
  id: string;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  joinPhrase: string;
  bossFilter: string | null;
}

function toDatetimeLocal(date: string): string {
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const inputCls =
  "bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-2 text-white text-sm placeholder-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600/60";

/** Create form when `event` is omitted, edit form (with delete) otherwise. */
export default function EventForm({ event }: { event?: EventFormValues }) {
  const router = useRouter();
  const [name, setName] = useState(event?.name ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startsAt, setStartsAt] = useState(event ? toDatetimeLocal(event.startsAt) : "");
  const [endsAt, setEndsAt] = useState(event ? toDatetimeLocal(event.endsAt) : "");
  const [joinPhrase, setJoinPhrase] = useState(event?.joinPhrase ?? "!join");
  const [bossFilter, setBossFilter] = useState(event?.bossFilter ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt || !endsAt) {
      setError("Start and end times are required");
      setStatus("error");
      return;
    }
    setSaving(true);
    setStatus("idle");
    const res = await fetch(event ? `/api/admin/events/${event.id}` : "/api/admin/events", {
      method: event ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        joinPhrase,
        bossFilter,
      }),
    });
    setSaving(false);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to save");
      setStatus("error");
      return;
    }
    if (event) {
      setStatus("saved");
      router.refresh();
    } else {
      router.push(`/events/admin/${json.id}`);
    }
  }

  async function remove() {
    if (!event || !confirm(`Delete "${event.name}" and all its attendance, kills and drops?`)) return;
    await fetch(`/api/admin/events/${event.id}`, { method: "DELETE" });
    router.push("/events/admin");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5 flex flex-col gap-4">
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Vorkath Mass" className={inputCls} />
      </Field>
      <Field label="Description (optional)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Meet at Rellekka on world 420…"
          className={`${inputCls} resize-y`}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts">
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={`${inputCls} [color-scheme:dark]`} />
        </Field>
        <Field label="Ends">
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required className={`${inputCls} [color-scheme:dark]`} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Join phrase" hint="Typed in clan chat to check in. Must match exactly (not case-sensitive).">
          <input value={joinPhrase} onChange={(e) => setJoinPhrase(e.target.value)} placeholder="!join" className={inputCls} />
        </Field>
        <Field label="Boss filter (optional)" hint="Only count kills/drops from these, comma-separated. Blank = count everything.">
          <input value={bossFilter} onChange={(e) => setBossFilter(e.target.value)} placeholder="Vorkath" className={inputCls} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors purple-glow-sm"
        >
          {saving ? "Saving…" : event ? "Save changes" : "Create event"}
        </button>
        {status === "saved" && <p className="text-xs text-green-400">Saved.</p>}
        {status === "error" && <p className="text-xs text-red-400">{error}</p>}
        {event && (
          <button
            type="button"
            onClick={remove}
            className="ml-auto text-sm text-purple-500 hover:text-red-400 transition-colors"
          >
            Delete event
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-purple-300">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-purple-600/80">{hint}</span>}
    </label>
  );
}
