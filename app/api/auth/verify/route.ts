import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { passcode } = await req.json();

  const board = await prisma.bingoBoard.findFirst({
    where: { active: true },
    select: { passcode: true },
  });

  if (!board?.passcode) {
    return NextResponse.json({ error: "No passcode configured for this event" }, { status: 400 });
  }

  if (!passcode || passcode !== board.passcode) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("event_verified", board.passcode, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });
  return res;
}
