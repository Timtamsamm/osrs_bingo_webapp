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
  return NextResponse.json({ generalRules: settings?.generalRules ?? null });
}

export async function PUT(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { generalRules } = await req.json();
  const trimmed = typeof generalRules === "string" ? generalRules.trim() : "";

  const settings = await updateSettings({ generalRules: trimmed || null });
  return NextResponse.json({ generalRules: settings.generalRules });
}
