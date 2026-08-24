import { prisma } from "@/lib/prisma";
import SubmissionReviewer from "./SubmissionReviewer";
import PlayerFilter from "./PlayerFilter";
import { Suspense } from "react";

interface Props {
  searchParams: Promise<{ player?: string }>;
}

export default async function AdminSubmissionsPage({ searchParams }: Props) {
  const { player } = await searchParams;

  const playerFilter = player ? { user: { username: player } } : {};

  const [pending, dinkApproved, players] = await Promise.all([
    prisma.submission.findMany({
      where: { status: "PENDING", ...playerFilter },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { username: true } },
        tile: { select: { title: true, requiredCount: true } },
      },
    }),
    prisma.submission.findMany({
      where: { status: "APPROVED", source: "dink", ...playerFilter },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { username: true } },
        tile: { select: { title: true, requiredCount: true } },
      },
    }),
    prisma.user.findMany({
      where: { submissions: { some: { status: "PENDING" } } },
      select: { username: true },
      orderBy: { username: "asc" },
    }),
  ]);

  const playerNames = players.map((p) => p.username);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Submissions</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{pending.length} pending</span>
          <Suspense>
            <PlayerFilter players={playerNames} />
          </Suspense>
        </div>
      </div>

      {pending.length === 0 ? (
        <p className="text-gray-500">{player ? `No pending submissions for ${player}.` : "No pending submissions."}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((s) => (
            <SubmissionReviewer key={s.id} submission={s} />
          ))}
        </div>
      )}

      {dinkApproved.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Dink Auto-Approved
            <span className="ml-2 text-gray-600 font-normal normal-case">— reject to undo a false positive</span>
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
