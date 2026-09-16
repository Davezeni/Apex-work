'use client';

import { useState } from 'react';

export interface SeriesPoint {
  day: string;
  count: number;
  value?: number;
}

export interface TrendMetric {
  key: string;
  label: string;
  color: string;
  format: (v: number) => string;
  series: SeriesPoint[];
  /** use `value` rather than `count` for the plot (money metrics). */
  useValue?: boolean;
}

const W = 640;
const H = 180;
const PAD = { top: 12, right: 8, bottom: 22, left: 34 };

function maxOf(points: SeriesPoint[], useValue?: boolean): number {
  let m = 0;
  for (const p of points) {
    const v = Number(useValue ? (p.value ?? 0) : p.count);
    if (v > m) m = v;
  }
  return m;
}

/**
 * Hand-rolled SVG time-series line chart (no chart library → stays free/OSS
 * and tiny). Renders a filled gradient area plus a line, with a hover
 * tooltip. `0` values still render a dot so the series never looks broken.
 */
export function TrendChart({
  metric,
  days,
  onDaysChange,
}: {
  metric: TrendMetric;
  days: number;
  onDaysChange: (d: number) => void;
}) {
  const { series, useValue } = metric;
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(4, maxOf(series, useValue)) * 1.15;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = series.length;

  const x = (i: number) => PAD.left + (n <= 1 ? innerW : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const points = series.map((p, i) => ({
    i,
    x: x(i),
    y: y(Number(useValue ? (p.value ?? 0) : p.count)),
    p,
  }));

  const line = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(' ');
  const area = points.length
    ? `${line} L${points[points.length - 1]!.x.toFixed(1)},${PAD.top + innerH} L${points[0]!.x.toFixed(1)},${PAD.top + innerH} Z`
    : '';

  const grid = [0.25, 0.5, 0.75, 1].map((f) => {
    const gy = PAD.top + innerH - f * innerH;
    return { gy, val: max * f };
  });

  const labelEvery = Math.max(1, Math.ceil(n / 7));
  const active = hover !== null ? (points.find((pt) => pt.i === hover) ?? null) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {metric.label}
          </span>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${days === d ? 'bg-primary text-white' : 'border border-border text-muted-foreground'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${metric.label} trend chart`}
      >
        {grid.map((g) => (
          <g key={g.gy}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={g.gy}
              y2={g.gy}
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            <text
              x={PAD.left - 6}
              y={g.gy + 3}
              textAnchor="end"
              fontSize={9}
              className="fill-muted-foreground"
            >
              {metric.format(g.val)}
            </text>
          </g>
        ))}
        {area && <path d={area} fill={metric.color} opacity={0.12} />}
        {line && (
          <path
            d={line}
            fill="none"
            stroke={metric.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((pt) => (
          <circle
            key={pt.i}
            cx={pt.x}
            cy={pt.y}
            r={hover === pt.i ? 4 : 2.5}
            fill={pt.p.day ? metric.color : metric.color}
            className="cursor-pointer"
            onMouseEnter={() => setHover(pt.i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        {series.map((p, i) =>
          i % labelEvery === 0 ? (
            <text
              key={p.day}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize={9}
              className="fill-muted-foreground"
            >
              {p.day.slice(5)}
            </text>
          ) : null,
        )}
        {active && (
          <g>
            <line
              x1={active.x}
              x2={active.x}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke={metric.color}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <g>
              <rect
                x={Math.min(Math.max(active.x - 52, 2), W - 106)}
                y={Math.max(0, active.y - 34)}
                width={104}
                height={28}
                rx={6}
                className="fill-card"
                stroke="currentColor"
                strokeWidth={0.75}
              />
              <text
                x={Math.min(Math.max(active.x, 54), W - 54)}
                y={active.y - 14}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                className="fill-foreground"
              >
                {metric.format(Number(useValue ? (active.p.value ?? 0) : active.p.count))}
              </text>
              <text
                x={Math.min(Math.max(active.x, 54), W - 54)}
                y={active.y - 3}
                textAnchor="middle"
                fontSize={8}
                className="fill-muted-foreground"
              >
                {active.p.day}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
