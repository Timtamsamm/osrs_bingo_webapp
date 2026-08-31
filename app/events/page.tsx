import Link from "next/link";
import { prisma } from "@/lib/prisma";
import EventCard from "./EventCard";

export default async function EventsPage() {
  const now = new Date();

  const [active, upcoming] = await Promise.all([
    prisma.event.findMany({
      where: { startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { endsAt: "asc" },
    }),
    prisma.event.findMany({
      where: { startsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-[#080510] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8 relative">
          <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mb-2">Clan</p>
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow">
            Events
          </h1>
          <div className="absolute left-0 top-0">
            <Link href="/" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              ← Home
            </Link>
          </div>
          <div className="absolute right-0 top-0">
            <Link href="/events/admin" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              Admin →
            </Link>
          </div>
        </div>

        {active.length > 0 && (
          <div className="mb-8">
            <p className="text-xs tracking-[0.2em] text-purple-400 uppercase font-semibold mb-3">Active now</p>
            <div className="flex flex-col gap-3">
              {active.map((e) => (
                <EventCard key={e.id} title={e.title} description={e.description} imageUrl={e.imageUrl} participantNames={e.participantNames} startsAt={e.startsAt} endsAt={e.endsAt} status="Active" />
              ))}
            </div>
          </div>
        )}

        <div className="mb-8">
          <p className="text-xs tracking-[0.2em] text-purple-400 uppercase font-semibold mb-3">Upcoming</p>
          {upcoming.length === 0 ? (
            <p className="text-purple-500/60 text-sm">No upcoming events scheduled.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {upcoming.map((e) => (
                <EventCard key={e.id} title={e.title} description={e.description} imageUrl={e.imageUrl} participantNames={e.participantNames} startsAt={e.startsAt} endsAt={e.endsAt} status="Upcoming" />
              ))}
            </div>
          )}
        </div>

        <div className="text-center">
          <Link href="/events/history" className="text-sm text-purple-500 hover:text-purple-300 transition-colors font-medium">
            View past events →
          </Link>
        </div>
      </div>
    </div>
  );
}
