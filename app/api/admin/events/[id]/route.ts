import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateEventsWebhookCache } from "@/lib/webhookCache";
import { parseEventInput } from "../eventInput";
import { requireAdmin } from "@/lib/adminAuth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const input = parseEventInput(await req.json());
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });

  try {
    const event = await prisma.clanEvent.update({ where: { id }, data: input });
    invalidateEventsWebhookCache();
    return NextResponse.json(event);
  } catch {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.clanEvent.delete({ where: { id } }).catch(() => null);
  invalidateEventsWebhookCache();
  return NextResponse.json({ ok: true });
}
