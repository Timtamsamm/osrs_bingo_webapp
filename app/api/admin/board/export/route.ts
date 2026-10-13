import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PRESET_FORMAT, PRESET_VERSION, type BoardPreset } from "@/lib/boardPreset";
import { requireAdmin } from "@/lib/adminAuth";

// Downloads the saved active board as a preset file (see lib/boardPreset.ts).
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const board = await prisma.bingoBoard.findFirst({
    where: { active: true },
    include: { tiles: { orderBy: { position: "asc" } } },
  });
  if (!board) return NextResponse.json({ error: "No active board" }, { status: 404 });

  const tiles = await Promise.all(
    board.tiles.map(async (t) => ({
      position: t.position,
      title: t.title,
      description: t.description,
      rules: t.rules,
      image: t.imageUrl ? await toDataUrl(t.imageUrl) : null,
      scoringMode: t.scoringMode,
      tiers: t.tiers,
      pointsConfig: t.pointsConfig,
    }))
  );

  const bonuses = (board.rowColBonuses ?? {}) as Partial<BoardPreset["rowColBonuses"]>;
  const preset: BoardPreset = {
    format: PRESET_FORMAT,
    version: PRESET_VERSION,
    exportedAt: new Date().toISOString(),
    name: board.name,
    description: board.description,
    size: board.size,
    rowColBonuses: { t1: bonuses.t1 ?? 0, t2: bonuses.t2 ?? 0, t3: bonuses.t3 ?? 0 },
    scaleByTeamSize: board.scaleByTeamSize,
    tiles,
  };

  const filename = `${board.name.replace(/[^\w-]+/g, "_") || "board"}-preset.json`;
  return new NextResponse(JSON.stringify(preset, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// Falls back to the plain URL if the image can't be fetched, so one broken
// image doesn't block the whole export.
async function toDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${type};base64,${base64}`;
  } catch {
    return url;
  }
}
