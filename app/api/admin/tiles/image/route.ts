import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const tileId = form.get("tileId") as string | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  // If updating an existing tile, delete the old image from Blob first
  if (tileId) {
    const tile = await prisma.bingoTile.findUnique({ where: { id: tileId }, select: { imageUrl: true } });
    if (tile?.imageUrl) await del(tile.imageUrl);
  }

  const { url } = await put(`tiles/${Date.now()}-${file.name}`, file, { access: "public" });

  if (tileId) {
    await prisma.bingoTile.update({ where: { id: tileId }, data: { imageUrl: url } });
  }

  return NextResponse.json({ url });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { tileId } = await req.json();
  if (!tileId) return NextResponse.json({ error: "Missing tileId" }, { status: 400 });

  const tile = await prisma.bingoTile.findUnique({ where: { id: tileId }, select: { imageUrl: true } });
  if (tile?.imageUrl) await del(tile.imageUrl);

  await prisma.bingoTile.update({ where: { id: tileId }, data: { imageUrl: null } });

  return NextResponse.json({ ok: true });
}
