import Image from "next/image";

export interface TeamBoardTile {
  id: string;
  position: number;
  title: string;
  imageUrl: string | null;
  tiers: { tier: number; points: number; requiredCount: number }[];
  achievedTiers: number[];
}

interface Props {
  tiles: TeamBoardTile[];
  size: number;
  teamColor: string;
}

export default function TeamBoardGrid({ tiles, size, teamColor }: Props) {
  const tileByPos = new Map(tiles.map((t) => [t.position, t]));
  const indices = Array.from({ length: size }, (_, i) => i);

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
      {indices.flatMap((rowIdx) =>
        indices.map((colIdx) => {
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

          const completed = tile.achievedTiers.includes(1);
          const inProgress = !completed && tile.achievedTiers.length > 0;
          const totalPoints = tile.tiers.reduce((sum, td) => sum + td.points, 0);
          const earnedPoints = tile.tiers
            .filter((td) => tile.achievedTiers.includes(td.tier))
            .reduce((sum, td) => sum + td.points, 0);
          const glow = completed ? "tile-glow-complete" : inProgress ? "tile-glow-progress" : "";

          return (
            <div
              key={tile.id}
              className={`relative rounded-xl tile-metal-frame bg-surface/80 overflow-hidden flex flex-col transition-all duration-200 ${glow}`}
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
                  {completed && (
                    <span
                      className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5"
                      style={{ background: teamColor, boxShadow: `0 0 5px ${teamColor}` }}
                      title="Complete"
                    >
                      ✓
                    </span>
                  )}
                </div>
                <div className="flex items-end justify-between gap-1 mt-1">
                  {tile.achievedTiers.length > 0 ? (
                    <span className="text-[9px] text-purple-300/80 font-semibold">
                      {[...tile.achievedTiers].sort().map((t) => `T${t}`).join(" ")}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="text-[10px] text-purple-300/70 tabular-nums shrink-0">
                    {+earnedPoints.toFixed(1)}/{+totalPoints.toFixed(1)}pt
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
