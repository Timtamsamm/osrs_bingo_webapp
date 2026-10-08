import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Countdown from "@/app/components/Countdown";

// Before the active board's start time, every public bingo page shows only this
// countdown so the tiles can't be scouted early. Admins bypass it so they can
// preview the board before launch (app/bingo/layout.tsx shows them PreStartAdminNotice).
// Call at the top of a page: `const gate = await getPreStartGate(); if (gate) return gate;`
export async function getPreStartGate(): Promise<React.ReactNode | null> {
  const board = await getUpcomingBoard();
  if (!board?.startsAt) return null;

  const session = await auth();
  if (session?.user?.role === "ADMIN") return null;

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-6">
      <div className="text-center flex flex-col items-center gap-6">
        <p className="text-xs tracking-[0.3em] text-purple-500 uppercase">Upcoming Event</p>
        <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow">
          {board.name}
        </h1>
        {board.description && <p className="text-purple-300/70 text-sm max-w-sm">{board.description}</p>}
        <Countdown endsAt={board.startsAt.toISOString()} label="Starts in" reloadOnExpire />
        <p className="text-sm text-purple-500/60">
          {board.startsAt.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}
        </p>
      </div>
    </div>
  );
}

// Active board, but only while its start time is still in the future.
async function getUpcomingBoard() {
  const board = await prisma.bingoBoard.findFirst({
    where: { active: true },
    select: { name: true, description: true, startsAt: true },
  });
  return board?.startsAt && board.startsAt > new Date() ? board : null;
}

export async function PreStartAdminNotice() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return null;
  if (!(await getUpcomingBoard())) return null;

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-max max-w-[calc(100vw-2rem)] rounded-full border border-amber-500/40 bg-amber-950/90 px-4 py-2 text-xs text-amber-200 shadow-lg backdrop-blur text-center">
      Event hasn&apos;t started — public pages are hidden from players until it does.
    </div>
  );
}
