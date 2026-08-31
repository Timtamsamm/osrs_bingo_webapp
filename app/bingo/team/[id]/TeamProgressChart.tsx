"use client";

import { useMemo, useRef, useState } from "react";

interface Point {
  date: string;
  cumulative: number;
}

interface Props {
  points: Point[];
  color: string;
}

const WIDTH = 800;
const HEIGHT = 220;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

export default function TeamProgressChart({ points, color }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { xScale, yScale, path, areaPath, maxY, minDate, maxDate } = useMemo(() => {
    const dates = points.map((p) => new Date(p.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const maxY = Math.max(...points.map((p) => p.cumulative), 1) * 1.1;

    const xSpan = Math.max(maxDate - minDate, 1);
    const xScale = (t: number) => PAD_LEFT + ((t - minDate) / xSpan) * (WIDTH - PAD_LEFT - PAD_RIGHT);
    const yScale = (v: number) => HEIGHT - PAD_BOTTOM - (v / maxY) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

    const coords = points.map((p) => [xScale(new Date(p.date).getTime()), yScale(p.cumulative)] as const);
    const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const areaPath = `${path} L${coords[coords.length - 1][0].toFixed(1)},${(HEIGHT - PAD_BOTTOM).toFixed(1)} L${coords[0][0].toFixed(1)},${(HEIGHT - PAD_BOTTOM).toFixed(1)} Z`;

    return { xScale, yScale, path, areaPath, maxY, minDate, maxDate };
  }, [points]);

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const targetT = minDate + ((relX - PAD_LEFT) / (WIDTH - PAD_LEFT - PAD_RIGHT)) * (maxDate - minDate);

    let closest = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(new Date(p.date).getTime() - targetT);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setHoverIdx(closest);
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => maxY * f);
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;
  const hoverX = hovered ? xScale(new Date(hovered.date).getTime()) : 0;
  const hoverY = hovered ? yScale(hovered.cumulative) : 0;

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto touch-none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIdx(null)}
      >
        {gridLines.map((v, i) => (
          <g key={i}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={yScale(v)} y2={yScale(v)} stroke="currentColor" className="text-purple-900/40" strokeWidth={1} />
            <text x={PAD_LEFT - 8} y={yScale(v)} textAnchor="end" dominantBaseline="middle" className="fill-purple-700 text-[10px]">
              {Math.round(v)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={color} fillOpacity={0.12} stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {points.length > 0 && (
          <circle
            cx={xScale(new Date(points[points.length - 1].date).getTime())}
            cy={yScale(points[points.length - 1].cumulative)}
            r={4}
            fill={color}
            className="drop-shadow"
          />
        )}

        {hovered && (
          <>
            <line x1={hoverX} x2={hoverX} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} stroke="currentColor" className="text-purple-500/50" strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={hoverX} cy={hoverY} r={4} fill={color} stroke="white" strokeWidth={1.5} />
          </>
        )}

        <text x={PAD_LEFT} y={HEIGHT - 8} className="fill-purple-700 text-[10px]">
          {new Date(minDate).toLocaleDateString()}
        </text>
        <text x={WIDTH - PAD_RIGHT} y={HEIGHT - 8} textAnchor="end" className="fill-purple-700 text-[10px]">
          {new Date(maxDate).toLocaleDateString()}
        </text>
      </svg>

      {hovered && (
        <div
          className="absolute bg-[#1a0f33] border border-purple-700/50 rounded-lg px-3 py-1.5 pointer-events-none text-xs shadow-lg -translate-x-1/2"
          style={{ left: `${(hoverX / WIDTH) * 100}%`, top: `${Math.max((hoverY / HEIGHT) * 100 - 14, 0)}%` }}
        >
          <p className="text-purple-300 whitespace-nowrap">{new Date(hovered.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
          <p className="font-semibold tabular-nums" style={{ color }}>{+hovered.cumulative.toFixed(1)} pts</p>
        </div>
      )}
    </div>
  );
}
