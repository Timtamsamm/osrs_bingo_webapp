import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const SKILL_KEYS = new Set([
  "Date","Player","Primary_ehp","Primary_ehb","Overall","Attack","Defence","Strength",
  "Hitpoints","Ranged","Prayer","Magic","Cooking","Woodcutting","Fletching","Fishing",
  "Firemaking","Crafting","Smithing","Mining","Herblore","Agility","Thieving","Slayer",
  "Farming","Runecraft","Hunter","Construction","Sailing",
  "Ehp","im_ehp","uim_ehp","lvl3_ehp","f2p_ehp","1def_ehp",
  "Ehb","im_ehb","uim_ehb","1def_ehb",
]);

function bestPeriod(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end   = endIso ? new Date(endIso).getTime() : Date.now();
  const days  = (end - start) / 86_400_000;
  if (days <= 1.5) return "day";
  if (days <= 8)   return "week";
  if (days <= 35)  return "month";
  return "year";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username } = await params;
  const start = req.nextUrl.searchParams.get("start");
  const end   = req.nextUrl.searchParams.get("end");

  if (!start) return NextResponse.json({ error: "Missing start" }, { status: 400 });

  const period = bestPeriod(start, end);

  const url = new URL("https://templeosrs.com/api/player_gains.php");
  url.searchParams.set("player", username);
  url.searchParams.set("time", period);
  url.searchParams.set("bosses", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "OSRS-Bingo-App/1.0" },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Temple OSRS returned ${res.status}` }, { status: res.status });
  }

  const json = await res.json();

  if (json.error) {
    return NextResponse.json({ error: json.error.Message ?? "Temple OSRS error" }, { status: 400 });
  }

  const raw = json.data as Record<string, unknown> | undefined;
  if (!raw) return NextResponse.json({ error: "No data returned — player may not be tracked on Temple OSRS" }, { status: 404 });

  const kills = Object.entries(raw)
    .filter(([key, val]) => !SKILL_KEYS.has(key) && typeof val === "number" && (val as number) > 0)
    .map(([boss, val]) => ({ boss, gained: val as number }))
    .sort((a, b) => b.gained - a.gained);

  return NextResponse.json({ kills, period });
}
