import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BoardTabNav from "@/app/components/BoardTabNav";
import ZoomableThumbnail from "@/app/components/ZoomableThumbnail";

const DROPS_LIMIT = 100;

export default async function RecentDropsPage() {
  const board = await prisma.bingoBoard.findFirst({
    where: { active: true },
    select: { id: true, name: true },
  });

  const drops = board
    ? await prisma.submission.findMany({
        where: { status: "APPROVED", tile: { boardId: board.id } },
        select: {
          id: true,
          tier: true,
          source: true,
          teamMember: true,
          dinkItemName: true,
          pointsAwarded: true,
          imageUrl: true,
          createdAt: true,
          tile: { select: { title: true } },
          team: { select: { id: true, name: true, color: true } },
        },
        orderBy: { createdAt: "desc" },
        take: DROPS_LIMIT,
      })
    : [];

  return (
    <div className="min-h-screen bg-base text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8 relative">
          <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mb-2">{board?.name ?? "Bingo Event"}</p>
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow">
            Recent Drops
          </h1>
          <div className="absolute left-0 top-0">
            <Link href="/" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              ← Home
            </Link>
          </div>
          <div className="absolute right-0 top-0">
            <Link href="/bingo/admin" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              Admin →
            </Link>
          </div>
        </div>

        <BoardTabNav />

        <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5">
          {drops.length === 0 ? (
            <p className="text-sm text-purple-600/70 text-center py-8">No approved drops yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {drops.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#130a28]/60">
                  {d.imageUrl && <ZoomableThumbnail src={d.imageUrl} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-purple-100 truncate">
                      {d.tile.title}{" "}
                      {d.tier != null && <span className="text-purple-500">T{d.tier}</span>}
                      {d.dinkItemName && <span className="text-purple-500"> · {d.dinkItemName}</span>}
                      {d.pointsAwarded != null && <span className="text-purple-500"> · +{+d.pointsAwarded.toFixed(1)}pts</span>}
                    </p>
                    <p className="text-[11px] text-purple-700/70 flex items-center gap-1.5">
                      {d.team && (
                        <Link href={`/bingo/team/${d.team.id}`} className="inline-flex items-center gap-1 hover:text-purple-400 transition-colors">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.team.color }} />
                          {d.team.name}
                        </Link>
                      )}
                      {d.teamMember && <span>· {d.teamMember}</span>}
                      <span>· {d.source}</span>
                    </p>
                  </div>
                  <span className="text-[11px] text-purple-700/60 shrink-0" suppressHydrationWarning>
                    {new Date(d.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
