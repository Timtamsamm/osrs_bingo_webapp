import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const eventId = form.get("eventId") as string | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  // If replacing an existing event's image, delete the old one from Blob first
  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { imageUrl: true } });
    if (event?.imageUrl) await del(event.imageUrl);
  }

  const { url } = await put(`events/${Date.now()}-${file.name}`, file, { access: "public" });

  if (eventId) {
    await prisma.event.update({ where: { id: eventId }, data: { imageUrl: url } });
  }

  return NextResponse.json({ url });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { eventId, url } = await req.json();

  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { imageUrl: true } });
    if (event?.imageUrl) await del(event.imageUrl);
    await prisma.event.update({ where: { id: eventId }, data: { imageUrl: null } });
    return NextResponse.json({ ok: true });
  }

  if (url) {
    await del(url);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Missing eventId or url" }, { status: 400 });
}
