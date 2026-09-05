"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ImageCropper from "@/app/components/ImageCropper";
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export interface TierDef {
  tier: 1 | 2 | 3;
  points: number;
  requiredCount: number;
  description?: string;
  dinkItems: Array<{ id: number; name: string }>;
}

export interface PointsItemDef {
  id: number;
  name: string;
  basePoints: number;
}

export interface PointsConfig {
  target?: number;
  items: PointsItemDef[];
}

interface Tile {
  id: string;
  position: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  scoringMode: string;
  tiers: TierDef[] | null;
  pointsConfig: PointsConfig | null;
}

interface Board {
  id: string;
  name: string;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  dinkToken: string | null;
  rowColBonuses: { t1: number; t2: number; t3: number } | null;
  size: number;
  scaleByTeamSize: boolean;
  tiles: Tile[];
}

const BOARD_SIZES = [3, 4, 5] as const;
const MAX_SIZE = 5;
const GRID_COLS_CLASS: Record<number, string> = { 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" };

function parseDinkItems(text: string): Array<{ id: number; name: string }> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const spaceIdx = line.indexOf(" ");
      if (spaceIdx === -1) return [];
      const id = parseInt(line.slice(0, spaceIdx), 10);
      const name = line.slice(spaceIdx + 1).trim();
      if (isNaN(id) || !name) return [];
      return [{ id, name }];
    });
}

function dinkItemsToText(items: Array<{ id: number; name: string }> | null): string {
  return (items ?? []).map((i) => `${i.id} ${i.name}`).join("\n");
}

function parsePointsItems(text: string): PointsItemDef[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 3) return [];
      const id = parseInt(parts[0], 10);
      const basePoints = parseFloat(parts[1]);
      const name = parts.slice(2).join(" ");
      if (isNaN(id) || isNaN(basePoints) || !name) return [];
      return [{ id, name, basePoints }];
    });
}

function pointsItemsToText(items: PointsItemDef[] | null | undefined): string {
  return (items ?? []).map((i) => `${i.id} ${i.basePoints} ${i.name}`).join("\n");
}

function toDatetimeLocal(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

interface TierState {
  points: number;
  requiredCount: number;
  description: string;
  dinkItemsText: string;
}

interface TileState {
  title: string;
  description: string;
  imageUrl: string | null;
  scoringMode: "TIERED" | "POINTS";
  t1: TierState;
  t2: TierState;
  t3: TierState;
  pointsTargetText: string;
  pointsItemsText: string;
}

const EMPTY_TIER: TierState = { points: 1, requiredCount: 1, description: "", dinkItemsText: "" };

function makeTileState(t: Tile | undefined): TileState {
  if (!t) {
    return {
      title: "", description: "", imageUrl: null, scoringMode: "TIERED",
      t1: { ...EMPTY_TIER }, t2: { ...EMPTY_TIER }, t3: { ...EMPTY_TIER },
      pointsTargetText: "100", pointsItemsText: "",
    };
  }
  const tiers = t.tiers ?? [];
  const getTier = (n: 1 | 2 | 3): TierState => {
    const td = tiers.find((d) => d.tier === n);
    return td ? { points: td.points, requiredCount: td.requiredCount, description: td.description ?? "", dinkItemsText: dinkItemsToText(td.dinkItems) } : { ...EMPTY_TIER };
  };
  return {
    title: t.title,
    description: t.description ?? "",
    imageUrl: t.imageUrl ?? null,
    scoringMode: t.scoringMode === "POINTS" ? "POINTS" : "TIERED",
    t1: getTier(1), t2: getTier(2), t3: getTier(3),
    pointsTargetText: t.pointsConfig ? (t.pointsConfig.target != null ? String(t.pointsConfig.target) : "") : "100",
    pointsItemsText: pointsItemsToText(t.pointsConfig?.items),
  };
}

function stateToTiers(t: TileState): TierDef[] {
  const result: TierDef[] = [];
  for (const [tierNum, ts] of [[3, t.t3], [2, t.t2], [1, t.t1]] as [1 | 2 | 3, TierState][]) {
    const items = parseDinkItems(ts.dinkItemsText);
    if (items.length > 0) {
      result.push({ tier: tierNum, points: ts.points, requiredCount: ts.requiredCount, description: ts.description.trim(), dinkItems: items });
    }
  }
  return result;
}

function stateToPointsConfig(t: TileState): PointsConfig | null {
  const items = parsePointsItems(t.pointsItemsText);
  if (items.length === 0) return null;
  const trimmed = t.pointsTargetText.trim();
  const target = trimmed === "" ? undefined : Number(trimmed);
  return { target: target != null && !isNaN(target) ? target : undefined, items };
}

/**
 * Maps each of the 25 visual cells (always a compact 5×5 admin canvas, in
 * row-major order) to the real tile position it should show. The active
 * boardSize×boardSize square goes in the top-left, using the exact same
 * `row*boardSize+col` numbering the real public board uses (see
 * getRows/getCols in lib/scoring.ts) — so a tile dragged within that square
 * ends up in the identical row/col on the real board. Everything else (the
 * L-shaped remainder of the 5×5 canvas) is filled in sequence with the
 * tiles that are hidden at the current board size, which have no real
 * row/col of their own to show.
 */
function buildAdminGridLayout(boardSize: number): Array<{ position: number; isActive: boolean }> {
  const layout: Array<{ position: number; isActive: boolean }> = [];
  let nextHiddenPos = boardSize * boardSize;
  for (let row = 0; row < MAX_SIZE; row++) {
    for (let col = 0; col < MAX_SIZE; col++) {
      if (row < boardSize && col < boardSize) {
        layout.push({ position: row * boardSize + col, isActive: true });
      } else {
        layout.push({ position: nextHiddenPos, isActive: false });
        nextHiddenPos++;
      }
    }
  }
  return layout;
}

interface Props {
  board: Board | null;
}

const inputCls = "bg-[#130a28] border border-purple-900/50 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-600/60 placeholder-purple-800";
const labelCls = "text-xs text-purple-400 font-medium";

const TIER_META: Record<"t1" | "t2" | "t3", { num: 1 | 2 | 3; label: string; hint: string }> = {
  t3: { num: 3, label: "T3", hint: "Fewest/simplest drops" },
  t2: { num: 2, label: "T2", hint: "" },
  t1: { num: 1, label: "T1", hint: "Most valuable drops" },
};

function TileCell({
  pos,
  tile,
  isSelected,
  isActive,
  onSelect,
}: {
  pos: number;
  tile: TileState;
  isSelected: boolean;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id: pos });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: pos });

  const filled = tile.title.trim().length > 0;
  const isPoints = tile.scoringMode === "POINTS";
  const hasTiers = filled && !isPoints && stateToTiers(tile).length > 0;
  const hasPointsItems = filled && isPoints && parsePointsItems(tile.pointsItemsText).length > 0;

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <button
      ref={(node) => { setDragRef(node); setDropRef(node); }}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onSelect}
      className={`touch-none w-14 h-14 rounded-lg border text-xs font-medium flex flex-col items-center justify-center p-1 text-center transition-all duration-150 ${
        isDragging ? "opacity-30 scale-95" : isOver ? "scale-110 ring-2 ring-purple-400" : ""
      } ${!isActive ? "opacity-35 grayscale" : ""} ${
        isSelected
          ? "border-purple-400 bg-purple-400/10 text-purple-200"
          : filled
          ? "border-purple-700/50 bg-[#130a28] text-purple-200"
          : "border-dashed border-purple-900/50 bg-[#0e0820] text-purple-700"
      }`}
    >
      <span className="line-clamp-2 leading-tight">{filled ? tile.title : pos + 1}</span>
      {hasTiers && (
        <span className="text-[8px] text-purple-500 mt-0.5">{stateToTiers(tile).map((td) => `T${td.tier}`).join(" ")}</span>
      )}
      {hasPointsItems && (
        <span className="text-[8px] text-emerald-500 mt-0.5">{tile.pointsTargetText.trim() ? `${tile.pointsTargetText}pt` : "∞"}</span>
      )}
      {!isActive && <span className="text-[7px] text-purple-800 mt-0.5">hidden</span>}
    </button>
  );
}

export default function BoardEditor({ board }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [boardName, setBoardName] = useState(board?.name ?? "");
  const [boardDesc, setBoardDesc] = useState(board?.description ?? "");
  const [boardStartsAt, setBoardStartsAt] = useState(toDatetimeLocal(board?.startsAt ?? null));
  const [boardEndsAt, setBoardEndsAt] = useState(toDatetimeLocal(board?.endsAt ?? null));
  const [boardSize, setBoardSize] = useState(board?.size ?? 5);
  const [boardDinkToken, setBoardDinkToken] = useState(board?.dinkToken ?? "");
  const [bonusT1, setBonusT1] = useState(board?.rowColBonuses?.t1 ?? 0);
  const [bonusT2, setBonusT2] = useState(board?.rowColBonuses?.t2 ?? 0);
  const [bonusT3, setBonusT3] = useState(board?.rowColBonuses?.t3 ?? 0);
  const [scaleByTeamSize, setScaleByTeamSize] = useState(board?.scaleByTeamSize ?? false);

  const generateDinkToken = useCallback(() => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(18)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setBoardDinkToken(token);
  }, []);

  const [tiles, setTiles] = useState<Record<number, TileState>>(() => {
    const map: Record<number, TileState> = {};
    for (let i = 0; i < MAX_SIZE * MAX_SIZE; i++) {
      map[i] = makeTileState(board?.tiles.find((t) => t.position === i));
    }
    return map;
  });

  const [selected, setSelected] = useState<number | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<{ pos: number; src: string } | null>(null);
  const [dragPos, setDragPos] = useState<number | null>(null);
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  // dnd-kit generates an internal accessibility id whose value can differ
  // between the server-rendered HTML and the client's first render,
  // producing a hydration mismatch — only mount the DnD-enabled grid once
  // we're definitely running in the browser, since it's a pure admin
  // interaction with nothing meaningful to server-render anyway.
  const [dndReady, setDndReady] = useState(false);
  useEffect(() => setDndReady(true), []);
  const gridLayout = useMemo(() => buildAdminGridLayout(boardSize), [boardSize]);

  function handleDragStart(event: DragStartEvent) {
    setDragPos(Number(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragPos(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromPos = Number(active.id);
    const toPos = Number(over.id);
    setTiles((prev) => {
      const next = { ...prev };
      next[fromPos] = prev[toPos];
      next[toPos] = prev[fromPos];
      return next;
    });
    setSelected((prevSelected) => {
      if (prevSelected === fromPos) return toPos;
      if (prevSelected === toPos) return fromPos;
      return prevSelected;
    });
  }

  function updateTile(pos: number, field: "title" | "description" | "pointsItemsText", value: string) {
    setTiles((prev) => ({ ...prev, [pos]: { ...prev[pos], [field]: value } }));
  }

  function setScoringMode(pos: number, mode: "TIERED" | "POINTS") {
    setTiles((prev) => ({ ...prev, [pos]: { ...prev[pos], scoringMode: mode } }));
  }

  function setPointsTarget(pos: number, value: string) {
    setTiles((prev) => ({ ...prev, [pos]: { ...prev[pos], pointsTargetText: value } }));
  }

  function updateTier(pos: number, tierKey: "t1" | "t2" | "t3", field: keyof TierState, value: string | number) {
    setTiles((prev) => ({
      ...prev,
      [pos]: { ...prev[pos], [tierKey]: { ...prev[pos][tierKey], [field]: value } },
    }));
  }

  function onFileSelected(pos: number, file: File) {
    setCropSrc({ pos, src: URL.createObjectURL(file) });
  }

  async function onCropDone(blob: Blob) {
    if (!cropSrc) return;
    const { pos, src } = cropSrc;
    setCropSrc(null);
    URL.revokeObjectURL(src);
    setImageUploading(true);
    const form = new FormData();
    form.append("file", blob, "tile.jpg");
    const existingId = board?.tiles.find((t) => t.position === pos)?.id;
    if (existingId) form.append("tileId", existingId);
    const res = await fetch("/api/admin/tiles/image", { method: "POST", body: form });
    if (res.ok) {
      const { url } = await res.json();
      setTiles((prev) => ({ ...prev, [pos]: { ...prev[pos], imageUrl: url } }));
    }
    setImageUploading(false);
  }

  function onCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc.src);
    setCropSrc(null);
  }

  async function saveBoard() {
    setSaving(true);
    setError("");
    try {
      const tilesPayload = Object.fromEntries(
        Object.entries(tiles)
          .filter(([pos]) => Number(pos) < boardSize * boardSize)
          .map(([pos, t]) => [
            pos,
            {
              title: t.title,
              description: t.description,
              imageUrl: t.imageUrl,
              scoringMode: t.scoringMode,
              tiers: t.scoringMode === "TIERED" ? stateToTiers(t) : [],
              pointsConfig: t.scoringMode === "POINTS" ? stateToPointsConfig(t) : null,
            },
          ])
      );
      const res = await fetch("/api/admin/board", {
        method: board ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: board?.id,
          name: boardName,
          description: boardDesc,
          startsAt: boardStartsAt ? new Date(boardStartsAt).toISOString() : null,
          endsAt: boardEndsAt ? new Date(boardEndsAt).toISOString() : null,
          size: boardSize,
          dinkToken: boardDinkToken,
          rowColBonuses: { t1: bonusT1, t2: bonusT2, t3: bonusT3 },
          scaleByTeamSize,
          tiles: tilesPayload,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const selectedTile = selected !== null ? tiles[selected] : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Board meta */}
      <div className="bg-[#0e0820] border border-purple-900/40 rounded-xl p-4 flex flex-col gap-3">
        <h2 className="font-semibold text-purple-100 text-sm">Board Details</h2>
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <label className={labelCls}>Name</label>
            <input value={boardName} onChange={(e) => setBoardName(e.target.value)} placeholder="e.g. Summer Bingo 2025" className={inputCls} />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className={labelCls}>Description (optional)</label>
            <input value={boardDesc} onChange={(e) => setBoardDesc(e.target.value)} placeholder="A short description" className={inputCls} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>Dink webhook token (optional)</label>
          <div className="flex gap-2 items-center">
            <input
              value={boardDinkToken}
              onChange={(e) => setBoardDinkToken(e.target.value)}
              placeholder="Leave blank to disable Dink integration"
              className={`${inputCls} flex-1 font-mono`}
            />
            <button type="button" onClick={generateDinkToken} className="text-xs bg-purple-900/50 hover:bg-purple-800/60 border border-purple-700/40 text-purple-300 rounded-lg px-3 py-1.5 transition-colors shrink-0">
              Generate
            </button>
            {boardDinkToken && (
              <button type="button" onClick={() => setBoardDinkToken("")} className="text-xs text-purple-600 hover:text-red-400 transition-colors shrink-0">
                Clear
              </button>
            )}
          </div>
          {boardDinkToken && (
            <p className="text-xs text-purple-600 font-mono break-all">
              Webhook URL: <span className="text-purple-400/80 select-all">/api/webhook/dink?token={boardDinkToken}</span>
            </p>
          )}
          <p className="text-[11px] text-purple-700/60">Players paste this URL into Dink → Webhook URLs. Drops matching tile item IDs auto-approve.</p>
        </div>

        {/* Row / Column completion bonus */}
        <div className="flex flex-col gap-1.5 border-t border-purple-900/30 pt-3">
          <div>
            <label className={labelCls}>Row &amp; Column Completion Bonus</label>
            <p className="text-[11px] text-purple-700/60">
              Awarded when a team completes every tile in a row or column. Bonus tier = lowest-value tier achieved across the line.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className={labelCls}>T1 bonus pts (hardest)</label>
              <input type="number" min={0} step={0.5} value={bonusT1} onChange={(e) => setBonusT1(Number(e.target.value))} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className={labelCls}>T2 bonus pts</label>
              <input type="number" min={0} step={0.5} value={bonusT2} onChange={(e) => setBonusT2(Number(e.target.value))} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className={labelCls}>T3 bonus pts (easiest)</label>
              <input type="number" min={0} step={0.5} value={bonusT3} onChange={(e) => setBonusT3(Number(e.target.value))} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t border-purple-900/30 pt-3">
          <label className={labelCls}>Board size</label>
          <div className="flex gap-2">
            {BOARD_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setBoardSize(n); setSelected(null); }}
                className={`text-xs font-semibold rounded-lg px-3 py-1.5 border transition-colors ${
                  boardSize === n
                    ? "bg-purple-700/60 border-purple-500 text-white"
                    : "bg-[#130a28] border-purple-900/50 text-purple-400 hover:border-purple-700/60"
                }`}
              >
                {n}×{n}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-purple-700/60">
            Shrinking hides tiles outside the new grid (and their points) without deleting them — grow back and they reappear.
          </p>
        </div>

        <div className="flex gap-3 items-start">
          <div className="flex flex-col gap-1 flex-1">
            <label className={labelCls}>Event start (optional)</label>
            <div className="flex gap-2">
              <input type="datetime-local" value={boardStartsAt} onChange={(e) => setBoardStartsAt(e.target.value)} className={`${inputCls} flex-1 [color-scheme:dark]`} />
              {boardStartsAt && <button type="button" onClick={() => setBoardStartsAt("")} className="text-xs text-purple-600 hover:text-red-400 transition-colors">Clear</button>}
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className={labelCls}>Event end (optional)</label>
            <div className="flex gap-2">
              <input type="datetime-local" value={boardEndsAt} onChange={(e) => setBoardEndsAt(e.target.value)} className={`${inputCls} flex-1 [color-scheme:dark]`} />
              {boardEndsAt && <button type="button" onClick={() => setBoardEndsAt("")} className="text-xs text-purple-600 hover:text-red-400 transition-colors">Clear</button>}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-purple-900/30 pt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scaleByTeamSize}
              onChange={(e) => setScaleByTeamSize(e.target.checked)}
              className="accent-purple-600"
            />
            <span className={labelCls}>Scale requirements by team size</span>
          </label>
          <p className="text-[11px] text-purple-700/60">
            Smaller teams need proportionally fewer drops/points to complete a tile, relative to the board&apos;s biggest team (rounded, minimum 1) — the points awarded for completing stay the same regardless of size. Off by default.
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        {/* All 25 tiles, wrapped at the *current* board width — so the
            active boardSize×boardSize square always matches the real
            public board's own row/col wrapping exactly. Cells beyond that
            are greyed out but still draggable/selectable, so hidden tile
            content can be browsed or repositioned without resizing first. */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <p className="text-xs text-purple-500">Drag to reposition · click to edit</p>
          {dndReady ? (
            <DndContext sensors={dndSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className={`grid ${GRID_COLS_CLASS[MAX_SIZE]} gap-1`}>
                {gridLayout.map(({ position, isActive }, visualIndex) => (
                  <TileCell
                    key={visualIndex}
                    pos={position}
                    tile={tiles[position]}
                    isSelected={selected === position}
                    isActive={isActive}
                    onSelect={() => setSelected(position === selected ? null : position)}
                  />
                ))}
              </div>
              <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
                {dragPos !== null && (
                  <div className="w-14 h-14 rounded-lg border-2 border-purple-400 bg-[#1a0f35] shadow-2xl shadow-purple-950/80 flex items-center justify-center p-1 text-center text-xs font-medium text-purple-100 rotate-3 scale-110">
                    <span className="line-clamp-2 leading-tight">{tiles[dragPos].title.trim() || dragPos + 1}</span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          ) : (
            // Static placeholder for the server-rendered/pre-hydration pass —
            // dnd-kit's hooks are skipped entirely here to avoid a hydration
            // mismatch, then swapped for the interactive grid once mounted.
            <div className={`grid ${GRID_COLS_CLASS[MAX_SIZE]} gap-1`}>
              {gridLayout.map(({ position, isActive }, visualIndex) => {
                const t = tiles[position];
                const filled = t.title.trim().length > 0;
                return (
                  <div
                    key={visualIndex}
                    className={`w-14 h-14 rounded-lg border text-xs font-medium flex flex-col items-center justify-center p-1 text-center ${
                      !isActive ? "opacity-35 grayscale" : ""
                    } ${filled ? "border-purple-700/50 bg-[#130a28] text-purple-200" : "border-dashed border-purple-900/50 bg-[#0e0820] text-purple-700"}`}
                  >
                    <span className="line-clamp-2 leading-tight">{filled ? t.title : position + 1}</span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-purple-700/60 max-w-[15rem]">Greyed-out tiles are outside the current board size — hidden from players, not deleted.</p>
        </div>

        {/* Tile editor */}
        <div className="flex-1 min-w-0 bg-[#0e0820] border border-purple-900/40 rounded-xl p-4">
          {selected === null ? (
            <p className="text-purple-600 text-sm">Select a tile on the grid to edit it.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <h3 className="font-semibold text-purple-100 text-sm">Tile {selected + 1}</h3>

              <div className="flex flex-col gap-1">
                <label className={labelCls}>Title</label>
                <input value={selectedTile!.title} onChange={(e) => updateTile(selected, "title", e.target.value)} placeholder="e.g. Araxxor" className={inputCls} />
              </div>

              <div className="flex flex-col gap-1">
                <label className={labelCls}>Description (optional)</label>
                <textarea value={selectedTile!.description} onChange={(e) => updateTile(selected, "description", e.target.value)} rows={2} placeholder="Any extra instructions" className={`${inputCls} resize-y`} />
              </div>

              {/* Scoring mode toggle */}
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Scoring mode</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setScoringMode(selected, "TIERED")}
                    className={`text-xs font-semibold rounded-lg px-3 py-1.5 border transition-colors ${
                      selectedTile!.scoringMode === "TIERED"
                        ? "bg-purple-700/60 border-purple-500 text-white"
                        : "bg-[#130a28] border-purple-900/50 text-purple-400 hover:border-purple-700/60"
                    }`}
                  >
                    Tiered
                  </button>
                  <button
                    type="button"
                    onClick={() => setScoringMode(selected, "POINTS")}
                    className={`text-xs font-semibold rounded-lg px-3 py-1.5 border transition-colors ${
                      selectedTile!.scoringMode === "POINTS"
                        ? "bg-emerald-700/60 border-emerald-500 text-white"
                        : "bg-[#130a28] border-purple-900/50 text-purple-400 hover:border-purple-700/60"
                    }`}
                  >
                    Points
                  </button>
                </div>
                <p className="text-[11px] text-purple-700/60">
                  {selectedTile!.scoringMode === "TIERED"
                    ? "Get a specific set of items to fill each tier."
                    : "Unlimited drops toward a point target — duplicates of the same item are worth less each time."}
                </p>
              </div>

              {selectedTile!.scoringMode === "POINTS" ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-end gap-2">
                    <div className="flex flex-col gap-1 w-32 shrink-0">
                      <label className={labelCls}>Target points (optional)</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="Unlimited"
                        value={selectedTile!.pointsTargetText}
                        onChange={(e) => setPointsTarget(selected, e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    {selectedTile!.pointsTargetText && (
                      <button type="button" onClick={() => setPointsTarget(selected, "")} className="text-xs text-purple-600 hover:text-red-400 transition-colors pb-2">
                        Clear
                      </button>
                    )}
                    <p className="text-[11px] text-purple-700/60 pb-2">
                      {selectedTile!.pointsTargetText.trim()
                        ? "Total points a team needs to complete this tile."
                        : "No target — points are unlimited. The tile completes once a team has received at least 1 of every item below."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Items (id, base points, name)</label>
                    <textarea
                      value={selectedTile!.pointsItemsText}
                      onChange={(e) => updateTile(selected, "pointsItemsText", e.target.value)}
                      rows={6}
                      placeholder={"11832 30 Bandos chestplate\n11834 30 Bandos tassets"}
                      className={`${inputCls} font-mono resize-y text-xs`}
                    />
                  </div>
                  <p className="text-[10px] text-purple-700/60">
                    One item per line as <span className="font-mono text-purple-600">itemId basePoints item name</span>. Each duplicate drop of the same item is worth half the last, twice, then stays flat at 25% of its base value — so mixing items completes the tile fastest.
                  </p>
                </div>
              ) : (
              <div className="flex flex-col gap-1.5">
                <p className={labelCls}>Tiers — add Dink items to activate a tier</p>
                {(["t3", "t2", "t1"] as const).map((tierKey) => {
                  const meta = TIER_META[tierKey];
                  const ts = selectedTile![tierKey];
                  const hasItems = ts.dinkItemsText.trim().length > 0;
                  return (
                    <div
                      key={tierKey}
                      className={`border rounded-lg p-2.5 flex flex-col gap-2 transition-colors ${
                        hasItems ? "border-purple-700/50 bg-[#130a28]/60" : "border-purple-900/30 bg-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${hasItems ? "text-purple-200" : "text-purple-700"}`}>
                          {meta.label}
                        </span>
                        {meta.hint && (
                          <span className="text-[10px] text-purple-700/70">{meta.hint}</span>
                        )}
                        {hasItems && (
                          <span className="ml-auto text-[10px] text-purple-400">
                            {ts.requiredCount}× · {+ts.points.toFixed(1)} pts
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className={labelCls}>Description (optional)</label>
                        <textarea
                          value={ts.description}
                          onChange={(e) => updateTier(selected, tierKey, "description", e.target.value)}
                          rows={1}
                          placeholder="What specifically this tier requires"
                          className={`${inputCls} resize-y`}
                        />
                      </div>
                      <div className="flex gap-2 items-start">
                        <div className="flex flex-col gap-1 w-20 shrink-0">
                          <label className={labelCls}>Points</label>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={ts.points}
                            onChange={(e) => updateTier(selected, tierKey, "points", Number(e.target.value))}
                            className={inputCls}
                          />
                        </div>
                        <div className="flex flex-col gap-1 w-20 shrink-0">
                          <label className={labelCls}>Required</label>
                          <input
                            type="number"
                            min={1}
                            value={ts.requiredCount}
                            onChange={(e) => updateTier(selected, tierKey, "requiredCount", Number(e.target.value))}
                            className={inputCls}
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <label className={labelCls}>Dink item IDs</label>
                          <textarea
                            value={ts.dinkItemsText}
                            onChange={(e) => updateTier(selected, tierKey, "dinkItemsText", e.target.value)}
                            rows={5}
                            placeholder={"4151 Abyssal whip\n12073 Twisted bow"}
                            className={`${inputCls} font-mono resize-y text-xs`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-purple-700/60">Item IDs: one per line as <span className="font-mono text-purple-600">itemId item name</span>. Leave all blank to skip a tier.</p>
              </div>
              )}

              {/* Image */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Tile image (optional)</label>
                {cropSrc?.pos === selected ? (
                  <ImageCropper imageSrc={cropSrc.src} onDone={onCropDone} onCancel={onCropCancel} />
                ) : (
                  <>
                    {selectedTile!.imageUrl && (
                      <div className="relative w-full max-w-[200px] aspect-square rounded-lg overflow-hidden bg-[#130a28]">
                        <Image src={selectedTile!.imageUrl} alt="Tile" fill sizes="400px" className="object-cover" />
                        <button
                          type="button"
                          onClick={async () => {
                            const existingId = board?.tiles.find((t) => t.position === selected)?.id;
                            if (existingId) await fetch("/api/admin/tiles/image", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tileId: existingId }) });
                            setTiles((prev) => ({ ...prev, [selected]: { ...prev[selected], imageUrl: null } }));
                          }}
                          className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white text-xs rounded px-2 py-0.5 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <label className={`flex items-center justify-center gap-2 border-2 border-dashed border-purple-900/50 hover:border-purple-700/60 rounded-lg py-2 text-sm text-purple-500 cursor-pointer transition-colors ${imageUploading ? "opacity-50 pointer-events-none" : ""}`}>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(selected, f); e.target.value = ""; }} />
                      {imageUploading ? "Uploading…" : selectedTile!.imageUrl ? "Replace image" : "Upload image"}
                    </label>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={saveBoard}
        disabled={saving || !boardName.trim()}
        className="self-start bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold rounded-lg px-5 py-2 transition-colors purple-glow-sm"
      >
        {saving ? "Saving…" : board ? "Save changes" : "Create board"}
      </button>
    </div>
  );
}
