import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminDashboard() {
  const [pendingCount, userCount, board] = await Promise.all([
    prisma.submission.count({ where: { status: "PENDING" } }),
    prisma.user.count(),
    prisma.bingoBoard.findFirst({ where: { active: true }, include: { _count: { select: { tiles: true } } } }),
  ]);

  const stats = [
    { label: "Pending Submissions", value: pendingCount, href: "/admin/submissions", urgent: pendingCount > 0 },
    { label: "Registered Users", value: userCount, href: "/admin/users", urgent: false },
    { label: "Active Board Tiles", value: board?._count.tiles ?? 0, href: "/admin/board", urgent: false },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`rounded-xl border p-5 flex flex-col gap-2 transition-colors hover:border-amber-500/50
              ${s.urgent ? "border-amber-500/50 bg-amber-500/5" : "border-gray-800 bg-gray-900"}`}
          >
            <span className={`text-3xl font-bold ${s.urgent ? "text-amber-400" : "text-white"}`}>
              {s.value}
            </span>
            <span className="text-sm text-gray-400">{s.label}</span>
          </Link>
        ))}
      </div>

      {!board && (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl p-6 text-center">
          <p className="text-gray-400 mb-3">No active bingo board yet.</p>
          <Link href="/admin/board" className="text-amber-400 hover:text-amber-300 text-sm font-medium">
            Create one →
          </Link>
        </div>
      )}
    </div>
  );
}
