import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen bg-[#080510] text-white flex" style={{ "--accent": "168 85 247", "--accent-h": "271", "--bg-base": "hsl(271 70% 4%)", "--bg-surface": "hsl(271 70% 7%)", "--bg-raised": "hsl(271 70% 10%)" } as React.CSSProperties}>
      <aside className="w-56 shrink-0 bg-[#0a0618] border-r border-purple-900/40 flex flex-col">
        <div className="px-6 py-5 border-b border-purple-900/40">
          <p className="text-[10px] text-purple-600 uppercase tracking-widest mb-1">Admin</p>
          <p className="font-[family-name:var(--font-cinzel)] font-bold text-purple-300 heading-glow text-sm">
            OSRS Bingo
          </p>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          <NavLink href="/admin">Dashboard</NavLink>
          <NavLink href="/admin/board">Board &amp; Tiles</NavLink>
          <NavLink href="/admin/submissions">Submissions</NavLink>
          <NavLink href="/admin/teams">Teams</NavLink>
        </nav>
        <div className="p-3 border-t border-purple-900/30">
          <Link
            href="/"
            className="block text-sm text-purple-600 hover:text-purple-300 px-3 py-2 rounded-lg transition-colors"
          >
            ← Back to board
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-sm text-purple-400 hover:bg-purple-900/30 hover:text-purple-200 transition-colors"
    >
      {children}
    </Link>
  );
}
