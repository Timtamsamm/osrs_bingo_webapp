export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import BoardTabNav from "@/app/components/BoardTabNav";

export default async function RulesPage() {
  const [board, settings] = await Promise.all([
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: {
        size: true,
        tiles: {
          orderBy: { position: "asc" },
          select: { id: true, position: true, title: true, rules: true },
        },
      },
    }),
    getSettings(),
  ]);

  const size = board?.size ?? 5;
  const boardTiles = (board?.tiles ?? []).filter((t) => t.position < size * size && t.title.trim());

  return (
    <div className="min-h-screen bg-base text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8 relative">
          <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mb-2">Bingo Event</p>
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl md:text-5xl font-black text-white heading-glow">
            Rules
          </h1>
          <div className="absolute left-0 top-0">
            <Link href="/" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              ← Home
            </Link>
          </div>
          <div className="absolute right-0 top-0">
            <Link href="/bingo/admin" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              Admin →
            </Link>
          </div>
        </div>

        <BoardTabNav />

        <section className="mb-10">
          <h2 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-white heading-glow mb-4">
            General Rules
          </h2>
          <div className="bg-[#0e0820] border border-purple-900/40 rounded-2xl p-5 purple-glow-sm">
            {settings?.generalRules?.trim() ? (
              <p className="text-sm text-purple-200/90 whitespace-pre-line leading-relaxed">{settings.generalRules}</p>
            ) : (
              <p className="text-sm text-purple-600/70">No general rules have been set yet.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-white heading-glow mb-4">
            Board Rules
          </h2>
          {boardTiles.length === 0 ? (
            <p className="text-sm text-purple-600/70">The board is still being set up — no tile rules yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {boardTiles.map((tile) => (
                <div
                  key={tile.id}
                  id={`tile-${tile.id}`}
                  className="bg-[#0e0820] border border-purple-900/40 rounded-2xl p-5 scroll-mt-24 target:border-purple-500 target:ring-2 target:ring-purple-500/40 transition-colors"
                >
                  <h3 className="font-semibold text-purple-100 text-base mb-1.5">{tile.title}</h3>
                  {tile.rules?.trim() ? (
                    <p className="text-sm text-purple-300/80 whitespace-pre-line leading-relaxed">{tile.rules}</p>
                  ) : (
                    <p className="text-sm text-purple-600/60 italic">No specific rules for this tile.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
