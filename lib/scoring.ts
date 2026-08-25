/**
 * Shared team-standings scoring — used by the board page, the teams index,
 * and the per-team page's rank calculation, so all three always agree.
 */
export type TierDef = { tier: number; points: number; requiredCount: number; dinkItems: Array<{ id: number; name: string }> };
export type BonusConfig = { t1: number; t2: number; t3: number };

export interface TileForScoring {
  id: string;
  position: number;
  title: string;
  tiers: TierDef[];
  submissions: Array<{ teamId: string | null; tier: number | null; status: string }>;
}

export interface TeamForScoring {
  id: string;
  name: string;
  color: string;
}

export interface TeamStanding {
  id: string;
  name: string;
  color: string;
  earnedPoints: number;
  completedTiles: number;
}

export const ROWS = Array.from({ length: 5 }, (_, r) => [r * 5, r * 5 + 1, r * 5 + 2, r * 5 + 3, r * 5 + 4]);
export const COLS = Array.from({ length: 5 }, (_, c) => [c, c + 5, c + 10, c + 15, c + 20]);

export function bonusPts(tier: number | null, cfg: BonusConfig): number {
  if (tier === null) return 0;
  if (tier === 1) return cfg.t1;
  if (tier === 2) return cfg.t2;
  return cfg.t3;
}

/** The bonus tier a team has earned for a row/column (null = line not complete). */
export function getLineBonusTier(tiles: TileForScoring[], positions: number[], teamId: string): number | null {
  const tileByPos = new Map(tiles.map((t) => [t.position, t]));
  const tilesInLine = positions.map((p) => tileByPos.get(p));
  if (tilesInLine.some((t) => !t || t.tiers.length === 0)) return null;

  const bestPerTile = tilesInLine.map((tile) => {
    const teamSubs = tile!.submissions.filter((s) => s.teamId === teamId);
    const achieved = tile!.tiers
      .filter((td) => teamSubs.filter((s) => s.tier === td.tier && s.status === "APPROVED").length >= td.requiredCount)
      .map((td) => td.tier);
    return achieved.length > 0 ? Math.min(...achieved) : null;
  });

  if (bestPerTile.some((b) => b === null)) return null;
  return Math.max(...(bestPerTile as number[]));
}

export function computeStandings(
  tiles: TileForScoring[],
  teams: TeamForScoring[],
  bonusConfig: BonusConfig
): { standings: TeamStanding[]; totalPoints: number; totalTiles: number } {
  const standings: TeamStanding[] = teams.map((team) => {
    let earnedPoints = 0;
    let completedTiles = 0;

    for (const tile of tiles) {
      const teamSubs = tile.submissions.filter((s) => s.teamId === team.id);
      for (const tierDef of tile.tiers) {
        const approvedForTier = teamSubs.filter((s) => s.tier === tierDef.tier && s.status === "APPROVED").length;
        if (approvedForTier >= tierDef.requiredCount) earnedPoints += tierDef.points;
      }
      const t1 = tile.tiers.find((t) => t.tier === 1);
      if (t1 && teamSubs.filter((s) => s.tier === 1 && s.status === "APPROVED").length >= t1.requiredCount) {
        completedTiles++;
      }
    }

    for (const row of ROWS) earnedPoints += bonusPts(getLineBonusTier(tiles, row, team.id), bonusConfig);
    for (const col of COLS) earnedPoints += bonusPts(getLineBonusTier(tiles, col, team.id), bonusConfig);

    return { id: team.id, name: team.name, color: team.color, earnedPoints, completedTiles };
  }).sort((a, b) => b.earnedPoints - a.earnedPoints || a.name.localeCompare(b.name));

  const tilePts = tiles.reduce((sum, tile) => sum + tile.tiers.reduce((s, t) => s + t.points, 0), 0);
  const maxLineBonus = Math.max(bonusConfig.t1, bonusConfig.t2, bonusConfig.t3);
  const totalPoints = tilePts + 10 * maxLineBonus;
  const totalTiles = tiles.filter((t) => t.title.trim()).length;

  return { standings, totalPoints, totalTiles };
}
