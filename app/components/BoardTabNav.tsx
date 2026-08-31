"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BoardTabNav() {
  const pathname = usePathname();

  return (
    <div className="flex justify-center mb-6">
      <div className="flex bg-surface/80 border border-purple-900/40 rounded-xl p-1 gap-1">
        <TabLink href="/bingo/board" active={pathname === "/bingo/board"}>Board</TabLink>
        <TabLink href="/bingo/teams" active={pathname === "/bingo/teams" || pathname.startsWith("/bingo/team/")}>Teams</TabLink>
        <TabLink href="/bingo/players" active={pathname === "/bingo/players"}>Players</TabLink>
        <TabLink href="/bingo/recent-drops" active={pathname === "/bingo/recent-drops"}>Recent Drops</TabLink>
      </div>
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
        active ? "text-white" : "text-purple-500 hover:text-purple-300"
      }`}
      style={active ? {
        backgroundColor: "rgb(var(--accent) / 0.55)",
        boxShadow: "0 0 6px rgb(var(--accent) / 0.45), 0 0 18px rgb(var(--accent) / 0.12)",
      } : undefined}
    >
      {children}
    </Link>
  );
}
