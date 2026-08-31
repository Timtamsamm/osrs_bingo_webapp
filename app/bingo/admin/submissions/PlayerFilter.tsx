"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function PlayerFilter({ players }: { players: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("player") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    router.push(val ? `?player=${encodeURIComponent(val)}` : "?");
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      <option value="">All players</option>
      {players.map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>
  );
}
