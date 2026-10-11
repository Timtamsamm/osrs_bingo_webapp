"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Themed date + time picker. `value` uses the same local-time format as
 * <input type="datetime-local"> ("YYYY-MM-DDTHH:mm", or "" when unset), so it
 * drops in where one was.
 */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

type Parts = { y: number; mo: number; d: number; h: number; mi: number };

function parse(value: string): Parts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  return { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +m[4], mi: +m[5] };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDatetimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDate(p: Parts): Date {
  return new Date(p.y, p.mo, p.d, p.h, p.mi);
}

/** Next whole hour from now — a sensible default when picking a fresh date. */
function nextHour(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export default function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date & time",
  shortcuts,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Extra one-click buttons shown under the field, e.g. "+2h" from the start time. */
  shortcuts?: Array<{ label: string; value: string | null }>;
}) {
  const parts = parse(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = parts ? toDate(parts) : new Date();
    return { y: base.getFullYear(), mo: base.getMonth() };
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      // Re-centre the calendar on the current value each time it opens.
      const base = parts ? toDate(parts) : new Date();
      setView({ y: base.getFullYear(), mo: base.getMonth() });
    }
    setOpen((o) => !o);
  }

  function emit(p: Parts) {
    onChange(formatDatetimeLocal(toDate(p)));
  }

  function pickDay(y: number, mo: number, d: number) {
    const time = parts ?? (() => {
      const n = nextHour();
      return { h: n.getHours(), mi: n.getMinutes() };
    })();
    emit({ y, mo, d, h: time.h, mi: time.mi });
  }

  function setTime(h: number, mi: number) {
    const base = parts ?? (() => {
      const t = new Date();
      return { y: t.getFullYear(), mo: t.getMonth(), d: t.getDate() };
    })();
    emit({ ...base, h, mi } as Parts);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.mo + delta, 1);
      return { y: d.getFullYear(), mo: d.getMonth() };
    });
  }

  // Calendar grid, Monday-first, padded with the neighbouring months' days.
  const first = new Date(view.y, view.mo, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(view.y, view.mo + 1, 0).getDate();
  const cellCount = Math.ceil((lead + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, i) => new Date(view.y, view.mo, i - lead + 1));

  const today = new Date();
  const isSame = (a: Date, y: number, mo: number, d: number) => a.getFullYear() === y && a.getMonth() === mo && a.getDate() === d;

  const hour12 = parts ? ((parts.h + 11) % 12) + 1 : null;
  const isPm = parts ? parts.h >= 12 : null;
  const minuteOptions = parts && !MINUTES.includes(parts.mi) ? [...MINUTES, parts.mi].sort((a, b) => a - b) : MINUTES;

  const display = parts
    ? toDate(parts).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  const selectCls =
    "bg-[#130a28] border border-purple-900/60 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 [color-scheme:dark]";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full flex items-center gap-2 bg-[#130a28] border rounded-lg px-3 py-2 text-sm text-left transition-colors ${
          open ? "border-purple-500/70 ring-2 ring-purple-500/40" : "border-purple-900/50 hover:border-purple-700/60"
        }`}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 shrink-0 text-purple-400" aria-hidden>
          <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
          <path d="M3 8.5h14M7 2.75v3.5M13 2.75v3.5" strokeLinecap="round" />
        </svg>
        <span suppressHydrationWarning className={display ? "text-white" : "text-purple-700"}>
          {display ?? placeholder}
        </span>
      </button>

      {shortcuts && shortcuts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={!s.value}
              onClick={() => s.value && onChange(s.value)}
              className={`text-[11px] rounded-full border px-2 py-0.5 transition-colors disabled:opacity-30 ${
                s.value === value
                  ? "border-purple-500/70 bg-purple-700/40 text-white"
                  : "border-purple-800/60 text-purple-300 hover:border-purple-600/60 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Choose date and time"
          className="absolute z-30 left-0 top-full mt-2 w-[19rem] max-w-[calc(100vw-2rem)] bg-[#0c0619] border border-purple-800/60 rounded-xl shadow-2xl shadow-black/60 p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="w-8 h-8 rounded-lg text-purple-300 hover:bg-purple-800/40 hover:text-white transition-colors"
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-purple-100">
              {first.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="w-8 h-8 rounded-lg text-purple-300 hover:bg-purple-800/40 hover:text-white transition-colors"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-[10px] uppercase tracking-wider text-purple-600 py-1">
                {w}
              </span>
            ))}
            {cells.map((c) => {
              const inMonth = c.getMonth() === view.mo;
              const selected = parts && isSame(c, parts.y, parts.mo, parts.d);
              const isToday = isSame(today, c.getFullYear(), c.getMonth(), c.getDate());
              return (
                <button
                  key={c.toISOString()}
                  type="button"
                  onClick={() => pickDay(c.getFullYear(), c.getMonth(), c.getDate())}
                  className={`h-9 rounded-lg text-sm tabular-nums transition-colors ${
                    selected
                      ? "bg-purple-600 text-white font-semibold purple-glow-sm"
                      : isToday
                        ? "text-purple-100 ring-1 ring-inset ring-purple-500/70 hover:bg-purple-800/40"
                        : inMonth
                          ? "text-purple-100 hover:bg-purple-800/40"
                          : "text-purple-700/70 hover:bg-purple-900/40"
                  }`}
                >
                  {c.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-purple-900/50 flex items-center gap-2">
            <span className="text-xs text-purple-400 mr-auto">Time</span>
            <select
              aria-label="Hour"
              value={hour12 ?? ""}
              onChange={(e) => {
                const h12 = +e.target.value;
                setTime((h12 % 12) + (isPm ? 12 : 0), parts?.mi ?? 0);
              }}
              className={selectCls}
            >
              {hour12 == null && <option value="">--</option>}
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-purple-500">:</span>
            <select
              aria-label="Minute"
              value={parts?.mi ?? ""}
              onChange={(e) => setTime(parts?.h ?? nextHour().getHours(), +e.target.value)}
              className={selectCls}
            >
              {parts == null && <option value="">--</option>}
              {minuteOptions.map((m) => (
                <option key={m} value={m}>
                  {pad(m)}
                </option>
              ))}
            </select>
            <div className="flex rounded-lg border border-purple-900/60 overflow-hidden">
              {(["AM", "PM"] as const).map((label) => {
                const active = label === "PM" ? isPm === true : isPm === false;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      const h = parts?.h ?? nextHour().getHours();
                      setTime((h % 12) + (label === "PM" ? 12 : 0), parts?.mi ?? 0);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      active ? "bg-purple-600 text-white" : "text-purple-400 hover:bg-purple-800/40 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const n = new Date();
                n.setSeconds(0, 0);
                onChange(formatDatetimeLocal(n));
                setView({ y: n.getFullYear(), mo: n.getMonth() });
              }}
              className="text-xs text-purple-400 hover:text-white transition-colors"
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
