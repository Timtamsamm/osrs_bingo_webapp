"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface Props {
  src: string;
  alt?: string;
  className?: string;
}

/** A small thumbnail that opens a full-size lightbox on click. */
export default function ZoomableThumbnail({ src, alt = "", className }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`relative shrink-0 cursor-zoom-in ${className ?? "w-10 h-10 rounded overflow-hidden bg-black/30"}`}
        aria-label="Enlarge image"
      >
        <Image src={src} alt={alt} fill sizes="40px" className="object-cover" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
        >
          <img src={src} alt={alt} className="max-w-full max-h-full rounded-lg object-contain" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
