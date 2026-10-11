/**
 * Item name → ID/price lookup via the OSRS Wiki prices API, for drops that
 * only arrive as text (clan drop broadcasts carry no item ID). Only tradeable
 * items are in the mapping — untradeables (pets etc.) resolve to nulls.
 */

import { unstable_cache } from "next/cache";

// The wiki API 403s requests without a descriptive User-Agent.
const USER_AGENT = "bingo-beasts-events/1.0 (clan event drop tracking)";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

// Both fetchers throw on failure rather than returning {} so a bad response
// isn't cached for the whole revalidate window. Only slimmed-down maps are
// cached — the raw responses are close to the data cache's size limit.

const getItemIdsByName = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const mapping = (await fetchJson("https://prices.runescape.wiki/api/v1/osrs/mapping")) as Array<{ id: number; name: string }>;
    const byName: Record<string, number> = {};
    for (const item of mapping) byName[item.name.toLowerCase()] = item.id;
    return byName;
  },
  ["osrs-item-ids-by-name"],
  { revalidate: 86400 }
);

const getItemPrices = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const latest = (await fetchJson("https://prices.runescape.wiki/api/v1/osrs/latest")) as {
      data: Record<string, { high: number | null; low: number | null }>;
    };
    const prices: Record<string, number> = {};
    for (const [id, p] of Object.entries(latest.data)) {
      const price = p.high ?? p.low;
      if (price != null) prices[id] = price;
    }
    return prices;
  },
  ["osrs-item-prices"],
  { revalidate: 3600 }
);

export async function lookupItem(name: string): Promise<{ id: number | null; price: number | null }> {
  try {
    const id = (await getItemIdsByName())[name.trim().toLowerCase()] ?? null;
    if (id == null) return { id: null, price: null };
    const price = (await getItemPrices())[String(id)] ?? null;
    return { id, price };
  } catch (e) {
    console.error("osrsItems: lookup failed", e);
    return { id: null, price: null };
  }
}
