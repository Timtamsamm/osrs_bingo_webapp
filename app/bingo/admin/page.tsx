import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminDashboard() {
  const [pendingCount, teamCount, board] = await Promise.all([
    prisma.submission.count({ where: { status: "PENDING" } }),
    prisma.team.count(),
    prisma.bingoBoard.findFirst({
      where: { active: true },
      include: { _count: { select: { tiles: { where: { title: { not: "" } } } } } },
    }),
  ]);

  const stats = [
    { label: "Pending Submissions", value: pendingCount, href: "/bingo/admin/submissions", urgent: pendingCount > 0 },
    { label: "Teams", value: teamCount, href: "/bingo/admin/teams", urgent: false },
    { label: "Active Board Tiles", value: board?._count.tiles ?? 0, href: "/bingo/admin/board", urgent: false },
  ];

  return (
    <div>
      <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold mb-8 text-purple-100 heading-glow">
        Dashboard
      </h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`rounded-xl border p-5 flex flex-col gap-2 transition-all hover:border-purple-500/50 hover:purple-glow-sm
              ${s.urgent
                ? "border-purple-500/50 bg-purple-500/10 purple-glow-sm"
                : "border-purple-900/40 bg-[#0e0820]"
              }`}
          >
            <span className={`text-3xl font-bold ${s.urgent ? "text-purple-300" : "text-white"}`}>
              {s.value}
            </span>
            <span className="text-sm text-purple-500/80">{s.label}</span>
          </Link>
        ))}
      </div>

      {!board && (
        <div className="bg-[#0e0820] border border-dashed border-purple-900/50 rounded-xl p-6 text-center">
          <p className="text-purple-400/60 mb-3">No active bingo board yet.</p>
          <Link href="/bingo/admin/board" className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors">
            Create one →
          </Link>
        </div>
      )}
    </div>
  );
}
