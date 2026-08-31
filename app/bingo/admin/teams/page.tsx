import { prisma } from "@/lib/prisma";
import { fetchGroupMembers } from "@/lib/wiseoldman";
import TeamsEditor from "./TeamsEditor";

export default async function AdminTeamsPage() {
  const [teams, members] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: { participants: { orderBy: { rsn: "asc" } } },
    }),
    fetchGroupMembers(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-purple-100 heading-glow">
          Teams
        </h1>
        <span className="text-sm text-purple-500/80">{teams.length} team{teams.length !== 1 ? "s" : ""}</span>
      </div>
      <TeamsEditor teams={teams} members={members} />
    </div>
  );
}
