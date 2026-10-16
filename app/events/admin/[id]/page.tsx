import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { eventStatus, findClanMember, formatClanRole, formatGp, getClanRoster, VIA_LABELS } from "@/lib/clanEvents";
import { formatDuration } from "@/lib/killTimes";
import { fetchGroupMembers } from "@/lib/wiseoldman";
import StatusBadge from "../../StatusBadge";
import EventForm from "../EventForm";
import AttendeeManager from "./AttendeeManager";
import ActivityManager from "./ActivityManager";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventAdminPage({ params }: Props) {
  const { id } = await params;
  const [event, roster, clanMembers, bosses, activity] = await Promise.all([
    prisma.clanEvent.findUnique({
      where: { id },
      include: { attendees: { orderBy: { firstSeenAt: "asc" } } },
    }),
    getClanRoster(),
    fetchGroupMembers(),
    prisma.boss.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.clanEventActivity.findMany({
      where: { eventId: id, type: { in: ["KILL", "LOOT"] } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);
  if (!event) notFound();

  return (
    <div className="flex flex-col gap-8 max-w-3xl w-full mx-auto">
      <div>
        <Link href="/events/admin" className="inline-flex items-center gap-1.5 rounded-full border border-purple-800/50 bg-surface/60 px-3.5 py-2 text-sm text-purple-300 hover:text-white hover:border-purple-600/60 hover:bg-raised/60 transition-colors font-medium">
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
          groupEvent: event.groupEvent,
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

      <ActivityManager
        eventId={event.id}
        items={activity.map((a) => {
          const player = findClanMember(roster, a.rsn)?.displayName ?? a.rsn;
          const at = a.createdAt.toISOString();
          if (a.type === "KILL") {
            return {
              id: a.id,
              type: "KILL" as const,
              player,
              title: `${a.source ?? "Unknown"}${a.killCount != null ? ` · KC ${a.killCount.toLocaleString()}` : ""}`,
              detail: a.durationMs != null ? formatDuration(a.durationMs) : null,
              value: null,
              at,
            };
          }
          const stack = (a.priceEach ?? 0) * (a.quantity ?? 1);
          return {
            id: a.id,
            type: "LOOT" as const,
            player,
            title: `${a.quantity && a.quantity > 1 ? `${a.quantity.toLocaleString()} × ` : ""}${a.itemName ?? "Unknown item"}`,
            detail: a.source,
            value: stack ? formatGp(stack) : null,
            at,
          };
        })}
      />
    </div>
  );
}
