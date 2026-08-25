import { NextRequest, NextResponse } from "next/server";
import { fetchCollectionLogStats } from "@/lib/templeosrs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ memberName: string }> }) {
  const { memberName } = await params;
  const stats = await fetchCollectionLogStats(memberName);
  return NextResponse.json({ stats });
}
