import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const tileId = form.get("tileId") as string | null;
  const note = (form.get("note") as string) ?? "";

  if (!file || !tileId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const existing = await prisma.submission.findFirst({
    where: { userId: session.user.id, tileId, status: { not: "REJECTED" } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already submitted" }, { status: 409 });
  }

  const { url } = await put(
    `submissions/${session.user.id}/${tileId}-${Date.now()}.jpg`,
    file,
    { access: "public" }
  );

  await prisma.submission.create({
    data: {
      userId: session.user.id,
      tileId,
      imageUrl: url,
      note: note || null,
    },
  });

  return NextResponse.json({ ok: true });
}
