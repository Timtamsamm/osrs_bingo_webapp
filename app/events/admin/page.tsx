import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ensureEventsToken, eventStatus } from "@/lib/clanEvents";
import LocalTime from "@/app/components/LocalTime";
import StatusBadge from "../StatusBadge";
import WebhookSetup from "./WebhookSetup";
import EventForm from "./EventForm";

export default async function EventsAdminPage() {
  // Build the webhook link from the request's own host so it's right on
  // localhost, preview deployments and production alike.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const [token, bosses, events] = await Promise.all([
    ensureEventsToken(),
    prisma.boss.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.clanEvent.findMany({
      orderBy: { startsAt: "desc" },
      select: { id: true, name: true, startsAt: true, endsAt: true, _count: { select: { attendees: true, activity: true } } },
    }),
  ]);


  return (
    <div className="flex flex-col gap-8 max-w-3xl w-full mx-auto">
      <div>
        <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold mb-2 text-purple-100 heading-glow">
          Clan Events
        </h1>
        <p className="text-sm text-purple-500/70">
          Separate from bingo — events have their own webhook link and never touch the bingo board.
        </p>
      </div>

      <WebhookSetup origin={origin} initialToken={token} />

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-purple-100">Events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-purple-600/70">No events yet — create one below.</p>
        ) : (
          events.map((e) => (
            <Link
              key={e.id}
              href={`/events/admin/${e.id}`}
              className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-4 flex flex-wrap items-center gap-x-4 gap-y-1 hover:border-purple-600/60 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-purple-100 truncate">{e.name}</p>
                  <StatusBadge status={eventStatus(e)} />
                </div>
                <p className="text-xs text-purple-400/70 mt-1">
                  <LocalTime date={e.startsAt} /> – <LocalTime date={e.endsAt} />
                </p>
              </div>
              <p className="text-xs text-purple-400 tabular-nums">
                {e._count.attendees} attendees · {e._count.activity} kills/drops
              </p>
            </Link>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-purple-100">New event</h2>
        <EventForm bossNames={bosses.map((b) => b.name)} />
      </section>
    </div>
  );
}
