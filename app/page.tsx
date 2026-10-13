export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const now = new Date();
  const liveEvent = await prisma.clanEvent.findFirst({
    where: { startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
    select: { name: true },
  });

  const sections = [
    {
      href: "/bingo/board",
      title: "Bingo",
      live: null as string | null,
    },
    {
      href: "/events",
      title: "Events",
      live: liveEvent ? `Live: ${liveEvent.name}` : null,
    },
  ];

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10 flex flex-col items-center">
          <Image
            src="/bingo-beasts-logo.webp"
            alt="Bingo Beasts"
            width={96}
            height={96}
            priority
            className="mb-4"
            style={{ objectFit: "contain" }}
          />
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow mb-2">
            Bingo Beasts
          </h1>
          <p className="text-purple-500 text-sm">Pick a section to get started.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-2xl border border-purple-900/40 bg-[#0e0820] p-6 transition-all hover:border-purple-500/50 purple-glow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-[family-name:var(--font-cinzel)] text-3xl font-black text-white">{s.title}</h2>
                <span className="text-2xl text-purple-500 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all">→</span>
              </div>
              {s.live && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-green-300 bg-green-500/10 border border-green-500/40 rounded-full px-2.5 py-0.5 max-w-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  <span className="truncate">{s.live}</span>
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
