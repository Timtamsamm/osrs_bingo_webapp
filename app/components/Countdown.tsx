"use client";

import { useState, useEffect } from "react";

interface Props {
  endsAt: string;       // UTC ISO string
  label?: string;       // default "Ends in"
  reloadOnExpire?: boolean;
}

function getRemainingMs(endsAt: string): number {
  return new Date(endsAt).getTime() - Date.now();
}

function format(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    String(days).padStart(2, "0"),
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

export default function Countdown({ endsAt, label = "Ends in", reloadOnExpire = false }: Props) {
  const [remaining, setRemaining] = useState(() => getRemainingMs(endsAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = getRemainingMs(endsAt);
      setRemaining(ms);
      if (ms <= 0 && reloadOnExpire) {
        clearInterval(interval);
        window.location.reload();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt, reloadOnExpire]);

  if (remaining <= 0 && !reloadOnExpire) {
    return (
      <div className="flex justify-center mb-2">
        <span className="text-sm font-medium text-red-400">Event has ended</span>
      </div>
    );
  }

  if (remaining <= 0) return null;

  return (
    <div className="flex justify-center items-baseline gap-2 mb-2">
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="font-mono font-bold text-amber-400 text-lg tracking-widest" suppressHydrationWarning>{format(remaining)}</span>
      <span className="text-xs text-gray-600">dd:hh:mm:ss</span>
    </div>
  );
}
