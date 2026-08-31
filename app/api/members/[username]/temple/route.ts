import { NextRequest, NextResponse } from "next/server";
import { fetchTempleStats } from "@/lib/templeosrs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const stats = await fetchTempleStats(username);
  return NextResponse.json({ stats });
}
