import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: { participants: { orderBy: { rsn: "asc" } } },
  });

  return NextResponse.json(teams);
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  try {
    const team = await prisma.team.create({
      data: { name: name.trim(), ...(color ? { color } : {}) },
    });
    return NextResponse.json(team);
  } catch {
    return NextResponse.json({ error: "Team name already exists" }, { status: 409 });
  }
}
