import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateEventsWebhookCache } from "@/lib/webhookCache";
import { parseEventInput } from "./eventInput";
import { requireAdmin } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const input = parseEventInput(await req.json());
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });

  const event = await prisma.clanEvent.create({ data: input });
  invalidateEventsWebhookCache();
  return NextResponse.json(event);
}
