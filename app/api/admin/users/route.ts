import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { username, password, role, teamMembers } = await req.json();

  if (!username?.trim() || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (exists) return NextResponse.json({ error: "Username already taken" }, { status: 409 });

  const members: string[] = Array.isArray(teamMembers)
    ? teamMembers.map((m: string) => m.trim()).filter(Boolean)
    : [];

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { username: username.trim(), passwordHash, role: role === "ADMIN" ? "ADMIN" : "PLAYER", teamMembers: members },
  });

  return NextResponse.json({ id: user.id, username: user.username });
}
