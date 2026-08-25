/**
 * TempleOSRS integration — fetches Efficient Hours Bossed/Played per player.
 *
 * Uses the public per-player endpoint (no group/API key needed), since this
 * app doesn't have a TempleOSRS group set up. TempleOSRS returns HTTP 200
 * with an `error` field for untracked names, so that's treated the same as
 * a network failure — callers just don't get a number for that player.
 */
export interface TempleStats {
  ehb: number;
  ehp: number;
}

export async function fetchTempleStats(rsn: string): Promise<TempleStats | null> {
  const url = `https://templeosrs.com/api/player_stats.php?player=${encodeURIComponent(rsn)}&bosses=1`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "OSRS-Bingo-App/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = await res.json();
    if (json.error || !json.data) return null;

    return {
      ehb: Number(json.data.Ehb) || 0,
      ehp: Number(json.data.Ehp) || 0,
    };
  } catch {
    return null;
  }
}
