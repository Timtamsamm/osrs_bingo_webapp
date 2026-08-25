import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type DinkItem = { id: number; name: string };
type TierDef = { tier: 1 | 2 | 3; points: number; requiredCount: number; dinkItems: DinkItem[] };
type TileInput = { title: string; description: string; imageUrl?: string; tiers: TierDef[] };

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description, startsAt, endsAt, size, dinkToken, rowColBonuses, tiles } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  await prisma.bingoBoard.updateMany({ where: { active: true }, data: { active: false } });

  const board = await prisma.bingoBoard.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      size: size ? Number(size) : 5,
      dinkToken: dinkToken?.trim() || null,
      rowColBonuses: rowColBonuses ?? { t1: 0, t2: 0, t3: 0 },
      active: true,
      tiles: {
        create: Object.entries(tiles as Record<string, TileInput>)
          .filter(([, t]) => t.title.trim())
          .map(([pos, t]) => ({
            position: Number(pos),
            title: t.title.trim(),
            description: t.description?.trim() || null,
            imageUrl: t.imageUrl || null,
            tiers: t.tiers ?? [],
          })),
      },
    },
  });

  return NextResponse.json(board);
}

export async function PUT(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, name, description, startsAt, endsAt, size, dinkToken, rowColBonuses, tiles } = await req.json();
  if (!id || !name?.trim()) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  await prisma.bingoBoard.update({
    where: { id },
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      size: size ? Number(size) : 5,
      dinkToken: dinkToken?.trim() || null,
      rowColBonuses: rowColBonuses ?? { t1: 0, t2: 0, t3: 0 },
    },
  });

  for (const [pos, t] of Object.entries(tiles as Record<string, TileInput>)) {
    const existing = await prisma.bingoTile.findUnique({ where: { boardId_position: { boardId: id, position: Number(pos) } } });
    if (!t.title.trim()) {
      if (existing) await prisma.bingoTile.delete({ where: { id: existing.id } });
      continue;
    }
    const data = {
      title: t.title.trim(),
      description: t.description?.trim() || null,
      imageUrl: t.imageUrl || null,
      tiers: t.tiers ?? [],
    };
    if (existing) {
      await prisma.bingoTile.update({ where: { id: existing.id }, data });
    } else {
      await prisma.bingoTile.create({ data: { boardId: id, position: Number(pos), ...data } });
    }
  }

  return NextResponse.json({ ok: true });
}
