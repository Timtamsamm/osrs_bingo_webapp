export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import TeamEditor from "./TeamEditor";

export default async function TeamPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [user, board] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true, teamMembers: true },
    }),
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: { maxTeamSize: true },
    }),
  ]);

  if (!user) redirect("/login");

  const maxTeamSize = board?.maxTeamSize ?? 10;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/board" className="text-gray-500 hover:text-white transition-colors text-sm">
            ← Board
          </Link>
        </div>

        <div className="mt-4 mb-8">
          <h1 className="text-2xl font-bold">{user.username}</h1>
          <p className="text-gray-400 text-sm mt-1">Team roster</p>
        </div>

        <TeamEditor
          initialMembers={user.teamMembers}
          maxTeamSize={maxTeamSize}
        />
      </div>
    </main>
  );
}
