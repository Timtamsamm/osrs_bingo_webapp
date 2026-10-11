import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateSettings } from "@/lib/settings";
import { generateEventsToken } from "@/lib/clanEvents";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

// Regenerates the events webhook token — invalidates every copy of the old
// link, so anyone using it has to paste the new one into Dink.
export async function POST() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const token = generateEventsToken();
  await updateSettings({ eventsWebhookToken: token });
  return NextResponse.json({ token });
}
