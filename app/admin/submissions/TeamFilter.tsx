"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function TeamFilter({ teams }: { teams: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("team") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    router.push(val ? `?team=${encodeURIComponent(val)}` : "?");
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      <option value="">All teams</option>
      {teams.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}
