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
    <div className="max-w-4xl flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-bold mb-8">Board & Tiles</h1>
        <BoardEditor board={board} />
      </div>

      <div>
        <SnapshotButton
          snapshotCount={snapshotInfo?._count.snapshots ?? 0}
          snapshotTakenAt={latestSnapshot?.takenAt.toISOString() ?? null}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Danger zone</h2>
        <ResetBoardButton />
      </div>
    </div>
  );
}
