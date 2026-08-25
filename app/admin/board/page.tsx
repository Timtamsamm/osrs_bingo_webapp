import { prisma } from "@/lib/prisma";
import BoardEditor from "./BoardEditor";
import ResetBoardButton from "./ResetBoardButton";
import SnapshotButton from "./SnapshotButton";

export default async function AdminBoardPage() {
  const [board, snapshotInfo] = await Promise.all([
    prisma.bingoBoard.findFirst({
      where: { active: true },
      include: { tiles: { orderBy: { position: "asc" } } },
    }),
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: {
        snapshots: {
          select: { takenAt: true },
          orderBy: { takenAt: "desc" },
          take: 1,
        },
        _count: { select: { snapshots: true } },
      },
    }),
  ]);

  const latestSnapshot = snapshotInfo?.snapshots[0] ?? null;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold mb-8 text-purple-100 heading-glow">
          Board &amp; Tiles
        </h1>
        <BoardEditor board={board ? {
          ...board,
          rowColBonuses: (board.rowColBonuses ?? { t1: 0, t2: 0, t3: 0 }) as unknown as { t1: number; t2: number; t3: number },
          tiles: board.tiles.map((t) => ({
            ...t,
            tiers: (t.tiers ?? []) as unknown as import("./BoardEditor").TierDef[] | null,
          })),
        } : null} />
      </div>

      <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-6">
        <SnapshotButton
          snapshotCount={snapshotInfo?._count.snapshots ?? 0}
          snapshotTakenAt={latestSnapshot?.takenAt.toISOString() ?? null}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-purple-600 uppercase tracking-wider mb-3">Danger zone</h2>
        <ResetBoardButton />
      </div>
    </div>
  );
}
