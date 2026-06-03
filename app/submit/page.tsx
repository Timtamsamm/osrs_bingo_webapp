import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SubmitForm from "./SubmitForm";

interface Props {
  searchParams: Promise<{ tileId?: string }>;
}

export default async function SubmitPage({ searchParams }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { tileId } = await searchParams;
  if (!tileId) redirect("/board");

  const tile = await prisma.bingoTile.findUnique({
    where: { id: tileId },
  });

  if (!tile) redirect("/board");

  const existing = await prisma.submission.findFirst({
    where: { userId: session.user.id, tileId, status: { not: "REJECTED" } },
  });

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-1">{tile.title}</h1>
        {tile.description && (
          <p className="text-gray-400 text-sm mb-6">{tile.description}</p>
        )}

        {existing ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className="text-gray-300">
              You already have a{" "}
              <span
                className={
                  existing.status === "APPROVED"
                    ? "text-green-400"
                    : "text-amber-400"
                }
              >
                {existing.status.toLowerCase()}
              </span>{" "}
              submission for this tile.
            </p>
          </div>
        ) : (
          <SubmitForm tileId={tile.id} userId={session.user.id} />
        )}
      </div>
    </main>
  );
}
