import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { eventStatus, findClanMember, formatClanRole, getClanRoster, VIA_LABELS } from "@/lib/clanEvents";
import { fetchGroupMembers } from "@/lib/wiseoldman";
import StatusBadge from "../../StatusBadge";
import EventForm from "../EventForm";
import AttendeeManager from "./AttendeeManager";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventAdminPage({ params }: Props) {
  const { id } = await params;
  const [event, roster, clanMembers, bosses] = await Promise.all([
    prisma.clanEvent.findUnique({
      where: { id },
      include: { attendees: { orderBy: { firstSeenAt: "asc" } } },
    }),
    getClanRoster(),
    fetchGroupMembers(),
    prisma.boss.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!event) notFound();

  return (
    <div className="flex flex-col gap-8 max-w-3xl w-full mx-auto">
      <div>
        <Link href="/events/admin" className="text-sm text-purple-400 hover:text-purple-200 transition-colors">
          ← All events
        </Link>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-purple-100 heading-glow">{event.name}</h1>
          <StatusBadge status={eventStatus(event)} />
          <Link href={`/events/${event.id}`} className="text-sm text-purple-400 hover:text-purple-200 transition-colors ml-auto">
            View public page →
          </Link>
        </div>
      </div>

      <EventForm
        bossNames={bosses.map((b) => b.name)}
        event={{
          id: event.id,
          name: event.name,
          description: event.description,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          bossFilter: event.bossFilter,
          minDropValue: event.minDropValue,
          clanOnly: event.clanOnly,
        }}
      />

      <AttendeeManager
        eventId={event.id}
        guestsHidden={event.clanOnly}
        members={clanMembers.map((m) => ({ username: m.username, displayName: m.displayName }))}
        attendees={event.attendees.map((a) => {
          const clan = findClanMember(roster, a.rsn);
          return {
            id: a.id,
            rsn: clan?.displayName ?? a.rsn,
            detail: [clan ? formatClanRole(clan.role) : null, VIA_LABELS[a.via] ?? a.via].filter(Boolean).join(" · "),
            isGuest: !!roster && !clan,
            firstSeenAt: a.firstSeenAt.toISOString(),
          };
        })}
      />
    </div>
  );
}
