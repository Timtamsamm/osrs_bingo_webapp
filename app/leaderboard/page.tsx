export const dynamic = "force-dynamic";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import BoardTabNav from "@/app/components/BoardTabNav";
import LeaderboardRow from "./LeaderboardRow";

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [board, users] = await Promise.all([
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: {
        name: true,
        tiles: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
            points: true,
            pointsPerSubmission: true,
            requiredCount: true,
            imageUrl: true,
            submissions: {
              select: { userId: true, status: true, teamMember: true },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      select: { id: true, username: true, teamMembers: true },
      orderBy: { username: "asc" },
    }),
  ]);

  const totalPoints = board?.tiles.reduce((sum, t) => sum + t.points, 0) ?? 0;

  const ranked = users
    .map((user) => {
      const tiles = (board?.tiles ?? []).map((tile) => ({
        id: tile.id,
        title: tile.title,
        points: tile.points,
        pointsPerSubmission: tile.pointsPerSubmission,
        requiredCount: tile.requiredCount,
        imageUrl: tile.imageUrl,
        userSubmissions: tile.submissions
          .filter((s) => s.userId === user.id)
          .map((s) => ({ status: s.status as "PENDING" | "APPROVED" | "REJECTED", teamMember: s.teamMember })),
      }));

      const earned = tiles.reduce((sum, tile) => {
        const active = tile.userSubmissions.filter((s) => s.status !== "REJECTED").length;
        return sum + Math.min(active, tile.requiredCount) * tile.pointsPerSubmission;
      }, 0);

      return { id: user.id, username: user.username, teamMembers: user.teamMembers, earned, tiles };
    })
    .sort((a, b) => b.earned - a.earned || a.username.localeCompare(b.username));

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{board?.name ?? "Bingo Board"}</h1>
            {board && <p className="text-gray-400 text-sm mt-1">Leaderboard</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            {totalPoints > 0 && (
              <p className="text-sm text-gray-500">
                Max <span className="text-gray-300">{+totalPoints.toFixed(1)}</span> pts
              </p>
            )}
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
              <button type="submit" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <BoardTabNav />

        {ranked.length === 0 ? (
          <p className="text-gray-500">No players yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {ranked.map((player, i) => {
              const isTied = i > 0 && ranked[i - 1].earned === player.earned;
              const rank = isTied ? null : i + 1;

              return (
                <LeaderboardRow
                  key={player.id}
                  player={{ id: player.id, username: player.username, earned: player.earned, teamMembers: player.teamMembers }}
                  tiles={player.tiles}
                  totalPoints={totalPoints}
                  rank={rank}
                  isCurrentUser={player.id === session.user.id}
                  medals={medals}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
