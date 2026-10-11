import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseEventInput } from "./eventInput";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const input = parseEventInput(await req.json());
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const event = await prisma.clanEvent.create({ data: input });
  return NextResponse.json(event);
}
