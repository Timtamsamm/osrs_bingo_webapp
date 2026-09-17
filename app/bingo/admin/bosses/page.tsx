import { prisma } from "@/lib/prisma";
import BossDatabaseEditor from "./BossDatabaseEditor";

export default async function AdminBossesPage() {
  const bosses = await prisma.boss.findMany({
    orderBy: { name: "asc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold mb-2 text-purple-100 heading-glow">
        Boss Item Database
      </h1>
      <p className="text-sm text-purple-500/70 mb-8 max-w-2xl">
        Reference data used by the &quot;Add from boss&quot; picker when building bingo tiles. Fix a wrong item ID or
        name here directly — changes only affect the picker, not any tile that already used it.
      </p>
      <BossDatabaseEditor
        initialBosses={bosses.map((b) => ({
          id: b.id,
          name: b.name,
          items: b.items.map((i) => ({ id: i.id, itemId: i.itemId, name: i.name })),
        }))}
      />
    </div>
  );
}
