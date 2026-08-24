export const dynamic = "force-dynamic";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import BoardTabNav from "@/app/components/BoardTabNav";
import Countdown from "@/app/components/Countdown";
import GameFrame from "@/app/components/GameFrame";
import { checkEventPasscode } from "@/lib/event-passcode";
import BoardView from "./BoardView";
import type { TileSummary } from "./BoardView";

export default async function BoardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  await checkEventPasscode(session.user.role);

  const [currentUser, board] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { teamMembers: true, role: true },
    }),
    prisma.bingoBoard.findFirst({
      where: { active: true },
      include: {
        tiles: {
          orderBy: { position: "asc" },
          include: {
            submissions: {
              where: { userId: session.user.id },
              select: { id: true, status: true },
            },
          },
        },
      },
    }),
  ]);

  // Pre-event gate — show countdown screen if event hasn't started yet
  if (board?.startsAt && board.startsAt > new Date()) {
    return (
      <GameFrame>
        <div className="h-full flex flex-col items-center justify-center p-4">
          <div className="flex flex-col items-center gap-6 text-center">
            <div>
              <h1 className="text-3xl font-bold">{board.name}</h1>
              {board.description && <p className="text-gray-400 mt-2 text-sm">{board.description}</p>}
            </div>
            <Countdown endsAt={board.startsAt.toISOString()} label="Starts in" reloadOnExpire />
            <p className="text-sm text-gray-500">
              {board.startsAt.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}
            </p>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button type="submit" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mt-4">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </GameFrame>
    );
  }

  const earnedPoints = board?.tiles.reduce((sum, tile) => {
    const active = tile.submissions.filter((s) => s.status !== "REJECTED").length;
    return sum + Math.min(active, tile.requiredCount) * tile.pointsPerSubmission;
  }, 0) ?? 0;

  const totalPoints = board?.tiles.reduce((sum, tile) => sum + tile.points, 0) ?? 0;

  const tiles: TileSummary[] = (board?.tiles ?? []).map((tile) => {
    const approved = tile.submissions.filter((s) => s.status === "APPROVED").length;
    const active = tile.submissions.filter((s) => s.status !== "REJECTED").length;
    const onlyRejected = tile.submissions.length > 0 && active === 0;
    const completed = approved >= tile.requiredCount;
    const inProgress = tile.requiredCount > 1 && active > 0 && !completed;
    const awaiting = !completed && !inProgress && active > 0;
    return {
      id: tile.id,
      title: tile.title,
      description: tile.description,
      points: tile.points,
      pointsPerSubmission: tile.pointsPerSubmission,
      requiredCount: tile.requiredCount,
      imageUrl: tile.imageUrl,
      active,
      approved,
      completed,
      inProgress,
      awaiting,
      onlyRejected,
    };
  });

  const boardIsEmpty = !board || board.tiles.every((t) => !t.title.trim());

  return (
    <GameFrame>
      <div className="max-w-3xl mx-auto p-4">
        <div className="relative mb-6 text-center pt-3">
          <h1 className="text-2xl font-bold">{board?.name ?? "Bingo Board"}</h1>
          {board?.description && (
            <p className="text-gray-400 text-sm mt-1">{board.description}</p>
          )}
          <div className="absolute right-0 top-0 flex flex-col items-end gap-2">
            {board && (
              <p className="text-sm font-semibold">
                <span className="text-amber-400">{+earnedPoints.toFixed(1)}</span>
                <span className="text-gray-500"> / {+totalPoints.toFixed(1)} pts</span>
              </p>
            )}
            <div className="flex items-center gap-3">
              {currentUser?.role === "ADMIN" && (
                <Link href="/admin" className="text-xs text-amber-500 hover:text-amber-400 transition-colors font-medium">
                  Admin
                </Link>
              )}
              {currentUser?.role === "PLAYER" && (
                <Link href="/team" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  My Team
                </Link>
              )}
              <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
                <button type="submit" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>

        {board?.endsAt && <Countdown endsAt={board.endsAt.toISOString()} label="Ends in" />}

        {currentUser?.role === "PLAYER" && currentUser.teamMembers.length === 0 && (
          <Link
            href="/team"
            className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-4 hover:bg-amber-500/20 transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-amber-300">Set up your team roster</p>
              <p className="text-xs text-amber-500/70 mt-0.5">Add your team members so they appear on the leaderboard</p>
            </div>
            <span className="text-amber-400 text-sm shrink-0 ml-4">→</span>
          </Link>
        )}

        <BoardTabNav />

        {boardIsEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-4xl mb-4">🔨</p>
            <p className="text-lg font-semibold text-gray-300">The board is still being designed</p>
            <p className="text-sm text-gray-500 mt-1">Check back soon — the next event is being set up.</p>
          </div>
        ) : (
          <BoardView tiles={tiles} />
        )}
      </div>
    </GameFrame>
  );
}
