// Board preset file format — a saved board's layout/config as a standalone JSON
// file, so a board can be wiped and rebuilt (or reused for a later event).
// Tile images are embedded as data URLs because resetting the board deletes
// the originals from Blob storage, which would leave plain URLs dead.
// Event-specific fields (start/end time, Dink token) are deliberately left out.

export const PRESET_FORMAT = "bingo-beasts-board";
export const PRESET_VERSION = 1;

export interface PresetTile {
  position: number;
  title: string;
  description: string | null;
  rules: string | null;
  image: string | null; // data: URL (exports) or a plain URL (older backups)
  scoringMode: string;
  tiers: unknown;
  pointsConfig: unknown;
}

export interface BoardPreset {
  format: typeof PRESET_FORMAT;
  version: number;
  exportedAt: string;
  name: string;
  description: string | null;
  size: number;
  rowColBonuses: { t1: number; t2: number; t3: number };
  scaleByTeamSize: boolean;
  tiles: PresetTile[];
}

// Accepts a preset file, or the raw board dump made before presets existed
// (same fields, but `imageUrl` instead of `image` and no format marker).
export function parsePreset(json: unknown): BoardPreset {
  if (!json || typeof json !== "object" || !Array.isArray((json as { tiles?: unknown }).tiles)) {
    throw new Error("Not a board preset file");
  }
  const raw = json as Record<string, unknown> & { tiles: Record<string, unknown>[] };
  const bonuses = (raw.rowColBonuses ?? {}) as Partial<BoardPreset["rowColBonuses"]>;
  return {
    format: PRESET_FORMAT,
    version: Number(raw.version ?? PRESET_VERSION),
    exportedAt: String(raw.exportedAt ?? ""),
    name: String(raw.name ?? ""),
    description: (raw.description as string | null) ?? null,
    size: [3, 4, 5].includes(Number(raw.size)) ? Number(raw.size) : 5,
    rowColBonuses: { t1: Number(bonuses.t1 ?? 0), t2: Number(bonuses.t2 ?? 0), t3: Number(bonuses.t3 ?? 0) },
    scaleByTeamSize: Boolean(raw.scaleByTeamSize),
    tiles: raw.tiles
      .filter((t) => Number.isInteger(t.position) && (t.position as number) >= 0 && (t.position as number) < 25)
      .map((t) => ({
        position: t.position as number,
        title: String(t.title ?? ""),
        description: (t.description as string | null) ?? null,
        rules: (t.rules as string | null) ?? null,
        image: ((t.image ?? t.imageUrl) as string | null) ?? null,
        scoringMode: t.scoringMode === "POINTS" ? "POINTS" : "TIERED",
        tiers: t.tiers ?? [],
        pointsConfig: t.pointsConfig ?? null,
      })),
  };
}
