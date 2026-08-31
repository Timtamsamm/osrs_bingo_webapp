import Link from "next/link";
import { prisma } from "@/lib/prisma";
import EventCard from "../EventCard";

export default async function EventsHistoryPage() {
  const now = new Date();

  const past = await prisma.event.findMany({
    where: { endsAt: { lt: now } },
    orderBy: { endsAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-[#080510] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8 relative">
          <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mb-2">Clan</p>
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow">
            Past Events
          </h1>
          <div className="absolute left-0 top-0">
            <Link href="/" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              ← Home
            </Link>
          </div>
          <div className="absolute right-0 top-0">
            <Link href="/events" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              Upcoming →
            </Link>
          </div>
        </div>

        {past.length === 0 ? (
          <p className="text-purple-500/60 text-center py-12">No past events yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {past.map((e) => (
              <EventCard key={e.id} title={e.title} description={e.description} imageUrl={e.imageUrl} participantNames={e.participantNames} startsAt={e.startsAt} endsAt={e.endsAt} status="Past" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
