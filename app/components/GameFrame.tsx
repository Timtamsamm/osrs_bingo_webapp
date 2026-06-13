import type { ReactNode } from "react";

export default function GameFrame({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      <div
        className="relative"
        style={{ width: "min(100vw, 150vh)", aspectRatio: "3 / 2" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/BingoBG2.png"
          alt=""
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          draggable={false}
        />
        <div
          className="absolute overflow-y-auto text-white"
          style={{ top: "13%", left: "5%", right: "5%", bottom: "4%" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
