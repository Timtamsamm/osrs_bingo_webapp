"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { useRouter } from "next/navigation";

interface Props {
  tileId: string;
  userId: string;
}

async function getCroppedBlob(
  imageSrc: string,
  croppedArea: Area
): Promise<Blob> {
  const img = await createImageBitmap(
    await fetch(imageSrc).then((r) => r.blob())
  );
  const canvas = document.createElement("canvas");
  canvas.width = croppedArea.width;
  canvas.height = croppedArea.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    img,
    croppedArea.x,
    croppedArea.y,
    croppedArea.width,
    croppedArea.height,
    0,
    0,
    croppedArea.width,
    croppedArea.height
  );
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
}

export default function SubmitForm({ tileId, userId }: Props) {
  const router = useRouter();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageSrc(url);
  }

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageSrc || !croppedArea) return;
    setSubmitting(true);
    setError("");

    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      const formData = new FormData();
      formData.append("file", blob, "submission.jpg");
      formData.append("tileId", tileId);
      formData.append("userId", userId);
      formData.append("note", note);

      const res = await fetch("/api/submit", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());

      router.push("/board");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <label className="block text-sm text-gray-400 mb-2">
          Screenshot
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFile}
          required
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-500 file:text-gray-950 file:font-semibold hover:file:bg-amber-400 cursor-pointer"
        />
      </div>

      {imageSrc && (
        <div className="relative w-full h-72 bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={16 / 9}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
      )}

      {imageSrc && (
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="accent-amber-500"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-400" htmlFor="note">
          Note <span className="text-gray-600">(optional)</span>
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Any context for the reviewer…"
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={!imageSrc || submitting}
        className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg py-2 transition-colors"
      >
        {submitting ? "Uploading…" : "Submit"}
      </button>
    </form>
  );
}
