"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";

interface Props {
  imageSrc: string;
  aspect?: number;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}

const MAX_SIZE = 1024;

async function getCroppedBlob(
  imageSrc: string,
  croppedArea: Area,
  flipH: boolean,
  flipV: boolean,
  rotation: number,
  aspect: number
): Promise<Blob> {
  const img = await createImageBitmap(await fetch(imageSrc).then((r) => r.blob()));

  // Output width is fixed at MAX_SIZE; height follows the requested aspect ratio
  const outW = MAX_SIZE;
  const outH = Math.round(MAX_SIZE / aspect);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;

  // Fill background (covers any letterbox area when zoomed out past image edge)
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, outW, outH);

  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);
  if (flipH) ctx.scale(-1, 1);
  if (flipV) ctx.scale(1, -1);

  // Clamp source rect to actual image bounds to avoid drawing outside
  const srcX = Math.max(0, croppedArea.x);
  const srcY = Math.max(0, croppedArea.y);
  const srcRight = Math.min(img.width, croppedArea.x + croppedArea.width);
  const srcBottom = Math.min(img.height, croppedArea.y + croppedArea.height);
  const srcW = srcRight - srcX;
  const srcH = srcBottom - srcY;

  // Map the clamped source region into its correct position within the output rect
  const scale = outW / croppedArea.width;
  const dstX = (srcX - croppedArea.x) * scale - outW / 2;
  const dstY = (srcY - croppedArea.y) * scale - outH / 2;
  const dstW = srcW * scale;
  const dstH = srcH * scale;

  if (srcW > 0 && srcH > 0) {
    ctx.drawImage(img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
  }
  ctx.restore();

  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
}

export default function ImageCropper({ imageSrc, aspect = 1, onDone, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.8);
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
    const blob = await getCroppedBlob(imageSrc, croppedArea, flipH, flipV, rotation, aspect);
    onDone(blob);
  }

  const toggleBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      active ? "bg-amber-500 text-gray-950" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full rounded-lg overflow-hidden bg-gray-950" style={{ height: 360 }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          minZoom={0.2}
          maxZoom={6}
          restrictPosition={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 w-12 shrink-0">Zoom</span>
        <input
          type="range" min={0.2} max={6} step={0.05}
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
