import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username?.trim() || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  if (username.trim().length < 2 || username.trim().length > 32) {
    return NextResponse.json({ error: "Username must be between 2 and 32 characters" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (exists) return NextResponse.json({ error: "Username already taken" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { username: username.trim(), passwordHash, role: "PLAYER" },
  });

  return NextResponse.json({ ok: true });
}
