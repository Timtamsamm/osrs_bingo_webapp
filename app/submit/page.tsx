export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SubmitForm from "./SubmitForm";
import Link from "next/link";
import Image from "next/image";

interface Props {
  searchParams: Promise<{ tileId?: string }>;
}

const statusLabel: Record<string, { label: string; className: string }> = {
  APPROVED: { label: "Approved", className: "text-green-400" },
  PENDING:  { label: "Awaiting review", className: "text-amber-400" },
  REJECTED: { label: "Rejected", className: "text-red-400" },
};

export default async function SubmitPage({ searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { tileId } = await searchParams;
  if (!tileId) redirect("/board");

  const [tile, currentUser] = await Promise.all([
    prisma.bingoTile.findUnique({ where: { id: tileId } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { teamMembers: true } }),
  ]);
  if (!tile) redirect("/board");

  const submissions = await prisma.submission.findMany({
    where: { userId: session.user.id, tileId, status: { not: "REJECTED" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, imageUrl: true, status: true, note: true, reviewNote: true, createdAt: true },
  });

  const activeSubmissions = submissions.length;
  const approved = submissions.filter((s) => s.status === "APPROVED").length;

  const completed = approved >= tile.requiredCount;
  const canSubmit = activeSubmissions < tile.requiredCount;
  const showProgress = tile.requiredCount > 1;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/board" className="text-gray-500 hover:text-white transition-colors text-sm">← Board</Link>
        </div>
        {tile.imageUrl && (
          <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-4 bg-gray-900">
            <Image src={tile.imageUrl} alt={tile.title} fill sizes="512px" className="object-cover" />
          </div>
        )}
        <h1 className="text-2xl font-bold mb-1">{tile.title}</h1>
        {tile.description && (
          <p className="text-gray-400 text-sm mb-4">{tile.description}</p>
        )}

        {showProgress && (
          <p className="text-sm text-gray-400 mb-6">
            Submitted: <span className="text-white font-medium">{activeSubmissions} / {tile.requiredCount}</span>
            {approved > 0 && (
              <span className="text-green-400 ml-2">({approved} approved)</span>
            )}
          </p>
        )}

        {submissions.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            {submissions.map((sub) => {
              const badge = statusLabel[sub.status] ?? statusLabel.PENDING;
              return (
                <div key={sub.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="relative w-full aspect-video">
                    <Image
                      src={sub.imageUrl}
                      alt="Your submission"
                      fill
                      sizes="(max-width: 512px) 100vw, 512px"
                      className="object-cover"
                    />
                  </div>
                  <div className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                      {sub.reviewNote && (
                        <p className="text-xs text-gray-400">{sub.reviewNote}</p>
                      )}
                      {sub.note && (
                        <p className="text-xs text-gray-500 italic">&ldquo;{sub.note}&rdquo;</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-600 shrink-0">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {completed ? (
          <div className="bg-green-900/20 border border-green-700 rounded-xl p-6 text-center">
            <p className="text-green-300 font-medium">Tile completed ✓</p>
          </div>
        ) : !canSubmit ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className="text-gray-300">Max submissions reached for this tile.</p>
          </div>
        ) : (
          <SubmitForm tileId={tile.id} teamMembers={currentUser?.teamMembers ?? []} />
        )}
      </div>
    </main>
  );
}
