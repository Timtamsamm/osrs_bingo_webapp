import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fetchGroupMembers } from "@/lib/wiseoldman";
import EventsEditor from "./EventsEditor";

export default async function EventsAdminPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const [events, members] = await Promise.all([
    prisma.event.findMany({ orderBy: { startsAt: "desc" } }),
    fetchGroupMembers(),
  ]);
  const serialized = events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    imageUrl: e.imageUrl,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    participantNames: e.participantNames,
  }));

  return (
    <div className="min-h-screen bg-[#080510] text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] text-purple-600 uppercase tracking-widest mb-1">Admin</p>
            <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold text-purple-100 heading-glow">
              Events
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/events" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              ← Back to events
            </Link>
            <Link href="/" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              ← Home
            </Link>
          </div>
        </div>
        <EventsEditor events={serialized} members={members} />
      </div>
    </div>
  );
}
