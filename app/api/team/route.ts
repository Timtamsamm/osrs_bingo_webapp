import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamMembers } = await req.json();
  if (!Array.isArray(teamMembers)) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  const members: string[] = teamMembers.map((m: string) => m.trim()).filter(Boolean);

  const board = await prisma.bingoBoard.findFirst({
    where: { active: true },
    select: { maxTeamSize: true },
  });

  const maxTeamSize = board?.maxTeamSize ?? 10;
  if (members.length > maxTeamSize) {
    return NextResponse.json({ error: `Maximum ${maxTeamSize} team members allowed` }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { teamMembers: members },
  });

  return NextResponse.json({ ok: true });
}
