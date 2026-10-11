export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeaderNav from "@/app/components/PageHeaderNav";
import LocalTime from "@/app/components/LocalTime";
import { eventStatus, getClanRoster, splitByRoster, type EventStatus } from "@/lib/clanEvents";
import StatusBadge from "./StatusBadge";

export default async function EventsPage() {
  const [events, roster] = await Promise.all([
    prisma.clanEvent.findMany({
      orderBy: { startsAt: "desc" },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        bossFilter: true,
        attendees: { select: { rsn: true } },
      },
    }),
    getClanRoster(),
  ]);

  const now = new Date();
  const withStatus = events.map((e) => ({
    ...e,
    status: eventStatus(e, now),
    memberCount: splitByRoster(e.attendees, roster).members.length,
  }));
  const live = withStatus.filter((e) => e.status === "live");
  // Soonest first for upcoming; most recent first for past.
  const upcoming = withStatus.filter((e) => e.status === "upcoming").reverse();
  const past = withStatus.filter((e) => e.status === "ended");

  return (
    <div className="min-h-screen bg-base text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <PageHeaderNav adminHref="/events/admin">
            <h1 className="font-[family-name:var(--font-cinzel)] text-4xl md:text-5xl font-black text-white heading-glow pt-1">
              Clan Events
            </h1>
            <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mt-3">Attendance &amp; drops</p>
          </PageHeaderNav>
        </div>

        {events.length === 0 && (
          <p className="text-center text-sm text-purple-600/70">No events have been scheduled yet.</p>
        )}

        <EventSection title="Live now" events={live} />
        <EventSection title="Upcoming" events={upcoming} />
        <EventSection title="Past events" events={past} />
      </div>
    </div>
  );
}

type ListedEvent = {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  bossFilter: string | null;
  status: EventStatus;
  memberCount: number;
};

function EventSection({ title, events }: { title: string; events: ListedEvent[] }) {
  if (!events.length) return null;
  return (
    <section className="mb-8">
      <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-white heading-glow mb-3">{title}</h2>
      <div className="flex flex-col gap-3">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="bg-[#0e0820] border border-purple-900/40 rounded-2xl p-4 flex flex-wrap items-center gap-x-4 gap-y-2 hover:border-purple-600/60 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-purple-100 truncate">{e.name}</p>
                <StatusBadge status={e.status} />
              </div>
              <p className="text-xs text-purple-400/70 mt-1">
                <LocalTime date={e.startsAt} /> – <LocalTime date={e.endsAt} />
                {e.bossFilter && <span className="text-purple-500/70"> · {e.bossFilter}</span>}
              </p>
            </div>
            <p className="text-sm text-purple-300 tabular-nums shrink-0">
              {e.memberCount} member{e.memberCount === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
