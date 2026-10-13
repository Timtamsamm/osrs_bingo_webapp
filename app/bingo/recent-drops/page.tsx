import { getPreStartGate } from "@/app/components/PreStartGate";
import BoardTabNav from "@/app/components/BoardTabNav";
import PageHeaderNav from "@/app/components/PageHeaderNav";
import RecentDropsFilter from "./RecentDropsFilter";
import { getActiveBoard, getRecentDrops } from "@/lib/bingoData";

const DROPS_LIMIT = 100;

export default async function RecentDropsPage() {
  const gate = await getPreStartGate();
  if (gate) return gate;

  // Cached for a few seconds and shared across views — see lib/bingoData.
  const board = await getActiveBoard();
  const drops = board ? await getRecentDrops(board.id, DROPS_LIMIT) : [];

  const bosses = [...new Set(drops.map((d) => d.dinkSource).filter((s): s is string => !!s))].sort();

  return (
    <div className="min-h-screen bg-base text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <PageHeaderNav>
            <h1 className="font-[family-name:var(--font-cinzel)] text-4xl font-black text-white heading-glow pt-1">
              Recent Drops
            </h1>
            <p className="text-xs tracking-[0.3em] text-purple-500 uppercase mt-3">{board?.name ?? "Bingo Event"}</p>
          </PageHeaderNav>
        </div>

        <BoardTabNav />

        <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-5">
          {drops.length === 0 ? (
            <p className="text-sm text-purple-600/70 text-center py-8">No approved drops yet.</p>
          ) : (
            <RecentDropsFilter drops={drops} bosses={bosses} />
          )}
        </div>
      </div>
    </div>
  );
}
