import { NextResponse } from "next/server";
import { updateSettings } from "@/lib/settings";
import { invalidateEventsWebhookCache } from "@/lib/webhookCache";
import { generateEventsToken } from "@/lib/clanEvents";
import { requireAdmin } from "@/lib/adminAuth";

// Regenerates the events webhook token — invalidates every copy of the old
// link, so anyone using it has to paste the new one into Dink.
export async function POST() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const token = generateEventsToken();
  await updateSettings({ eventsWebhookToken: token });
  invalidateEventsWebhookCache();
  return NextResponse.json({ token });
}
