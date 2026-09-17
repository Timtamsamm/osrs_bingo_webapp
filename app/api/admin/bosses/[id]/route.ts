import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

interface ItemInput {
  itemId: number;
  name: string;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const items: ItemInput[] = Array.isArray(body.items)
    ? body.items
        .map((i: { itemId: unknown; name: unknown }) => ({ itemId: Number(i.itemId), name: typeof i.name === "string" ? i.name.trim() : "" }))
        .filter((i: ItemInput) => Number.isInteger(i.itemId) && i.itemId > 0 && i.name.length > 0)
    : [];

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // De-dupe by itemId (last one wins) — the unique constraint would otherwise reject it.
  const byItemId = new Map(items.map((i) => [i.itemId, i]));
  const dedupedItems = [...byItemId.values()];

  try {
    const boss = await prisma.$transaction(async (tx) => {
      await tx.boss.update({ where: { id }, data: { name } });
      await tx.bossItem.deleteMany({ where: { bossId: id } });
      if (dedupedItems.length > 0) {
        await tx.bossItem.createMany({
          data: dedupedItems.map((i, idx) => ({ bossId: id, itemId: i.itemId, name: i.name, sortOrder: idx })),
        });
      }
      return tx.boss.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    });
    return NextResponse.json({ boss });
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "A boss with that name already exists" }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  await prisma.boss.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
