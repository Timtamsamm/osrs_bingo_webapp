import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function BoardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const board = await prisma.bingoBoard.findFirst({
    where: { active: true },
    include: {
      tiles: {
        orderBy: { position: "asc" },
        include: {
          submissions: {
            where: { userId: session.user.id, status: "APPROVED" },
            select: { id: true },
          },
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{board?.name ?? "Bingo Board"}</h1>
            {board?.description && (
              <p className="text-gray-400 text-sm mt-1">{board.description}</p>
            )}
          </div>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </Link>
        </div>

        {!board ? (
          <p className="text-gray-400">No active bingo board found.</p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {board.tiles.map((tile) => {
              const completed = tile.submissions.length > 0;
              return (
                <Link
                  key={tile.id}
                  href={`/submit?tileId=${tile.id}`}
                  className={`
                    relative aspect-square flex flex-col items-center justify-center
                    rounded-lg border p-2 text-center text-xs font-medium
                    transition-all hover:scale-105
                    ${completed
                      ? "bg-amber-500/20 border-amber-500 text-amber-300"
                      : "bg-gray-900 border-gray-700 text-gray-200 hover:border-amber-500/50"
                    }
                  `}
                >
                  {completed && (
                    <span className="absolute top-1 right-1 text-amber-400 text-base leading-none">
                      ✓
                    </span>
                  )}
                  <span className="line-clamp-3">{tile.title}</span>
                  <span className="mt-1 text-gray-400">{tile.points}pt</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
