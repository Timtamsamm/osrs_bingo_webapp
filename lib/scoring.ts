/**
 * Shared team-standings scoring — used by the board page, the teams index,
 * and the per-team page's rank calculation, so all three always agree.
 */
export type TierDef = { tier: number; points: number; requiredCount: number; description?: string; dinkItems: Array<{ id: number; name: string }> };
export type PointsItemDef = { id: number; name: string; basePoints: number };
// target is optional — when omitted, points are uncapped ("infinite") and
// the tile instead completes once the team has received at least one of
// every listed item (a full collection, not a point threshold).
export type PointsConfig = { target?: number; items: PointsItemDef[] };
export type BonusConfig = { t1: number; t2: number; t3: number };

/**
 * Points-mode tiles allow unlimited duplicate drops of the same item, each
 * worth less than the last, so a team can't just farm one boss forever.
 * The value halves twice (100% → 50% → 25% of base) then stays flat at 25%
 * forever — enough duplicates of a single item can still eventually
 * complete the tile alone, just more slowly than mixing items.
 * occurrence: 1 for the first drop of this item, 2 for the second, etc.
 */
export function diminishingPoints(basePoints: number, occurrence: number): number {
  const cappedOccurrence = Math.min(occurrence, 3);
  return basePoints / Math.pow(2, cappedOccurrence - 1);
}

/**
 * Team-size scaling (opt-in per board, see BingoBoard.scaleByTeamSize):
 * smaller teams need proportionally fewer drops/points to *complete* a
 * tile, relative to the board's biggest team — but the reward for
 * completing it is always the same regardless of size. scaleFactor is
 * `thisTeamSize / biggestTeamSize`, clamped to (0, 1]; 1 means no scaling
 * (the default/disabled case).
 */
export function scaledRequirement(original: number, scaleFactor: number): number {
  return Math.max(1, Math.round(original * scaleFactor));
}

export function scaleFactorFor(teamSize: number, maxTeamSize: number): number {
  if (maxTeamSize <= 0 || teamSize <= 0) return 1;
  return Math.min(1, teamSize / maxTeamSize);
}

/** Normalizes a team's participant count for scaling purposes — an empty
 * team (0 participants, or size not provided) is treated as size 1 rather
 * than being excluded, so it doesn't skew maxTeamSize or divide by zero.
 * Every caller that builds a TeamForScoring or computes scale factors
 * should go through this so they can never disagree with each other. */
export function normalizedTeamSize(size: number | undefined | null): number {
  return size || 1;
}

export interface TileForScoring {
  id: string;
  position: number;
  title: string;
  scoringMode: "TIERED" | "POINTS";
  tiers: TierDef[];
  pointsConfig: PointsConfig | null;
  submissions: Array<{ teamId: string | null; tier: number | null; status: string; pointsAwarded: number | null; dinkItemId: number | null }>;
}

export interface TeamForScoring {
  id: string;
  name: string;
  color: string;
  size?: number; // participant count — only needed when the board has scaleByTeamSize on
}

export interface TeamStanding {
  id: string;
  name: string;
  color: string;
  earnedPoints: number;
  completedTiles: number;
}

/** Row position groups for a `size` x `size` grid, e.g. size=3 → [[0,1,2],[3,4,5],[6,7,8]]. */
export function getRows(size: number): number[][] {
  return Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => r * size + c));
}

/** Column position groups for a `size` x `size` grid, e.g. size=3 → [[0,3,6],[1,4,7],[2,5,8]]. */
export function getCols(size: number): number[][] {
  return Array.from({ length: size }, (_, c) => Array.from({ length: size }, (_, r) => r * size + c));
}

export function bonusPts(tier: number | null, cfg: BonusConfig): number {
  if (tier === null) return 0;
  if (tier === 1) return cfg.t1;
  if (tier === 2) return cfg.t2;
  return cfg.t3;
}

function isConfiguredTile(t: TileForScoring | undefined): t is TileForScoring {
  if (!t) return false;
  return t.scoringMode === "POINTS" ? !!t.pointsConfig : t.tiers.length > 0;
}

/** A points tile's nominal "max" value — its target if it has one, or the
 * sum of every item's base value (i.e. one of each) when uncapped. Used for
 * the board's overall total-points denominator; an uncapped tile can still
 * earn more than this via duplicates. Never scaled by team size — every
 * team's tile is nominally "worth" the same amount. */
export function pointsNominalMax(cfg: PointsConfig): number {
  if (cfg.target != null) return cfg.target;
  return cfg.items.reduce((sum, i) => sum + i.basePoints, 0);
}

/** A team's progress on one points-mode tile: earned points (capped at the
 * *original* target if one is set, otherwise uncapped — never scaled, so
 * completing a tile is worth the same to every team) and whether it's
 * complete. Completion itself uses a scaled-down threshold for smaller
 * teams when scaleFactor < 1: a lower point total, or fewer distinct items
 * out of the full list, needed to count as done. */
export function pointsTileProgress(
  cfg: PointsConfig,
  teamSubs: Array<{ pointsAwarded: number | null; dinkItemId: number | null }>,
  scaleFactor: number = 1
): { earned: number; completed: boolean; receivedItemIds: Set<number> } {
  const total = teamSubs.reduce((sum, s) => sum + (s.pointsAwarded ?? 0), 0);
  const receivedItemIds = new Set(teamSubs.map((s) => s.dinkItemId).filter((id): id is number => id != null));

  if (cfg.target != null) {
    const earned = Math.min(total, cfg.target);
    const completionThreshold = Math.max(0.01, cfg.target * scaleFactor);
    return { earned, completed: total >= completionThreshold, receivedItemIds };
  }

  // Count only current items — an item removed from cfg after a team
  // already received it shouldn't keep counting toward completion.
  const receivedFromCurrentItems = cfg.items.filter((i) => receivedItemIds.has(i.id)).length;
  const neededItems = scaledRequirement(cfg.items.length, scaleFactor);
  const completed = cfg.items.length > 0 && receivedFromCurrentItems >= neededItems;
  return { earned: total, completed, receivedItemIds };
}

/** The bonus tier a team has earned for a row/column (null = line not complete). */
export function getLineBonusTier(tiles: TileForScoring[], positions: number[], teamId: string, scaleFactor: number = 1): number | null {
  const tileByPos = new Map(tiles.map((t) => [t.position, t]));
  const tilesInLine = positions.map((p) => tileByPos.get(p));
  if (tilesInLine.some((t) => !isConfiguredTile(t))) return null;

  const bestPerTile = tilesInLine.map((tile) => {
    const teamSubs = tile!.submissions.filter((s) => s.teamId === teamId && s.status === "APPROVED");

    if (tile!.scoringMode === "POINTS" && tile!.pointsConfig) {
      // A points tile has one completion state, not discrete tiers — treat
      // completing it as equivalent to the best (T1) tier for line bonus
      // purposes.
      const { completed } = pointsTileProgress(tile!.pointsConfig, teamSubs, scaleFactor);
      return completed ? 1 : null;
    }

    const achieved = tile!.tiers
      .filter((td) => teamSubs.filter((s) => s.tier === td.tier).length >= scaledRequirement(td.requiredCount, scaleFactor))
      .map((td) => td.tier);
    return achieved.length > 0 ? Math.min(...achieved) : null;
  });

  if (bestPerTile.some((b) => b === null)) return null;
  return Math.max(...(bestPerTile as number[]));
}

export function computeStandings(
  allTiles: TileForScoring[],
  teams: TeamForScoring[],
  bonusConfig: BonusConfig,
  size: number,
  scaleByTeamSize: boolean = false
): { standings: TeamStanding[]; totalPoints: number; totalTiles: number } {
  // Tiles left over from a larger board size are ignored, not deleted — see getRows/getCols.
  const tiles = allTiles.filter((t) => t.position < size * size);
  const rows = getRows(size);
  const cols = getCols(size);
  const maxTeamSize = scaleByTeamSize ? Math.max(1, ...teams.map((t) => normalizedTeamSize(t.size))) : 1;

  const standings: TeamStanding[] = teams.map((team) => {
    const scaleFactor = scaleByTeamSize ? scaleFactorFor(normalizedTeamSize(team.size), maxTeamSize) : 1;
    let earnedPoints = 0;
    let completedTiles = 0;

    for (const tile of tiles) {
      const teamSubs = tile.submissions.filter((s) => s.teamId === team.id && s.status === "APPROVED");

      if (tile.scoringMode === "POINTS" && tile.pointsConfig) {
        const { earned, completed } = pointsTileProgress(tile.pointsConfig, teamSubs, scaleFactor);
        earnedPoints += earned;
        if (completed) completedTiles++;
        continue;
      }

      for (const tierDef of tile.tiers) {
        const approvedForTier = teamSubs.filter((s) => s.tier === tierDef.tier).length;
        if (approvedForTier >= scaledRequirement(tierDef.requiredCount, scaleFactor)) earnedPoints += tierDef.points;
      }
      const t1 = tile.tiers.find((t) => t.tier === 1);
      if (t1 && teamSubs.filter((s) => s.tier === 1).length >= scaledRequirement(t1.requiredCount, scaleFactor)) {
        completedTiles++;
      }
    }

    for (const row of rows) earnedPoints += bonusPts(getLineBonusTier(tiles, row, team.id, scaleFactor), bonusConfig);
    for (const col of cols) earnedPoints += bonusPts(getLineBonusTier(tiles, col, team.id, scaleFactor), bonusConfig);

    return { id: team.id, name: team.name, color: team.color, earnedPoints, completedTiles };
  }).sort((a, b) => b.earnedPoints - a.earnedPoints || a.name.localeCompare(b.name));

  const tilePts = tiles.reduce((sum, tile) => {
    if (tile.scoringMode === "POINTS" && tile.pointsConfig) return sum + pointsNominalMax(tile.pointsConfig);
    return sum + tile.tiers.reduce((s, t) => s + t.points, 0);
  }, 0);
  const maxLineBonus = Math.max(bonusConfig.t1, bonusConfig.t2, bonusConfig.t3);
  const totalPoints = tilePts + rows.length * maxLineBonus + cols.length * maxLineBonus;
  const totalTiles = tiles.filter((t) => t.title.trim()).length;

  return { standings, totalPoints, totalTiles };
}
