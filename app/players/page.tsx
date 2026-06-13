export const dynamic = "force-dynamic";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import BoardTabNav from "@/app/components/BoardTabNav";
import PlayersFilter from "./PlayersFilter";
import GameFrame from "@/app/components/GameFrame";
import type { BossKCs } from "@/lib/temple";

export default async function PlayersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [board, users] = await Promise.all([
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: {
        name: true,
        snapshots: { select: { memberName: true, bosses: true } },
      },
    }),
    prisma.user.findMany({
      select: { username: true, teamMembers: true },
      where: { role: "PLAYER" },
      orderBy: { username: "asc" },
    }),
  ]);

  const snapshotMap = new Map<string, BossKCs>();
  for (const s of board?.snapshots ?? []) {
    snapshotMap.set(s.memberName.toLowerCase(), s.bosses as BossKCs);
  }

  // Deduplicate members, keep team association for display
  const seen = new Set<string>();
  const players: { memberName: string; teamUsername: string; snapshot: BossKCs | null }[] = [];
  for (const user of users) {
    for (const member of user.teamMembers) {
      if (seen.has(member.toLowerCase())) continue;
      seen.add(member.toLowerCase());
      players.push({
        memberName: member,
        teamUsername: user.username,
        snapshot: snapshotMap.get(member.toLowerCase()) ?? null,
      });
    }
  }

  const teams = users.map((u) => u.username);

  // Collect all bosses that appear with KC > 0 in any snapshot
  const bossSet = new Set<string>();
  for (const snapshot of snapshotMap.values()) {
    for (const [boss, kc] of Object.entries(snapshot)) {
      if (kc > 0) bossSet.add(boss);
    }
  }
  const bosses = Array.from(bossSet).sort();

  return (
    <GameFrame>
      <div className="max-w-3xl mx-auto p-4">
        <div className="relative mb-6 text-center pt-3">
          <h1 className="text-2xl font-bold">{board?.name ?? "Bingo Board"}</h1>
          <p className="text-gray-400 text-sm mt-1">Players</p>
          <div className="absolute right-0 top-0">
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button type="submit" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Sign out
            </button>
          </form>
          </div>
        </div>

        <BoardTabNav />

        {players.length === 0 ? (
          <p className="text-gray-500">No players registered yet.</p>
        ) : (
          <PlayersFilter players={players} teams={teams} bosses={bosses} />
        )}
      </div>
    </GameFrame>
  );
}
