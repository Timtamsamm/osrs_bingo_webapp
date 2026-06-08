"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";

interface Props {
  imageSrc: string;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}

const MAX_SIZE = 1024;

async function getCroppedBlob(
  imageSrc: string,
  croppedArea: Area,
  flipH: boolean,
  flipV: boolean,
  rotation: number
): Promise<Blob> {
  const img = await createImageBitmap(await fetch(imageSrc).then((r) => r.blob()));

  const srcW = croppedArea.width;
  const srcH = croppedArea.height;
  const scale = Math.max(srcW, srcH) > MAX_SIZE ? MAX_SIZE / Math.max(srcW, srcH) : 1;
  const outW = Math.round(srcW * scale);
  const outH = Math.round(srcH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;

  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);
  if (flipH) ctx.scale(-1, 1);
  if (flipV) ctx.scale(1, -1);
  ctx.drawImage(
    img,
    croppedArea.x, croppedArea.y, srcW, srcH,
    -outW / 2, -outH / 2, outW, outH
  );
  ctx.restore();

  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
}

export default function TileImageCropper({ imageSrc, onDone, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  async function handleDone() {
    if (!croppedArea) return;
    setProcessing(true);
    const blob = await getCroppedBlob(imageSrc, croppedArea, flipH, flipV, rotation);
    onDone(blob);
  }

  const toggleBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      active ? "bg-amber-500 text-gray-950" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full rounded-lg overflow-hidden bg-gray-950" style={{ height: 240 }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 w-12 shrink-0">Zoom</span>
        <input
          type="range" min={1} max={3} step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-amber-500"
        />
        <span className="text-xs text-gray-500 w-8 text-right">{zoom.toFixed(1)}×</span>
      </div>

      {/* Rotation */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 w-12 shrink-0">Rotate</span>
        <input
          type="range" min={-180} max={180} step={1}
          value={rotation}
          onChange={(e) => setRotation(Number(e.target.value))}
          className="flex-1 accent-amber-500"
        />
        <span className="text-xs text-gray-500 w-8 text-right">{rotation}°</span>
      </div>

      {/* Flip */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-12 shrink-0">Flip</span>
        <button type="button" onClick={() => setFlipH((v) => !v)} className={toggleBtn(flipH)}>
          Horizontal
        </button>
        <button type="button" onClick={() => setFlipV((v) => !v)} className={toggleBtn(flipV)}>
          Vertical
        </button>
        {(flipH || flipV) && (
          <span className="text-xs text-amber-400 ml-1">applied on upload</span>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleDone}
          disabled={processing}
          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg py-2 text-sm transition-colors"
        >
          {processing ? "Uploading…" : "Apply & Upload"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="px-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 font-semibold rounded-lg py-2 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
