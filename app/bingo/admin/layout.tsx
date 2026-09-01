import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/app/components/LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen bg-[#080510] text-white flex flex-col md:flex-row" style={{ "--accent": "168 85 247", "--accent-h": "271", "--bg-base": "hsl(271 70% 4%)", "--bg-surface": "hsl(271 70% 7%)", "--bg-raised": "hsl(271 70% 10%)" } as React.CSSProperties}>
      <aside className="md:w-56 md:shrink-0 bg-[#0a0618] border-b md:border-b-0 md:border-r border-purple-900/40 flex flex-col">
        <div className="px-4 py-3 md:px-6 md:py-5 border-b border-purple-900/40">
          <p className="text-[10px] text-purple-600 uppercase tracking-widest mb-1">Admin</p>
          <p className="font-[family-name:var(--font-cinzel)] font-bold text-purple-300 heading-glow text-sm">
            Wong Tongs
          </p>
        </div>
        <nav className="flex flex-row md:flex-col gap-1 p-2 md:p-3 overflow-x-auto md:overflow-visible md:flex-1">
          <NavLink href="/bingo/admin">Dashboard</NavLink>
          <NavLink href="/bingo/admin/board">Board &amp; Tiles</NavLink>
          <NavLink href="/bingo/admin/submissions">Submissions</NavLink>
          <NavLink href="/bingo/admin/teams">Teams</NavLink>
        </nav>
        <div className="flex flex-row md:flex-col gap-1 p-2 md:p-3 border-t border-purple-900/30 overflow-x-auto md:overflow-visible">
          <Link
            href="/bingo/board"
            className="shrink-0 whitespace-nowrap text-sm text-purple-600 hover:text-purple-300 px-3 py-2 rounded-lg transition-colors"
          >
            ← Board
          </Link>
          <Link
            href="/"
            className="shrink-0 whitespace-nowrap text-sm text-purple-600 hover:text-purple-300 px-3 py-2 rounded-lg transition-colors"
          >
            ← Home
          </Link>
          <LogoutButton className="shrink-0 whitespace-nowrap text-sm text-purple-600 hover:text-red-400 px-3 py-2 rounded-lg transition-colors" />
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 md:p-6 overflow-auto">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-sm text-purple-400 hover:bg-purple-900/30 hover:text-purple-200 transition-colors"
    >
      {children}
    </Link>
  );
}
