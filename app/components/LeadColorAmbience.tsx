"use client";

import { useEffect } from "react";

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round((h / 6) * 360 + 360) % 360;
}

export default function LeadColorAmbience({ color }: { color: string }) {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const h = hexToHue(color);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", `${r} ${g} ${b}`);
    root.style.setProperty("--accent-h", String(h));
    return () => {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-h");
    };
  }, [r, g, b, h]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999]"
      style={{
        background: `radial-gradient(ellipse 160% 120% at 50% 0%, rgba(${r},${g},${b},0.15) 0%, rgba(${r},${g},${b},0.05) 60%, transparent 100%)`,
        mixBlendMode: "screen",
      }}
    />
  );
}
