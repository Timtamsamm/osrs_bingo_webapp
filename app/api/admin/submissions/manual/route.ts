import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { diminishingPoints } from "@/lib/scoring";

type TierDef = { tier: number; points: number; requiredCount: number; dinkItems: Array<{ id: number; name: string }> };
type PointsConfig = { target: number; items: Array<{ id: number; name: string; basePoints: number }> };

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { teamId, tileId, tier, itemId, note } = await req.json();
  if (!teamId || !tileId || (!tier && itemId == null)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const [team, tile] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { id: true } }),
    prisma.bingoTile.findUnique({ where: { id: tileId }, select: { id: true, scoringMode: true, tiers: true, pointsConfig: true } }),
  ]);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (!tile) return NextResponse.json({ error: "Tile not found" }, { status: 404 });

  let submission;

  if (tile.scoringMode === "POINTS") {
    const cfg = tile.pointsConfig as PointsConfig | null;
    const item = cfg?.items.find((i) => i.id === Number(itemId));
    if (!item) return NextResponse.json({ error: "Tile has no such item" }, { status: 400 });

    const priorCount = await prisma.submission.count({
      where: { teamId, tileId, dinkItemId: item.id, status: { not: "REJECTED" } },
    });
    const pointsAwarded = diminishingPoints(item.basePoints, priorCount + 1);

    submission = await prisma.submission.create({
      data: {
        teamId,
        tileId,
        dinkItemId: item.id,
        dinkItemName: item.name,
        pointsAwarded,
        status: "APPROVED",
        source: "manual",
        note: note?.trim() || null,
        reviewedAt: new Date(),
      },
    });
  } else {
    const tiers = (tile.tiers as TierDef[]) ?? [];
    const tierDef = tiers.find((t) => t.tier === Number(tier));
    if (!tierDef) return NextResponse.json({ error: "Tile has no such tier" }, { status: 400 });

    const activeCount = await prisma.submission.count({
      where: { teamId, tileId, tier: tierDef.tier, status: { not: "REJECTED" } },
    });
    if (activeCount >= tierDef.requiredCount) {
      return NextResponse.json({ error: "Tier already full for this team" }, { status: 409 });
    }

    submission = await prisma.submission.create({
      data: {
        teamId,
        tileId,
        tier: tierDef.tier,
        status: "APPROVED",
        source: "manual",
        note: note?.trim() || null,
        reviewedAt: new Date(),
      },
    });
  }

  revalidatePath("/bingo/admin/submissions");
  revalidatePath("/bingo/board");
  revalidatePath("/bingo/leaderboard");
  revalidatePath("/bingo/recent-drops");
  return NextResponse.json(submission);
}
