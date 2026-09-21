import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import GeneralRulesForm from "./GeneralRulesForm";
import TileRulesForm from "./TileRulesForm";

export default async function AdminRulesPage() {
  const [settings, board] = await Promise.all([
    getSettings(),
    prisma.bingoBoard.findFirst({
      where: { active: true },
      select: {
        size: true,
        tiles: {
          orderBy: { position: "asc" },
          select: { id: true, position: true, title: true, rules: true },
        },
      },
    }),
  ]);

  const size = board?.size ?? 5;
  const tiles = (board?.tiles ?? [])
    .filter((t) => t.position < size * size && t.title.trim())
    .map((t) => ({ id: t.id, title: t.title, rules: t.rules ?? "" }));

  return (
    <div>
      <h1 className="font-[family-name:var(--font-cinzel)] text-2xl font-bold mb-2 text-purple-100 heading-glow">
        Rules
      </h1>
      <p className="text-sm text-purple-500/70 mb-8 max-w-2xl">
        Edit the general event rules and each tile&apos;s specific rules — both are shown on the public Rules page.
      </p>
      <div className="flex flex-col gap-5">
        <GeneralRulesForm initialRules={settings?.generalRules ?? ""} />
        <TileRulesForm initialTiles={tiles} />
      </div>
    </div>
  );
}
