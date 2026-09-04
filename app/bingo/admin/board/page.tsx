import { prisma } from "@/lib/prisma";
import BoardEditor from "./BoardEditor";
import ResetBoardButton from "./ResetBoardButton";
import TempleSnapshotResetButton from "./TempleSnapshotResetButton";

export default async function AdminBoardPage() {
  const [board, snapshotCount] = await Promise.all([
    prisma.bingoBoard.findFirst({
      where: { active: true },
      include: { tiles: { orderBy: { position: "asc" } } },
    }),
    prisma.templeSnapshot.count({ where: { board: { active: true } } }),
  ]);

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
            scoringMode: t.scoringMode,
            tiers: (t.tiers ?? []) as unknown as import("./BoardEditor").TierDef[] | null,
            pointsConfig: (t.pointsConfig ?? null) as unknown as import("./BoardEditor").PointsConfig | null,
          })),
        } : null} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-purple-600 uppercase tracking-wider mb-3">TempleOSRS</h2>
        <TempleSnapshotResetButton
          takenAt={board?.templeSnapshotTakenAt?.toISOString() ?? null}
          snapshotCount={snapshotCount}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-purple-600 uppercase tracking-wider mb-3">Danger zone</h2>
        <ResetBoardButton />
      </div>
    </div>
  );
}
