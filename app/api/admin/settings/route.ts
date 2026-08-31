import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSettings, updateSettings } from "@/lib/settings";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const settings = await getSettings();
  return NextResponse.json({ discordWebhookUrl: settings?.discordWebhookUrl ?? null });
}

export async function PUT(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { discordWebhookUrl } = await req.json();
  const trimmed = typeof discordWebhookUrl === "string" ? discordWebhookUrl.trim() : "";

  if (trimmed && !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(trimmed)) {
    return NextResponse.json({ error: "That doesn't look like a Discord webhook URL" }, { status: 400 });
  }

  const settings = await updateSettings({ discordWebhookUrl: trimmed || null });
  return NextResponse.json({ discordWebhookUrl: settings.discordWebhookUrl });
}
