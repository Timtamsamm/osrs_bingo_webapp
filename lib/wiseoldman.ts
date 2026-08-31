/**
 * Wise Old Man integration — pulls the clan's member roster (and WOM's own
 * EHP/EHB/exp numbers) from a single group endpoint call. Deeper per-player
 * detail (boss KCs, clues, collection log) still comes from TempleOSRS,
 * fetched on demand per member rather than eagerly for the whole roster —
 * see lib/templeosrs.ts.
 */

import { unstable_cache } from "next/cache";

const USER_AGENT = "OSRS-Bingo-App/1.0";
// The clan's group is large (300+ members); a shared cache means visitors
// browsing /members around the same time don't each trigger their own
// fetch against WOM's API.
const CACHE_SECONDS = 600;
const GROUP_ID = 14334;

export interface WomMember {
  username: string;
  displayName: string;
  role: string;
  ehp: number;
  ehb: number;
  exp: number;
  ttm: number;
}

interface WomGroupResponse {
  memberships?: {
    role: string;
    player: {
      username: string;
      displayName: string;
      ehp: number | null;
      ehb: number | null;
      exp: number | null;
      ttm: number | null;
    };
  }[];
}

async function fetchGroupMembersUncached(): Promise<WomMember[]> {
  try {
    const res = await fetch(`https://api.wiseoldman.net/v2/groups/${GROUP_ID}`, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    if (!res.ok) return [];

    const json: WomGroupResponse = await res.json();
    return (json.memberships ?? []).map((m) => ({
      username: m.player.username,
      displayName: m.player.displayName,
      role: m.role,
      ehp: m.player.ehp ?? 0,
      ehb: m.player.ehb ?? 0,
      exp: m.player.exp ?? 0,
      ttm: m.player.ttm ?? 0,
    }));
  } catch {
    return [];
  }
}

export const fetchGroupMembers = unstable_cache(fetchGroupMembersUncached, ["wom-group-members"], { revalidate: CACHE_SECONDS });
