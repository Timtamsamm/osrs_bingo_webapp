import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Admin</p>
          <p className="font-bold text-amber-400">OSRS Bingo</p>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          <NavLink href="/admin">Dashboard</NavLink>
          <NavLink href="/admin/board">Board & Tiles</NavLink>
          <NavLink href="/admin/submissions">Submissions</NavLink>
          <NavLink href="/admin/users">Teams</NavLink>
        </nav>
        <div className="p-3 border-t border-gray-800">
          <Link href="/" className="block text-sm text-gray-500 hover:text-white px-3 py-2 rounded-lg transition-colors">
            ← Back to app
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
    >
      {children}
    </Link>
  );
}
