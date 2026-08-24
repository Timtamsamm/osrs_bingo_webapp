"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import TileImageCropper from "./TileImageCropper";

interface Tile {
  id: string;
  position: number;
  title: string;
  description: string | null;
  pointsPerSubmission: number;
  requiredCount: number;
  imageUrl: string | null;
  dinkItems: Array<{ id: number; name: string }>;
}

interface Board {
  id: string;
  name: string;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  maxTeamSize: number;
  passcode: string | null;
  dinkToken: string | null;
  tiles: Tile[];
}

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

function dinkItemsToText(items: Array<{ id: number; name: string }>): string {
  return items.map((i) => `${i.id} ${i.name}`).join("\n");
}

function toDatetimeLocal(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

interface Props {
  board: Board | null;
}

const EMPTY_TILE = { title: "", description: "", pointsPerSubmission: 1, requiredCount: 1, imageUrl: null as string | null, dinkItemsText: "" };

export default function BoardEditor({ board }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [boardName, setBoardName] = useState(board?.name ?? "");
  const [boardDesc, setBoardDesc] = useState(board?.description ?? "");
  const [boardStartsAt, setBoardStartsAt] = useState(toDatetimeLocal(board?.startsAt ?? null));
  const [boardEndsAt, setBoardEndsAt] = useState(toDatetimeLocal(board?.endsAt ?? null));
  const [boardMaxTeamSize, setBoardMaxTeamSize] = useState(board?.maxTeamSize ?? 10);
  const [boardPasscode, setBoardPasscode] = useState(board?.passcode ?? "");
  const [boardDinkToken, setBoardDinkToken] = useState(board?.dinkToken ?? "");

  const generateDinkToken = useCallback(() => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(18)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setBoardDinkToken(token);
  }, []);

  const [tiles, setTiles] = useState<Record<number, typeof EMPTY_TILE>>(() => {
    const map: Record<number, typeof EMPTY_TILE> = {};
    for (let i = 0; i < 25; i++) {
      const t = board?.tiles.find((t) => t.position === i);
      map[i] = t
        ? {
            title: t.title,
            description: t.description ?? "",
            pointsPerSubmission: t.pointsPerSubmission ?? 1,
            requiredCount: t.requiredCount,
            imageUrl: t.imageUrl ?? null,
            dinkItemsText: dinkItemsToText(t.dinkItems ?? []),
          }
        : { ...EMPTY_TILE };
    }
    return map;
  });

  const [selected, setSelected] = useState<number | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<{ pos: number; src: string } | null>(null);

  function updateTile(pos: number, field: string, value: string | number | boolean | null) {
    setTiles((prev) => ({ ...prev, [pos]: { ...prev[pos], [field]: value } }));
  }

  function onFileSelected(pos: number, file: File) {
    const src = URL.createObjectURL(file);
    setCropSrc({ pos, src });
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
      updateTile(pos, "imageUrl", url);
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
        Object.entries(tiles).map(([pos, t]) => [
          pos,
          { ...t, dinkItems: parseDinkItems(t.dinkItemsText) },
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
          maxTeamSize: boardMaxTeamSize,
          passcode: boardPasscode,
          dinkToken: boardDinkToken,
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
    <div className="flex flex-col gap-8">
      {/* Board meta */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-gray-200">Board Details</h2>
        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs text-gray-400">Name</label>
            <input
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="e.g. Summer Bingo 2025"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs text-gray-400">Description (optional)</label>
            <input
              value={boardDesc}
              onChange={(e) => setBoardDesc(e.target.value)}
              placeholder="A short description"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Event passcode (optional)</label>
          <div className="flex gap-2 items-center">
            <input
              value={boardPasscode}
              onChange={(e) => setBoardPasscode(e.target.value)}
              placeholder="Leave blank to disable the passcode gate"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
            />
            {boardPasscode && (
              <button type="button" onClick={() => setBoardPasscode("")} className="text-xs text-gray-500 hover:text-red-400 transition-colors shrink-0">
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-gray-600">Players must enter this once after login. Changing it invalidates all existing verifications.</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Dink webhook token (optional)</label>
          <div className="flex gap-2 items-center">
            <input
              value={boardDinkToken}
              onChange={(e) => setBoardDinkToken(e.target.value)}
              placeholder="Leave blank to disable Dink integration"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
            />
            <button type="button" onClick={generateDinkToken} className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg px-3 py-2 transition-colors shrink-0">
              Generate
            </button>
            {boardDinkToken && (
              <button type="button" onClick={() => setBoardDinkToken("")} className="text-xs text-gray-500 hover:text-red-400 transition-colors shrink-0">
                Clear
              </button>
            )}
          </div>
          {boardDinkToken && (
            <p className="text-xs text-gray-500 font-mono break-all mt-1">
              Webhook URL: <span className="text-amber-400/80 select-all">/api/webhook/dink?token={boardDinkToken}</span>
            </p>
          )}
          <p className="text-xs text-gray-600">Players paste this URL into Dink → Webhook URLs. Drops matching tile item IDs auto-approve.</p>
        </div>

        <div className="flex gap-4 items-start">
          <div className="flex flex-col gap-1 w-32 shrink-0">
            <label className="text-xs text-gray-400">Max team size</label>
            <input
              type="number"
              min={1}
              max={20}
              value={boardMaxTeamSize}
              onChange={(e) => setBoardMaxTeamSize(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-gray-400">Event start date &amp; time (optional)</label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={boardStartsAt}
                onChange={(e) => setBoardStartsAt(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 [color-scheme:dark]"
              />
              {boardStartsAt && (
                <button type="button" onClick={() => setBoardStartsAt("")} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-gray-400">Event end date &amp; time (optional)</label>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={boardEndsAt}
                onChange={(e) => setBoardEndsAt(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 [color-scheme:dark]"
              />
              {boardEndsAt && (
                <button type="button" onClick={() => setBoardEndsAt("")} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* 5×5 grid */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 mb-1">Click a tile to edit it</p>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 25 }, (_, i) => {
              const t = tiles[i];
              const filled = t.title.trim().length > 0;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(i === selected ? null : i)}
                  className={`
                    w-16 h-16 rounded-lg border text-xs font-medium flex flex-col items-center justify-center p-1 text-center transition-all
                    ${selected === i ? "border-amber-500 bg-amber-500/10 text-amber-300" :
                      filled ? "border-gray-600 bg-gray-800 text-gray-200" :
                      "border-dashed border-gray-700 bg-gray-900 text-gray-600"}
                  `}
                >
                  <span className="line-clamp-2 leading-tight">
                    {filled ? t.title : i + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tile editor */}
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-5">
          {selected === null ? (
            <p className="text-gray-500 text-sm">Select a tile on the grid to edit it.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <h3 className="font-semibold text-gray-200">Tile {selected + 1}</h3>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Title</label>
                <input
                  value={selectedTile!.title}
                  onChange={(e) => updateTile(selected, "title", e.target.value)}
                  placeholder="e.g. Kill Zulrah"
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Description (optional)</label>
                <textarea
                  value={selectedTile!.description}
                  onChange={(e) => updateTile(selected, "description", e.target.value)}
                  rows={2}
                  placeholder="Any extra instructions for the player"
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-gray-400">Required submissions</label>
                  <input
                    type="number"
                    min={1}
                    value={selectedTile!.requiredCount}
                    onChange={(e) => updateTile(selected, "requiredCount", Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs text-gray-400">Points per submission</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={selectedTile!.pointsPerSubmission ?? 1}
                    onChange={(e) => updateTile(selected, "pointsPerSubmission", Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Total points:{" "}
                <span className="text-amber-400 font-medium">
                  {+((selectedTile!.requiredCount || 1) * (selectedTile!.pointsPerSubmission || 1)).toFixed(2)}
                </span>
              </p>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Dink item IDs (optional)</label>
                <textarea
                  value={selectedTile!.dinkItemsText}
                  onChange={(e) => updateTile(selected, "dinkItemsText", e.target.value)}
                  rows={3}
                  placeholder={"4151 Abyssal whip\n12073 Twisted bow"}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
                <p className="text-xs text-gray-600">One item per line: <span className="font-mono text-gray-500">itemId item name</span>. Dink auto-claims when a player loots a matching item.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400">Tile image (optional)</label>

                {cropSrc?.pos === selected ? (
                  <TileImageCropper
                    imageSrc={cropSrc.src}
                    onDone={onCropDone}
                    onCancel={onCropCancel}
                  />
                ) : (
                  <>
                    {selectedTile!.imageUrl && (
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-800">
                        <Image src={selectedTile!.imageUrl} alt="Tile" fill sizes="400px" className="object-cover" />
                        <button
                          type="button"
                          onClick={async () => {
                            const existingId = board?.tiles.find((t) => t.position === selected)?.id;
                            if (existingId) {
                              await fetch("/api/admin/tiles/image", {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ tileId: existingId }),
                              });
                            }
                            updateTile(selected, "imageUrl", null);
                          }}
                          className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white text-xs rounded px-2 py-0.5 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <label className={`flex items-center justify-center gap-2 border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-lg py-3 text-sm text-gray-400 cursor-pointer transition-colors ${imageUploading ? "opacity-50 pointer-events-none" : ""}`}>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onFileSelected(selected, file);
                          e.target.value = "";
                        }}
                      />
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
        className="self-start bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg px-6 py-2.5 transition-colors"
      >
        {saving ? "Saving…" : board ? "Save changes" : "Create board"}
      </button>
    </div>
  );
}
