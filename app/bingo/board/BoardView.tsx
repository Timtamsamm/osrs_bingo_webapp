"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export type TeamStatus = {
  teamId: string;
  completed: boolean;
  inProgress: boolean;
  achievedTiers: number[];
  pointsEarned?: number;
};

export type TileTier = {
  tier: number;
  points: number;
  requiredCount: number;
  description: string | null;
  items: string[];
};

export type PointsItem = { id: number; name: string; basePoints: number };

export type TileSummary = {
  id: string;
  position: number;
  title: string;
  description: string | null;
  points: number;
  scoringMode: "TIERED" | "POINTS";
  tiers: TileTier[];
  pointsTarget: number | null;
  pointsItems: PointsItem[];
  imageUrl: string | null;
  teamStatuses: TeamStatus[];
};

export type TeamInfo = {
  id: string;
  name: string;
  color: string;
  earnedPoints: number;
  completedTiles: number;
};

export type LineStatus = {
  teamId: string;
  bonusTier: number | null;
};

export type LineSummary = {
  index: number;
  statuses: LineStatus[];
};

export type BonusConfig = {
  t1: number;
  t2: number;
  t3: number;
};

type View = "grid" | "list";

interface Props {
  tiles: TileSummary[];
  teams: TeamInfo[];
  rowSummaries: LineSummary[];
  colSummaries: LineSummary[];
  bonusConfig: BonusConfig;
  size: number;
}

function tileGlowClass(tile: TileSummary) {
  const anyComplete = tile.teamStatuses.some((s) => s.completed);
  const anyProgress = tile.teamStatuses.some((s) => s.inProgress);
  if (anyComplete) return "tile-glow-complete";
  if (anyProgress) return "tile-glow-progress";
  return "";
}

function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? "#000" : "#fff";
}

const MAX_VISIBLE_TEAMS = 6;

function TeamDots({ tile, teams }: { tile: TileSummary; teams: TeamInfo[] }) {
  const isPoints = tile.scoringMode === "POINTS";
  // Teams with any progress are more useful to see than idle ones, so they
  // take priority for the limited dot slots when there are many teams.
  const withStatus = teams.map((team) => {
    const status = tile.teamStatuses.find((s) => s.teamId === team.id);
    return {
      team,
      completed: status?.completed ?? false,
      inProgress: status?.inProgress ?? false,
      tiers: status?.achievedTiers ?? [],
      pointsEarned: status?.pointsEarned ?? 0,
    };
  });
  const active = withStatus.filter((t) => t.completed || t.inProgress);
  const idle = withStatus.filter((t) => !t.completed && !t.inProgress);
  const visible = [...active, ...idle].slice(0, MAX_VISIBLE_TEAMS);
  const overflow = withStatus.length - visible.length;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map(({ team, completed, inProgress, tiers, pointsEarned }) => {
        const label = isPoints
          ? `${+pointsEarned.toFixed(1)}/${+(tile.pointsTarget ?? 0).toFixed(1)} pts`
          : completed
          ? "T1 complete"
          : tiers.length > 0
          ? `T${[...tiers].sort().join(", T")} achieved`
          : "not started";
        return (
          <span
            key={team.id}
            title={`${team.name}: ${label}`}
            className="w-2 h-2 rounded-full flex-shrink-0 border"
            style={{
              background: completed ? team.color : inProgress ? `${team.color}50` : "transparent",
              borderColor: completed || inProgress ? team.color : "#3b2060",
              boxShadow: completed ? `0 0 4px ${team.color}90` : undefined,
            }}
          />
        );
      })}
      {overflow > 0 && (
        <span className="text-[9px] text-purple-500/70 font-medium leading-none" title={`+${overflow} more team${overflow === 1 ? "" : "s"}`}>
          +{overflow}
        </span>
      )}
    </div>
  );
}

function CompletionBadge({ tile, teams }: { tile: TileSummary; teams: TeamInfo[] }) {
  const completedTeams = tile.teamStatuses
    .filter((s) => s.completed)
    .map((s) => teams.find((t) => t.id === s.teamId))
    .filter(Boolean) as TeamInfo[];
  if (completedTeams.length === 0) return null;
  const visible = completedTeams.slice(0, MAX_VISIBLE_TEAMS);
  const overflow = completedTeams.length - visible.length;
  return (
    <div className="flex items-center gap-0.5">
      {visible.map((team) => (
        <span
          key={team.id}
          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold"
          style={{ background: team.color, boxShadow: `0 0 5px ${team.color}` }}
          title={`${team.name} completed`}
        >
          ✓
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[9px] font-bold text-purple-300 ml-0.5" title={`+${overflow} more team${overflow === 1 ? "" : "s"} completed`}>
          +{overflow}
        </span>
      )}
    </div>
  );
}

function LineIndicator({
  summary,
  teams,
  bonusConfig,
  direction,
}: {
  summary: LineSummary;
  teams: TeamInfo[];
  bonusConfig: BonusConfig;
  direction: "row" | "col";
}) {
  const achieved = summary.statuses.filter((s) => s.bonusTier !== null);
  const MAX_VISIBLE_LINE_BADGES = 3;
  const visible = achieved.slice(0, MAX_VISIBLE_LINE_BADGES);
  const overflow = achieved.length - visible.length;

  const inner =
    achieved.length === 0 ? (
      <span className="text-[9px] text-purple-900/30 select-none leading-none">—</span>
    ) : (
      <>
        {visible.map((s) => {
          const team = teams.find((t) => t.id === s.teamId)!;
          const pts = s.bonusTier === 1 ? bonusConfig.t1 : s.bonusTier === 2 ? bonusConfig.t2 : bonusConfig.t3;
          return (
            <span
              key={s.teamId}
              className="text-[9px] font-bold rounded px-1 py-0.5 leading-none"
              style={{
                background: team.color,
                color: contrastColor(team.color),
                boxShadow: `0 0 5px ${team.color}60`,
              }}
              title={`${team.name}: ${direction} complete — T${s.bonusTier} (+${pts} pts)`}
            >
              T{s.bonusTier}
            </span>
          );
        })}
        {overflow > 0 && (
          <span
            className="text-[9px] text-purple-400 font-medium leading-none"
            title={`+${overflow} more team${overflow === 1 ? "" : "s"}`}
          >
            +{overflow}
          </span>
        )}
      </>
    );

  if (direction === "row") {
    return (
      <div className="flex flex-col items-center justify-center gap-1 shrink-0" style={{ width: "2rem" }}>
        {inner}
      </div>
    );
  }
  return (
    <div className="flex flex-row items-center justify-center gap-1 flex-wrap pt-1">
      {inner}
    </div>
  );
}

const TIER_ACCENT: Record<number, string> = {
  1: "border-l-amber-500",
  2: "border-l-purple-500",
  3: "border-l-emerald-500",
};

function TileDetailModal({ tile, teams, onClose }: { tile: TileSummary; teams: TeamInfo[]; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const sortedTiers = [...tile.tiers].sort((a, b) => a.tier - b.tier);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0e0820] border border-purple-900/50 rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto purple-glow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {tile.imageUrl && (
          <div className="relative w-full h-32 overflow-hidden">
            <Image src={tile.imageUrl} alt={tile.title} fill sizes="400px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e0820] via-transparent to-transparent" />
          </div>
        )}

        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-[family-name:var(--font-cinzel)] text-xl font-bold text-white heading-glow">{tile.title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-purple-500 hover:text-white transition-colors text-xl leading-none shrink-0"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {tile.description && (
            <div className="flex flex-col gap-1">
              <p className="text-xs tracking-[0.2em] text-purple-500 uppercase font-semibold">Tile Objective</p>
              <p className="text-sm text-purple-300/80">{tile.description}</p>
            </div>
          )}

          {tile.scoringMode === "POINTS" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs tracking-[0.2em] text-purple-500 uppercase font-semibold">Items</p>
                <span className="text-sm font-semibold text-white">{+(tile.pointsTarget ?? 0).toFixed(1)} pts to complete</span>
              </div>
              {tile.pointsItems.length === 0 ? (
                <p className="text-sm text-purple-600/70">No items configured yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tile.pointsItems.map((item) => (
                    <span key={item.id} className="text-xs text-purple-200 bg-purple-900/40 border border-purple-700/30 rounded-full px-2 py-0.5">
                      {item.name} <span className="text-purple-400">· {+item.basePoints.toFixed(1)}pt</span>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-purple-700/60">Duplicate drops of the same item are worth less each time (halves twice, then stays at 25% of its base value), so a mix of items completes it fastest.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs tracking-[0.2em] text-purple-500 uppercase font-semibold">Tiers</p>
              {sortedTiers.length === 0 ? (
                <p className="text-sm text-purple-600/70">No tiers configured yet.</p>
              ) : (
                sortedTiers.map((td) => (
                  <div
                    key={td.tier}
                    className={`flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-[#130a28]/60 border-l-4 border-y border-r border-y-purple-900/30 border-r-purple-900/30 ${TIER_ACCENT[td.tier] ?? "border-l-purple-700"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-purple-100">T{td.tier}</span>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-semibold text-white">{+td.points.toFixed(1)} pts</span>
                        <span className="text-xs text-purple-500 ml-2">{td.requiredCount}× required</span>
                      </div>
                    </div>
                    {td.description && <p className="text-xs text-purple-400/70 whitespace-pre-line">{td.description}</p>}
                    {td.items.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {td.items.map((name) => (
                          <span key={name} className="text-xs text-purple-200 bg-purple-900/40 border border-purple-700/30 rounded-full px-2 py-0.5">
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {teams.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs tracking-[0.2em] text-purple-500 uppercase font-semibold">Team progress</p>
              <div className="flex flex-col gap-1.5">
                {teams.map((team) => {
                  const status = tile.teamStatuses.find((s) => s.teamId === team.id);
                  if (tile.scoringMode === "POINTS") {
                    const earned = status?.pointsEarned ?? 0;
                    const target = tile.pointsTarget ?? 0;
                    const pct = target > 0 ? Math.min((earned / target) * 100, 100) : 0;
                    return (
                      <div key={team.id} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: team.color, boxShadow: `0 0 4px ${team.color}` }} />
                        <span className="text-purple-200 flex-1 truncate">{team.name}</span>
                        <div className="w-16 h-1.5 bg-purple-950/60 rounded-full overflow-hidden shrink-0">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: team.color }} />
                        </div>
                        <span className="text-xs text-purple-500 shrink-0 tabular-nums">{+earned.toFixed(1)}/{+target.toFixed(1)}</span>
                      </div>
                    );
                  }
                  const achieved = status?.achievedTiers ?? [];
                  const label = achieved.length > 0 ? `T${[...achieved].sort().join(", T")}` : "Not started";
                  return (
                    <div key={team.id} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: team.color, boxShadow: `0 0 4px ${team.color}` }} />
                      <span className="text-purple-200 flex-1 truncate">{team.name}</span>
                      <span className="text-xs text-purple-500 shrink-0">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BoardView({ tiles, teams, rowSummaries, colSummaries, bonusConfig, size }: Props) {
  const [view, setView] = useState<View>("grid");
  const [detailTile, setDetailTile] = useState<TileSummary | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("boardView") as View | null;
    // localStorage isn't available during SSR, so the saved preference can only
    // be restored after mount — this one-time sync is the exception to the rule.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "grid" || saved === "list") setView(saved);
  }, []);

  function switchView(v: View) {
    setView(v);
    localStorage.setItem("boardView", v);
  }

  const hasLineBonuses = bonusConfig.t1 > 0 || bonusConfig.t2 > 0 || bonusConfig.t3 > 0;

  // Position map for grid rendering
  const tileByPos = new Map(tiles.map((t) => [t.position, t]));
  const indices = Array.from({ length: size }, (_, i) => i);

  return (
    <div>
      {/* View toggle */}
      <div className="flex justify-end mb-3">
        <div className="flex rounded-lg border border-purple-900/50 overflow-hidden">
          <button
            type="button"
            onClick={() => switchView("grid")}
            title="Grid view"
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === "grid" ? "text-white" : "bg-transparent text-purple-600 hover:text-purple-300"}`}
            style={view === "grid" ? { backgroundColor: "rgb(var(--accent) / 0.25)", color: "rgb(var(--accent))" } : undefined}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => switchView("list")}
            title="List view"
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-purple-900/50 ${view === "list" ? "text-white" : "bg-transparent text-purple-600 hover:text-purple-300"}`}
            style={view === "list" ? { backgroundColor: "rgb(var(--accent) / 0.25)", color: "rgb(var(--accent))" } : undefined}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="5" width="18" height="2" rx="1"/><rect x="3" y="11" width="18" height="2" rx="1"/><rect x="3" y="17" width="18" height="2" rx="1"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Grid view */}
      {view === "grid" && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: hasLineBonuses ? `repeat(${size}, 1fr) 2rem` : `repeat(${size}, 1fr)` }}
        >
          {/* `size` rows of tiles */}
          {indices.flatMap((rowIdx) => {
            const tileCells = indices.map((colIdx) => {
              const pos = rowIdx * size + colIdx;
              const tile = tileByPos.get(pos);
              if (!tile) {
                return (
                  <div
                    key={`empty-${pos}`}
                    className="rounded-xl border border-purple-900/20 bg-surface/20"
                    style={{ aspectRatio: "1/1" }}
                  />
                );
              }
              const glow = tileGlowClass(tile);
              return (
                <div
                  key={tile.id}
                  onClick={() => setDetailTile(tile)}
                  className={`relative rounded-xl tile-metal-frame bg-surface/80 overflow-hidden flex flex-col transition-all duration-200 cursor-pointer hover:brightness-110 ${glow}`}
                  style={{ aspectRatio: "1/1" }}
                >
                  {tile.imageUrl && (
                    <>
                      <Image src={tile.imageUrl} alt={tile.title} fill sizes="200px" className="object-cover opacity-70" />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/60" />
                    </>
                  )}
                  <div className="relative z-10 flex flex-col h-full p-2">
                    <div className="flex items-start justify-between gap-1 flex-1">
                      <p className="text-xs font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] leading-tight line-clamp-3">
                        {tile.title}
                      </p>
                      <div className="shrink-0 mt-0.5">
                        <CompletionBadge tile={tile} teams={teams} />
                      </div>
                    </div>
                    <div className="flex items-end justify-between gap-1 mt-1">
                      <TeamDots tile={tile} teams={teams} />
                      <span className="text-[10px] text-purple-300/70 tabular-nums shrink-0">
                        {+tile.points.toFixed(1)}pt
                      </span>
                    </div>
                  </div>
                </div>
              );
            });

            if (!hasLineBonuses) return tileCells;

            return [
              ...tileCells,
              <LineIndicator
                key={`row-ind-${rowIdx}`}
                summary={rowSummaries[rowIdx]}
                teams={teams}
                bonusConfig={bonusConfig}
                direction="row"
              />,
            ];
          })}

          {/* Column indicators */}
          {hasLineBonuses && (
            <>
              {indices.map((colIdx) => (
                <LineIndicator
                  key={`col-ind-${colIdx}`}
                  summary={colSummaries[colIdx]}
                  teams={teams}
                  bonusConfig={bonusConfig}
                  direction="col"
                />
              ))}
              <div key="corner" />
            </>
          )}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="flex flex-col gap-1.5">
          {tiles.map((tile) => {
            const glow = tileGlowClass(tile);
            return (
              <div
                key={tile.id}
                onClick={() => setDetailTile(tile)}
                className={`flex items-center gap-3 rounded-xl border border-purple-900/40 hover:border-purple-700/50 bg-surface/80 px-4 py-3 transition-all cursor-pointer ${glow}`}
              >
                {tile.imageUrl && (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                    <Image src={tile.imageUrl} alt={tile.title} fill sizes="40px" className="object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-purple-100 truncate">{tile.title}</p>
                  {tile.description && (
                    <p className="text-xs text-purple-500/70 truncate mt-0.5">{tile.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <TeamDots tile={tile} teams={teams} />
                  <CompletionBadge tile={tile} teams={teams} />
                  <span className="text-xs text-purple-500/60 tabular-nums w-10 text-right">
                    {+tile.points.toFixed(1)} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {teams.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-6 text-xs text-purple-600/70">
          {teams.map((team) => (
            <span key={team.id} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: team.color, boxShadow: `0 0 4px ${team.color}` }} />
              {team.name}
            </span>
          ))}
          <span className="text-purple-800 ml-2">
            · filled = T1 complete · half = lower tier done · outline = not started
            {hasLineBonuses && " · tier badge = row/col bonus"}
          </span>
        </div>
      )}

      {detailTile && <TileDetailModal tile={detailTile} teams={teams} onClose={() => setDetailTile(null)} />}
    </div>
  );
}
