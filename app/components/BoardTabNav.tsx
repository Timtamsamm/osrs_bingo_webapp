"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BoardTabNav() {
  const pathname = usePathname();

  return (
    <div className="flex justify-center mb-8">
      <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1">
        <TabLink href="/board" active={pathname === "/board"}>Board</TabLink>
        <TabLink href="/leaderboard" active={pathname === "/leaderboard"}>Leaderboard</TabLink>
      </div>
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
        active ? "bg-amber-500 text-gray-950" : "text-gray-400 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
