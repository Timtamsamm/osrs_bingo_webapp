import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings, updateSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const settings = await getSettings();
  return NextResponse.json({ generalRules: settings?.generalRules ?? null });
}

// Handles both the General Rules form (generalRules) and the per-tile Board
// Rules form (tileRules) — kept on one route since both live on the same
// admin Rules page and either can be sent without the other.
export async function PUT(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { generalRules, tileRules } = await req.json();

  if (typeof generalRules === "string") {
    await updateSettings({ generalRules: generalRules.trim() || null });
  }

  if (Array.isArray(tileRules)) {
    await prisma.$transaction(
      (tileRules as Array<{ id: string; rules: string }>).map((t) =>
        prisma.bingoTile.update({ where: { id: t.id }, data: { rules: t.rules?.trim() || null } })
      )
    );
  }

  const settings = await getSettings();
  return NextResponse.json({ generalRules: settings?.generalRules ?? null });
}
