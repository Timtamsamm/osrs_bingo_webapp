export const dynamic = "force-dynamic";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import BoardTabNav from "@/app/components/BoardTabNav";
import LeaderboardRow from "./LeaderboardRow";
import GameFrame from "@/app/components/GameFrame";

const BINGO_SWEATS_IMAGES = [
  "/130px-Golden_tench_detail.png",   // 1st
  "/1024px-Swift_marlin_detail.png",  // 2nd
  "/130px-Big_harpoonfish_detail.png",// 3rd
];

const WOODEN_SPOON_IMAGES = [
  "/800px-Scarab_dung_detail.png",  // 1st worst
  "/100px-Onion_detail.png",        // 2nd worst
  "/Saltpetre_detail.png",          // 3rd worst
];

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
      where: { role: "PLAYER" },
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

  // Per-individual-member points across all teams
  const allMembers: { name: string; teamUsername: string; points: number }[] = [];
  for (const player of ranked) {
    const memberPoints = new Map<string, number>();
    for (const tile of player.tiles) {
      for (const sub of tile.userSubmissions) {
        if (sub.status === "REJECTED" || !sub.teamMember) continue;
        memberPoints.set(sub.teamMember, (memberPoints.get(sub.teamMember) ?? 0) + tile.pointsPerSubmission);
      }
    }
    for (const member of player.teamMembers) {
      allMembers.push({ name: member, teamUsername: player.username, points: memberPoints.get(member) ?? 0 });
    }
  }
  const sortedMembers = [...allMembers].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const top3 = sortedMembers.slice(0, 3);
  const bottom3 = sortedMembers.slice(-3).reverse();

  return (
    <GameFrame>
      <div className="max-w-3xl mx-auto p-4">
        <div className="relative mb-6 text-center pt-3">
          <h1 className="text-2xl font-bold">{board?.name ?? "Bingo Board"}</h1>
          {board && <p className="text-gray-400 text-sm mt-1">Leaderboard</p>}
          <div className="absolute right-0 top-0 flex flex-col items-end gap-2">
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

        {allMembers.length > 0 && (
          <div className="flex gap-3 mb-6 flex-wrap">
            {/* Top 3 MVPs */}
            <div className="flex-1 min-w-48 rounded-xl border border-stone-700/60 bg-stone-900/90 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Bingo Sweats</p>
              <div className="flex flex-col gap-2">
                {top3.map((m, i) => (
                  <div key={`${m.teamUsername}-${m.name}`} className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={BINGO_SWEATS_IMAGES[i]} alt="" width={24} height={24} className="object-contain shrink-0" />
                    <span className="text-sm font-medium text-white truncate flex-1">{m.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">{m.teamUsername}</span>
                    <span className="text-xs font-semibold text-amber-400 shrink-0 tabular-nums">{+m.points.toFixed(1)} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Wooden Spoon — bottom 3 */}
            {bottom3.length > 0 && (
              <div className="flex-1 min-w-48 rounded-xl border border-stone-700/60 bg-stone-900/90 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Leeches</p>
                <div className="flex flex-col gap-2">
                  {bottom3.map((m, i) => (
                    <div key={`${m.teamUsername}-${m.name}`} className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={WOODEN_SPOON_IMAGES[i]}
                        alt=""
                        width={24}
                        height={24}
                        className="object-contain shrink-0"
                      />
                      <span className="text-sm font-medium text-gray-400 truncate flex-1">{m.name}</span>
                      <span className="text-xs text-gray-500 shrink-0">{m.teamUsername}</span>
                      <span className="text-xs font-semibold text-gray-500 shrink-0 tabular-nums">{+m.points.toFixed(1)} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
    </GameFrame>
  );
}
