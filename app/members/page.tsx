import Link from "next/link";
import { fetchGroupMembers } from "@/lib/wiseoldman";
import MembersTable from "./MembersTable";

export default async function MembersPage() {
  const members = await fetchGroupMembers();

  return (
    <div className="min-h-screen bg-base text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8 relative">
          <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mb-2">Wong Tongs</p>
          <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow">
            Members
          </h1>
          <p className="text-xs text-purple-600/70 mt-2">
            Roster and EHP/EHB from Wise Old Man. Click a member for detailed TempleOSRS stats.
          </p>
          <div className="absolute left-0 top-0">
            <Link href="/" className="text-xs text-purple-500 hover:text-purple-300 transition-colors font-medium">
              ← Home
            </Link>
          </div>
        </div>

        {members.length === 0 ? (
          <p className="text-purple-500/60 text-center py-12">Couldn&apos;t load the member list right now — try again shortly.</p>
        ) : (
          <MembersTable members={members} />
        )}
      </div>
    </div>
  );
}
