export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import PageHeaderNav from "@/app/components/PageHeaderNav";
import LocalTime from "@/app/components/LocalTime";
import { eventStatus, findClanMember, formatGp, formatClanRole, getClanRoster, splitByRoster, VIA_LABELS } from "@/lib/clanEvents";
import StatusBadge from "../StatusBadge";
import ZoomableThumbnail from "@/app/components/ZoomableThumbnail";
import { killTimesByBoss, formatDuration, type FastestKill } from "@/lib/killTimes";
import { eventGains, finalizeEventStats, type PlayerGains } from "@/lib/eventStats";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;

  const [event, roster, gains] = await Promise.all([
    prisma.clanEvent.findUnique({
      where: { id },
      include: {
        attendees: { orderBy: { firstSeenAt: "asc" } },
        activity: { orderBy: { createdAt: "desc" } },
      },
    }),
    getClanRoster(),
    eventGains(id),
  ]);
  if (!event) notFound();

  const status = eventStatus(event);

  // Drops below the event's minimum value are left out of every loot figure
  // (they're still stored, and already counted for attendance when they came in).
  const stackValue = (a: { priceEach: number | null; quantity: number | null }) => (a.priceEach ?? 0) * (a.quantity ?? 1);
  // "Clan members only" also drops guests' kills/drops (only possible when the
  // WOM roster loaded — otherwise everyone counts rather than no one).
  const hideGuests = event.clanOnly && roster != null;
  const isShown = (rsn: string) => !hideGuests || findClanMember(roster, rsn) != null;

  // Locks in final TempleOSRS stats once the event (+ logout grace) is over.
  finalizeEventStats(event);
  // TIME rows are kill-time lines, only used for Fastest kills below.
  const activity = event.activity.filter(
    (a) => (a.type === "KILL" || (a.type === "LOOT" && stackValue(a) >= event.minDropValue)) && isShown(a.rsn)
  );

  // Raid teammates share the team's time; with "Clan members only" on, guests
  // are left out of the names (and a time with no clan member on it is dropped).
  const fastest = killTimesByBoss(
    activity.filter((a) => a.type === "KILL"),
    event.activity.filter((a) => a.type === "TIME"),
    (rsn) => (isShown(rsn) ? (findClanMember(roster, rsn)?.displayName ?? rsn) : null),
    event.groupEvent
  );

  // Per-player totals, keyed by normalized RSN so they line up with attendees.
  const totals = new Map<string, { kills: number; drops: number; value: number }>();
  let totalValue = 0;
  for (const a of activity) {
    const t = totals.get(a.rsnKey) ?? { kills: 0, drops: 0, value: 0 };
    if (a.type === "KILL") {
      t.kills++;
    } else {
      const value = stackValue(a);
      t.drops++;
      t.value += value;
      totalValue += value;
    }
    totals.set(a.rsnKey, t);
  }

  // Group event: everyone is in every kill and each of them reports it, so the
  // event's kill count is the most kills any one player has. Otherwise each
  // reported kill is a separate kill.
  const killsPerPlayer = [...totals.values()].map((t) => t.kills);
  const totalKills = event.groupEvent
    ? Math.max(0, ...killsPerPlayer)
    : killsPerPlayer.reduce((sum, k) => sum + k, 0);

  const hasActivity = activity.length > 0;
  const drops = activity
    .filter((a) => a.type === "LOOT")
    .map((a) => ({ ...a, value: stackValue(a) }));
  const topDrops = [...drops].sort((a, b) => b.value - a.value).slice(0, 15);

  const rankedPlayers = event.attendees
    .map((p) => ({ ...p, ...(totals.get(p.rsnKey) ?? { kills: 0, drops: 0, value: 0 }) }))
    .sort((a, b) => b.kills - a.kills || b.value - a.value);
  // Events are for clan members — the main list is WOM group members who
  // checked in or sent data; anyone else is shown separately as a guest.
  const split = splitByRoster(rankedPlayers, roster);
  const members = split.members;
  const guests = hideGuests ? [] : split.guests;

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
          <Link href="/events" className="inline-flex items-center gap-1.5 rounded-full border border-purple-800/50 bg-surface/60 px-3.5 py-2 text-sm text-purple-300 hover:text-white hover:border-purple-600/60 hover:bg-raised/60 transition-colors font-medium">
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
          Attendance, kills and drops are recorded automatically by Dink — your first kill or drop checks you in. New here? Type{" "}
          <code className="text-purple-100 bg-purple-900/40 rounded px-1.5 py-0.5">/events</code> in the clan Discord for the one-time setup.
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatTile
            label="Participants"
            value={members.length.toLocaleString()}
            sub={guests.length ? `+${guests.length} guest${guests.length === 1 ? "" : "s"}` : undefined}
          />
          <StatTile label="Total kills" sub="whole event" value={totalKills.toLocaleString()} />
          <StatTile label="Total loot value" sub="whole event" value={formatGp(totalValue)} />
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

        <StatsGained
          players={gains.players
            .map((g) => {
              const attendee = event.attendees.find((a) => a.rsnKey === g.rsnKey);
              return attendee && isShown(attendee.rsn)
                ? { ...g, name: findClanMember(roster, attendee.rsn)?.displayName ?? attendee.rsn }
                : null;
            })
            .filter((g): g is PlayerGains & { name: string } => g != null)
            .sort((a, b) => b.xp - a.xp)}
          final={gains.final}
        />

        {fastest.length > 0 && (
          <section className="mb-8">
            <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-white heading-glow mb-1">Fastest kills</h2>
            <p className="text-xs text-purple-500/80 mb-3">Click a boss to see everyone&apos;s best time.</p>
            <div className="bg-[#0e0820] border border-purple-900/40 rounded-2xl divide-y divide-purple-900/20 overflow-hidden">
              {fastest.map(({ boss, times }) => (
                <details key={boss} className="group">
                  <summary className="px-4 py-2.5 flex items-center gap-3 text-sm cursor-pointer list-none hover:bg-purple-900/10 [&::-webkit-details-marker]:hidden">
                    <span className="w-3 shrink-0 text-purple-500 group-open:rotate-90 transition-transform">›</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-purple-100 truncate">{boss}</p>
                      <p className="text-[11px] text-purple-500/80 truncate">
                        {times[0].players.join(", ")}
                        {times[0].killCount != null ? ` · KC ${times[0].killCount.toLocaleString()}` : ""}
                        {times.length > 1 ? ` · ${times.length} times` : ""}
                      </p>
                    </div>
                    {times[0].isPb && <PbBadge />}
                    <p className="text-purple-100 font-semibold tabular-nums shrink-0">{formatDuration(times[0].ms)}</p>
                  </summary>
                  <ol className="bg-black/20 border-t border-purple-900/30 px-4 py-2">
                    {times.map((t: FastestKill, i: number) => (
                      <li key={`${t.ms}-${t.players.join(",")}`} className="py-1.5 flex items-center gap-3 text-sm">
                        <span className={`w-6 text-right tabular-nums text-xs ${i === 0 ? "text-amber-300 font-semibold" : "text-purple-500"}`}>#{i + 1}</span>
                        <p className="flex-1 min-w-0 truncate text-purple-200">
                          {t.players.join(", ")}
                          {t.killCount != null && <span className="text-purple-500/80 text-[11px]"> · KC {t.killCount.toLocaleString()}</span>}
                        </p>
                        {t.isPb && <PbBadge />}
                        <span className="tabular-nums text-purple-100 shrink-0">{formatDuration(t.ms)}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </section>
        )}

        {topDrops.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-white heading-glow">Top drops</h2>
              {event.minDropValue > 0 && (
                <p className="text-xs text-purple-500/80">Drops worth {formatGp(event.minDropValue)}+</p>
              )}
            </div>
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
                      {findClanMember(roster, d.rsn)?.displayName ?? d.rsn}
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

const fmtXp = (xp: number) => (xp >= 1_000_000 ? `${(xp / 1_000_000).toFixed(2)}M` : xp.toLocaleString());
const fmtHours = (h: number) => h.toFixed(2);

function StatsGained({ players, final }: { players: Array<PlayerGains & { name: string }>; final: boolean }) {
  if (!players.length) return null;
  const total = players.reduce((t, p) => ({ xp: t.xp + p.xp, ehp: t.ehp + p.ehp, ehb: t.ehb + p.ehb }), { xp: 0, ehp: 0, ehb: 0 });
  return (
    <section className="mb-8">
      <h2 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-white heading-glow mb-1">Stats gained</h2>
      <p className="text-xs text-purple-500/80 mb-3">
        From TempleOSRS, since each player&apos;s first kill or drop. The hiscores update when a player logs out or hops worlds.{" "}
        {final ? "Final." : "Locks in 30 minutes after the event ends."}
      </p>
      <div className="bg-[#0e0820] border border-purple-900/40 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-2.5 text-xs text-purple-500 uppercase tracking-wider border-b border-purple-900/40">
          <span>Player</span>
          <span className="text-right w-20">XP</span>
          <span className="text-right w-12">EHP</span>
          <span className="text-right w-12">EHB</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-2.5 text-sm bg-purple-900/15 border-b border-purple-900/40 font-semibold">
          <span className="text-purple-200 pl-4">Event total</span>
          <span className="text-right w-20 tabular-nums text-green-300">{fmtXp(total.xp)}</span>
          <span className="text-right w-12 tabular-nums text-purple-200">{fmtHours(total.ehp)}</span>
          <span className="text-right w-12 tabular-nums text-amber-300/90">{fmtHours(total.ehb)}</span>
        </div>
        {players.map((p) => (
          <details key={p.rsnKey} className="group border-b border-purple-900/20 last:border-0">
            <summary className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-2.5 text-sm cursor-pointer list-none hover:bg-purple-900/10">
              <span className="text-purple-100 font-medium truncate">
                <span className="inline-block w-3 text-purple-500 group-open:rotate-90 transition-transform">›</span> {p.name}
              </span>
              <span className="text-right w-20 tabular-nums text-green-300">{fmtXp(p.xp)}</span>
              <span className="text-right w-12 tabular-nums text-purple-200">{fmtHours(p.ehp)}</span>
              <span className="text-right w-12 tabular-nums text-amber-300/90">{fmtHours(p.ehb)}</span>
            </summary>
            <div className="px-4 pb-3 pl-8 grid gap-3 sm:grid-cols-2 text-xs">
              <div>
                <p className="text-purple-400 font-semibold mb-1">Skills</p>
                {p.skills.length ? (
                  p.skills.map((s) => (
                    <p key={s.name} className="flex justify-between gap-2 text-purple-200">
                      <span>{s.name}</span>
                      <span className="tabular-nums">+{s.xp.toLocaleString()} xp</span>
                    </p>
                  ))
                ) : (
                  <p className="text-purple-600">No XP gained yet</p>
                )}
              </div>
              <div>
                <p className="text-purple-400 font-semibold mb-1">Boss KC</p>
                {p.bosses.length ? (
                  p.bosses.map((b) => (
                    <p key={b.name} className="flex justify-between gap-2 text-purple-200">
                      <span>{b.name}</span>
                      <span className="tabular-nums">+{b.kc.toLocaleString()}</span>
                    </p>
                  ))
                ) : (
                  <p className="text-purple-600">No boss kills yet</p>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function PbBadge() {
  return (
    <span className="text-[10px] uppercase tracking-wider font-semibold border rounded-full px-2 py-0.5 shrink-0 bg-amber-500/10 text-amber-300 border-amber-500/40">
      PB
    </span>
  );
}
