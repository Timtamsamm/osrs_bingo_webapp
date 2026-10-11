export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import PageHeaderNav from "@/app/components/PageHeaderNav";
import LocalTime from "@/app/components/LocalTime";
import { eventStatus, formatGp, formatClanRole, getClanRoster, splitByRoster, VIA_LABELS } from "@/lib/clanEvents";
import StatusBadge from "../StatusBadge";
import ZoomableThumbnail from "@/app/components/ZoomableThumbnail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;

  const [event, roster] = await Promise.all([
    prisma.clanEvent.findUnique({
      where: { id },
      include: {
        attendees: { orderBy: { firstSeenAt: "asc" } },
        activity: { orderBy: { createdAt: "desc" } },
      },
    }),
    getClanRoster(),
  ]);
  if (!event) notFound();

  const status = eventStatus(event);

  // Per-player totals, keyed by normalized RSN so they line up with attendees.
  const totals = new Map<string, { kills: number; drops: number; value: number }>();
  let totalKills = 0;
  let totalValue = 0;
  for (const a of event.activity) {
    const t = totals.get(a.rsnKey) ?? { kills: 0, drops: 0, value: 0 };
    if (a.type === "KILL") {
      t.kills++;
      totalKills++;
    } else {
      const value = (a.priceEach ?? 0) * (a.quantity ?? 1);
      t.drops++;
      t.value += value;
      totalValue += value;
    }
    totals.set(a.rsnKey, t);
  }

  const hasActivity = event.activity.length > 0;
  const drops = event.activity
    .filter((a) => a.type === "LOOT")
    .map((a) => ({ ...a, value: (a.priceEach ?? 0) * (a.quantity ?? 1) }));
  const topDrops = [...drops].sort((a, b) => b.value - a.value).slice(0, 15);

  const rankedPlayers = event.attendees
    .map((p) => ({ ...p, ...(totals.get(p.rsnKey) ?? { kills: 0, drops: 0, value: 0 }) }))
    .sort((a, b) => b.kills - a.kills || b.value - a.value);
  // Events are for clan members — the main list is WOM group members who
  // checked in or sent data; anyone else is shown separately as a guest.
  const { members, guests } = splitByRoster(rankedPlayers, roster);

  return (
    <div className="min-h-screen bg-base text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <PageHeaderNav adminHref={`/events/admin/${event.id}`}>
            <h1 className="font-[family-name:var(--font-cinzel)] text-3xl md:text-4xl font-black text-white heading-glow pt-1 px-2 sm:px-28">
              {event.name}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-xs text-purple-400/80">
              <StatusBadge status={status} />
              <span>
                <LocalTime date={event.startsAt} /> – <LocalTime date={event.endsAt} />
              </span>
            </div>
          </PageHeaderNav>
        </div>

        <div className="flex justify-center mb-6">
          <Link href="/events" className="text-sm text-purple-400 hover:text-purple-200 transition-colors">
            ← All events
          </Link>
        </div>

        {(event.description || event.bossFilter) && (
          <div className="bg-[#0e0820] border border-purple-900/40 rounded-2xl p-5 mb-6 flex flex-col gap-2">
            {event.description && (
              <p className="text-sm text-purple-200/90 whitespace-pre-line leading-relaxed">{event.description}</p>
            )}
            {event.bossFilter && (
              <p className="text-xs text-purple-400/80">
                Kills &amp; drops tracked from: <span className="text-purple-200">{event.bossFilter}</span>
              </p>
            )}
          </div>
        )}

        <div className="bg-[#0e0820] border border-purple-900/40 rounded-2xl p-4 mb-6 text-sm text-purple-300/90">
          To check in, type <code className="text-purple-100 bg-purple-900/40 rounded px-1.5 py-0.5">{event.joinPhrase}</code> in
          clan chat while the event is live.
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatTile
            label={roster ? `of ${roster.size} members` : "Attendees"}
            value={members.length.toLocaleString()}
            sub={guests.length ? `+${guests.length} guest${guests.length === 1 ? "" : "s"}` : undefined}
          />
          <StatTile label="Kills" value={totalKills.toLocaleString()} />
          <StatTile label="Loot value" value={formatGp(totalValue)} />
        </div>

        <section className="mb-8">
          <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-white heading-glow mb-3">Attendance</h2>
          {members.length === 0 ? (
            <p className="text-sm text-purple-600/70">
              {status === "upcoming" ? "The event hasn't started yet." : "No clan members have been recorded yet."}
            </p>
          ) : (
            <AttendanceTable
              players={members.map((p) => ({
                ...p,
                name: p.clan?.displayName ?? p.rsn,
                detail: [p.clan ? formatClanRole(p.clan.role) : null, VIA_LABELS[p.via] ?? p.via].filter(Boolean).join(" · "),
              }))}
              hasActivity={hasActivity}
            />
          )}
          {guests.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-purple-300 mb-1">Guests ({guests.length})</h3>
              <p className="text-xs text-purple-500/80 mb-2">Not in the clan&apos;s Wise Old Man group.</p>
              <AttendanceTable
                players={guests.map((p) => ({ ...p, name: p.rsn, detail: VIA_LABELS[p.via] ?? p.via }))}
                hasActivity={hasActivity}
              />
            </div>
          )}
        </section>

        {topDrops.length > 0 && (
          <section>
            <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-white heading-glow mb-3">Top drops</h2>
            <div className="bg-[#0e0820] border border-purple-900/40 rounded-2xl divide-y divide-purple-900/20">
              {topDrops.map((d) => (
                <div key={d.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-black/30 flex items-center justify-center">
                    {d.itemId != null && (
                      // Tiny (<1KB) sprites from RuneLite's item icon cache — served as-is.
                      <Image
                        src={`https://static.runelite.net/cache/item/icon/${d.itemId}.png`}
                        alt=""
                        width={36}
                        height={32}
                        unoptimized
                        style={{ objectFit: "contain" }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-purple-100 truncate">
                      {d.quantity && d.quantity > 1 ? `${d.quantity.toLocaleString()} × ` : ""}
                      {d.itemName}
                    </p>
                    <p className="text-[11px] text-purple-500/80 truncate">
                      {d.rsn}
                      {d.source ? ` · ${d.source}` : ""}
                    </p>
                  </div>
                  <p className="text-amber-300/90 tabular-nums shrink-0">{formatGp(d.value)}</p>
                  {d.imageUrl && <ZoomableThumbnail src={d.imageUrl} alt={`${d.rsn}'s ${d.itemName} drop`} />}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-3 sm:p-4 text-center">
      <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[11px] sm:text-xs text-purple-500/80 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-purple-400/70">{sub}</p>}
    </div>
  );
}

type AttendanceRow = {
  id: string;
  name: string;
  detail: string;
  firstSeenAt: Date;
  kills: number;
  value: number;
};

function AttendanceTable({ players, hasActivity }: { players: AttendanceRow[]; hasActivity: boolean }) {
  return (
    <div className="bg-[#0e0820] border border-purple-900/40 rounded-2xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-purple-500 uppercase tracking-wider border-b border-purple-900/40">
            <th className="px-4 py-2.5 font-medium">Player</th>
            <th className="px-4 py-2.5 font-medium">First seen</th>
            {hasActivity && <th className="px-4 py-2.5 font-medium text-right">Kills</th>}
            {hasActivity && <th className="px-4 py-2.5 font-medium text-right">Loot</th>}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-b border-purple-900/20 last:border-0">
              <td className="px-4 py-2.5">
                <p className="text-purple-100 font-medium">{p.name}</p>
                <p className="text-[11px] text-purple-500/80">{p.detail}</p>
              </td>
              <td className="px-4 py-2.5 text-purple-300/80 whitespace-nowrap">
                <LocalTime date={p.firstSeenAt} dateStyle="short" />
              </td>
              {hasActivity && <td className="px-4 py-2.5 text-right tabular-nums text-purple-100">{p.kills || "–"}</td>}
              {hasActivity && (
                <td className="px-4 py-2.5 text-right tabular-nums text-amber-300/90">{p.value ? formatGp(p.value) : "–"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
