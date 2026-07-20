"use client";

import { useRef, useState } from "react";

type Point = { label: string; hours: number };

// viewBox geometry (responsive via width:100%)
const W = 600;
const H = 150;
const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

export function StudyTrend({ data }: { data: Point[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const total = data.reduce((s, d) => s + d.hours, 0);
  const max = Math.max(1, ...data.map((d) => d.hours));
  const avg = data.length ? total / data.length : 0;

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex h-[150px] items-center justify-center rounded-lg bg-surface-2 text-sm text-muted">
        Sem horas registradas ainda. Estude uma sessão para ver a tendência.
      </div>
    );
  }

  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) =>
    data.length === 1 ? W / 2 : PAD_X + (i / (data.length - 1)) * innerW;
  const y = (h: number) => PAD_TOP + innerH - (h / max) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.hours)}`).join(" ");
  const areaPath = `${linePath} L ${x(data.length - 1)} ${PAD_TOP + innerH} L ${x(0)} ${PAD_TOP + innerH} Z`;

  // sparse x labels (~4)
  const step = Math.max(1, Math.ceil(data.length / 4));

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < data.length; i++) {
      const d = Math.abs(x(i) - px);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHover(nearest);
  }

  const hoverPct = hover !== null ? (x(hover) / W) * 100 : 0;

  return (
    <div
      ref={ref}
      className="relative motion-safe:animate-[fadeIn_.4s_ease-out]"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Horas de estudo por semana nas últimas ${data.length} semanas. Média de ${avg.toFixed(1).replace(".", ",")} horas por semana.`}
        className="block"
        preserveAspectRatio="none"
      >
        <path d={areaPath} fill="var(--faculdade)" opacity={0.12} />
        <path
          d={linePath}
          fill="none"
          stroke="var(--faculdade)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {hover !== null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD_TOP}
              y2={PAD_TOP + innerH}
              stroke="var(--muted)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={x(hover)} cy={y(data[hover].hours)} r={3.5} fill="var(--faculdade)" />
          </>
        )}
        {data.map((d, i) =>
          i % step === 0 || i === data.length - 1 ? (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              className="fill-[var(--faint)] text-[10px]"
            >
              {d.label}
            </text>
          ) : null,
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs shadow-sm"
          style={{ left: `${hoverPct}%`, top: -6 }}
        >
          <span className="font-medium tabular-nums">
            {data[hover].hours.toLocaleString("pt-BR")}h
          </span>
          <span className="ml-1 text-muted">· {data[hover].label}</span>
        </div>
      )}
    </div>
  );
}
