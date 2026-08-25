import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type TierDef = { tier: number; points: number; requiredCount: number; dinkItems: Array<{ id: number; name: string }> };

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { teamId, tileId, tier, note } = await req.json();
  if (!teamId || !tileId || !tier) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const [team, tile] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { id: true } }),
    prisma.bingoTile.findUnique({ where: { id: tileId }, select: { id: true, tiers: true } }),
  ]);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  if (!tile) return NextResponse.json({ error: "Tile not found" }, { status: 404 });

  const tiers = (tile.tiers as TierDef[]) ?? [];
  const tierDef = tiers.find((t) => t.tier === Number(tier));
  if (!tierDef) return NextResponse.json({ error: "Tile has no such tier" }, { status: 400 });

  const activeCount = await prisma.submission.count({
    where: { teamId, tileId, tier: tierDef.tier, status: { not: "REJECTED" } },
  });
  if (activeCount >= tierDef.requiredCount) {
    return NextResponse.json({ error: "Tier already full for this team" }, { status: 409 });
  }

  const submission = await prisma.submission.create({
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

  revalidatePath("/admin/submissions");
  revalidatePath("/board");
  revalidatePath("/leaderboard");
  return NextResponse.json(submission);
}
