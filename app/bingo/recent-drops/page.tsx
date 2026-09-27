import { prisma } from "@/lib/prisma";
import BoardTabNav from "@/app/components/BoardTabNav";
import PageHeaderNav from "@/app/components/PageHeaderNav";
import RecentDropsFilter from "./RecentDropsFilter";

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
          dinkSource: true,
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

  const bosses = [...new Set(drops.map((d) => d.dinkSource).filter((s): s is string => !!s))].sort();

  return (
    <div className="min-h-screen bg-base text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <PageHeaderNav>
            <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow pt-1">
              Recent Drops
            </h1>
            <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mt-3">{board?.name ?? "Bingo Event"}</p>
          </PageHeaderNav>
        </div>

        <BoardTabNav />

        <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5">
          {drops.length === 0 ? (
            <p className="text-sm text-purple-600/70 text-center py-8">No approved drops yet.</p>
          ) : (
            <RecentDropsFilter drops={drops} bosses={bosses} />
          )}
        </div>
      </div>
    </div>
  );
}
