import { prisma } from "@/lib/prisma";
import SubmissionReviewer from "./SubmissionReviewer";
import TeamFilter from "./TeamFilter";
import ManualAwardForm from "./ManualAwardForm";
import { Suspense } from "react";

type TierDef = { tier: 1 | 2 | 3; points: number; requiredCount: number; dinkItems: Array<{ id: number; name: string }> };

interface Props {
  searchParams: Promise<{ team?: string }>;
}

export default async function AdminSubmissionsPage({ searchParams }: Props) {
  const { team } = await searchParams;

  const teamFilter = team ? { team: { name: team } } : {};

  const [pending, dinkApproved, allTeams, awardTeams, activeBoard] = await Promise.all([
    prisma.submission.findMany({
      where: { status: "PENDING", ...teamFilter },
      orderBy: { createdAt: "asc" },
      include: {
        team: { select: { name: true } },
        tile: { select: { title: true } },
      },
    }),
    prisma.submission.findMany({
      where: { status: "APPROVED", source: "dink", ...teamFilter },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        team: { select: { name: true } },
        tile: { select: { title: true } },
      },
    }),
    prisma.team.findMany({
      where: { submissions: { some: {} } },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: { tiles: { select: { id: true, title: true, tiers: true }, orderBy: { position: "asc" } } },
    }),
  ]);

  const teamNames = allTeams.map((t) => t.name);
  const awardTiles = (activeBoard?.tiles ?? []).map((t) => ({ id: t.id, title: t.title, tiers: (t.tiers as TierDef[]) ?? [] }));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-purple-100 heading-glow">
          Submissions
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-purple-500/80">{pending.length} pending</span>
          <Suspense>
            <TeamFilter teams={teamNames} />
          </Suspense>
        </div>
      </div>

      <ManualAwardForm teams={awardTeams} tiles={awardTiles} />

      {pending.length === 0 ? (
        <p className="text-purple-600/70">{team ? `No pending submissions for ${team}.` : "No pending submissions."}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((s) => (
            <SubmissionReviewer key={s.id} submission={s} />
          ))}
        </div>
      )}

      {dinkApproved.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-purple-600 uppercase tracking-wider mb-4">
            Dink Auto-Approved
            <span className="ml-2 text-purple-700 font-normal normal-case">— reject to undo a false positive</span>
          </h2>
          <div className="flex flex-col gap-4">
            {dinkApproved.map((s) => (
              <SubmissionReviewer key={s.id} submission={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
