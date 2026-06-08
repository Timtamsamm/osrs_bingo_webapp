export const dynamic = "force-dynamic";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import BoardTabNav from "@/app/components/BoardTabNav";
import Countdown from "@/app/components/Countdown";

export default async function BoardPage() {
  const session = await auth();
  if (!session) redirect("/login");

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
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
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
      </main>
    );
  }

  const earnedPoints = board?.tiles.reduce((sum, tile) => {
    const active = tile.submissions.filter((s) => s.status !== "REJECTED").length;
    const counted = Math.min(active, tile.requiredCount);
    return sum + counted * tile.pointsPerSubmission;
  }, 0) ?? 0;

  const totalPoints = board?.tiles.reduce((sum, tile) => sum + tile.points, 0) ?? 0;

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
          <div className="flex flex-col items-end gap-2">
            {board && (
              <p className="text-sm font-semibold">
                <span className="text-amber-400">{+earnedPoints.toFixed(1)}</span>
                <span className="text-gray-500"> / {+totalPoints.toFixed(1)} pts</span>
              </p>
            )}
            <div className="flex items-center gap-3">
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

        {!board ? (
          <p className="text-gray-400">No active bingo board found.</p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {board.tiles.map((tile) => {
              const approved = tile.submissions.filter((s) => s.status === "APPROVED").length;
              const active = tile.submissions.filter((s) => s.status !== "REJECTED").length;
              const onlyRejected = tile.submissions.length > 0 && active === 0;
              const completed = approved >= tile.requiredCount;
              // In progress = multi-tile with at least one active submission but not done
              const inProgress = tile.requiredCount > 1 && active > 0 && !completed;
              // Awaiting = single-tile (or multi with no approved yet) submitted but pending review
              const awaiting = !completed && !inProgress && active > 0;

              let borderStyle: string;
              let bgStyle: string;
              let textStyle: string;

              if (completed) {
                borderStyle = "border-green-500";
                bgStyle = "bg-green-500/15";
                textStyle = "text-green-200";
              } else if (inProgress) {
                borderStyle = "border-orange-500";
                bgStyle = "bg-orange-500/10";
                textStyle = "text-orange-200";
              } else if (awaiting) {
                borderStyle = "border-green-700";
                bgStyle = "bg-green-900/15";
                textStyle = "text-gray-200";
              } else if (onlyRejected) {
                borderStyle = "border-red-700";
                bgStyle = "bg-red-900/10";
                textStyle = "text-gray-300";
              } else {
                borderStyle = "border-gray-700 hover:border-gray-500";
                bgStyle = "bg-gray-900";
                textStyle = "text-gray-300";
              }

              return (
                <Link
                  key={tile.id}
                  href={`/submit?tileId=${tile.id}`}
                  className={`relative aspect-square rounded-xl border-2 text-xs font-medium transition-all hover:scale-[1.03] overflow-hidden ${borderStyle} ${bgStyle}`}
                >
                  {/* Full-tile image */}
                  {tile.imageUrl && (
                    <Image
                      src={tile.imageUrl}
                      alt={tile.title}
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  )}

                  {/* State colour tint over image */}
                  {tile.imageUrl && <div className={`absolute inset-0 ${bgStyle} opacity-50`} />}

                  {/* Status badge */}
                  <div className="absolute top-1.5 right-1.5 z-10">
                    {completed  && <span className="text-green-400 text-sm leading-none">✓</span>}
                    {inProgress && <span className="text-orange-400 text-xs font-bold leading-none">{active}/{tile.requiredCount}</span>}
                    {awaiting   && <span className="block w-2 h-2 rounded-full bg-green-500" />}
                    {onlyRejected && <span className="text-red-400 text-sm leading-none">✕</span>}
                  </div>

                  {/* Text — gradient overlay at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 z-10 px-1.5 pt-4 pb-1.5 text-center bg-gradient-to-t from-black/80 to-transparent">
                    <p className={`line-clamp-2 leading-tight ${textStyle}`}>{tile.title}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{+tile.points.toFixed(1)}pt</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-4 mt-6 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-green-500 bg-green-500/15" />Completed</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-orange-500 bg-orange-500/10" />In progress</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-green-700 bg-green-900/15" />Awaiting review</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-red-700 bg-red-900/10" />Rejected</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-gray-700 bg-gray-900" />Not started</span>
        </div>
      </div>
    </main>
  );
}
