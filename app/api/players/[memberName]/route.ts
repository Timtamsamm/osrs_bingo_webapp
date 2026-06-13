import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchBossKCs } from "@/lib/temple";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ memberName: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberName } = await params;

  try {
    const bosses = await fetchBossKCs(memberName);
    return NextResponse.json({ bosses });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
