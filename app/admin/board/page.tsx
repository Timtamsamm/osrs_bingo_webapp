import { prisma } from "@/lib/prisma";
import BoardEditor from "./BoardEditor";
import ResetBoardButton from "./ResetBoardButton";

export default async function AdminBoardPage() {
  const board = await prisma.bingoBoard.findFirst({
    where: { active: true },
    include: { tiles: { orderBy: { position: "asc" } } },
  });

  return (
    <div className="max-w-4xl flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-bold mb-8">Board & Tiles</h1>
        <BoardEditor board={board} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Danger zone</h2>
        <ResetBoardButton />
      </div>
    </div>
  );
}
