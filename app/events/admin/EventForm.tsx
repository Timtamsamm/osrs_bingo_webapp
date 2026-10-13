"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BossFilterPicker from "./BossFilterPicker";
import DateTimePicker, { formatDatetimeLocal } from "@/app/components/DateTimePicker";
import { confirmDialog } from "@/app/components/ConfirmDialog";

export interface EventFormValues {
  id: string;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  bossFilter: string | null;
  minDropValue: number;
  clanOnly: boolean;
}

function toDatetimeLocal(date: string): string {
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** "50k" → 50000, "1.5m" → 1500000, "" → 0; null if it isn't a valid amount. */
function parseGpInput(input: string): number | null {
  const m = /^([\d,]*\.?\d+)\s*([kmb])?$/i.exec(input.trim().replace(/gp$/i, "").trim());
  if (!input.trim()) return 0;
  if (!m) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase() as "k" | "m" | "b"] ?? 1;
  return Math.round(parseFloat(m[1].replace(/,/g, "")) * mult);
}

function formatGpInput(value: number): string {
  if (value >= 1e6 && value % 1e5 === 0) return `${value / 1e6}m`;
  if (value >= 1e3 && value % 100 === 0) return `${value / 1e3}k`;
  return String(value);
}

/** `start` + `hours`, or null while no start is set (disables the shortcut). */
function hoursAfter(start: string, hours: number): string | null {
  if (!start) return null;
  return formatDatetimeLocal(new Date(new Date(start).getTime() + hours * 3_600_000));
}

const inputCls =
  "bg-[#130a28] border border-purple-900/50 rounded-lg px-3 py-2 text-white text-sm placeholder-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600/60";

/** Create form when `event` is omitted, edit form (with delete) otherwise. */
export default function EventForm({ event, bossNames }: { event?: EventFormValues; bossNames: string[] }) {
  const router = useRouter();
  const [name, setName] = useState(event?.name ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [startsAt, setStartsAt] = useState(event ? toDatetimeLocal(event.startsAt) : "");
  const [endsAt, setEndsAt] = useState(event ? toDatetimeLocal(event.endsAt) : "");
  const [bossFilter, setBossFilter] = useState(event?.bossFilter ?? "");
  const [minDrop, setMinDrop] = useState(event?.minDropValue ? formatGpInput(event.minDropValue) : "");
  const [clanOnly, setClanOnly] = useState(event?.clanOnly ?? true);
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
    const minDropValue = parseGpInput(minDrop);
    if (minDropValue == null) {
      setError("Minimum drop value should be a number like 50000, 50k or 1.5m");
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
        bossFilter,
        minDropValue,
        clanOnly,
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
    if (!event || !(await confirmDialog({ title: `Delete ${event.name}?`, message: "All its attendance, kills, drops and stats are deleted too.", confirmLabel: "Delete event", danger: true }))) return;
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
        <Field as="div" label="Starts">
          <DateTimePicker value={startsAt} onChange={setStartsAt} />
        </Field>
        <Field as="div" label="Ends">
          <DateTimePicker
            value={endsAt}
            onChange={setEndsAt}
            shortcuts={[1, 2, 3, 4].map((h) => ({ label: `+${h}h`, value: hoursAfter(startsAt, h) }))}
          />
        </Field>
      </div>
      <Field
        as="div"
        label="Boss filter (optional)"
        hint="Only kills/drops from these bosses count. Leave empty to count everything. Not listed? Type it and press Enter."
      >
        <BossFilterPicker bossNames={bossNames} value={bossFilter} onChange={setBossFilter} inputClassName={inputCls} />
      </Field>
      <Field
        label="Minimum drop value (optional)"
        hint="Drops worth less than this (whole stack) are left out of Top drops and loot totals — they still count for attendance. e.g. 50k or 1m. Blank = show every drop."
      >
        <input
          value={minDrop}
          onChange={(e) => setMinDrop(e.target.value)}
          placeholder="0"
          inputMode="decimal"
          className={`${inputCls} sm:max-w-[calc(50%-0.5rem)]`}
        />
      </Field>
      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input type="checkbox" checked={clanOnly} onChange={(e) => setClanOnly(e.target.checked)} className="accent-purple-600" />
          <span className="text-xs font-medium text-purple-300">Clan members only</span>
        </label>
        <span className="text-[11px] text-purple-600/80">
          {clanOnly
            ? "Players not in the clan's Wise Old Man group are left off the public page, and their kills/drops don't count. They still show here, tagged \"Not in clan\"."
            : "Players not in the clan are shown on the public page as guests, and their kills/drops count."}
        </span>
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

function Field({
  label,
  hint,
  children,
  as: Tag = "label",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  // "div" for fields containing several controls (a <label> may only wrap one).
  as?: "label" | "div";
}) {
  return (
    <Tag className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-purple-300">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-purple-600/80">{hint}</span>}
    </Tag>
  );
}
