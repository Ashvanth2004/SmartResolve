"use client";

/** Lightweight dependency-free SVG charts — always rendered from real data. */

export type ChartDatum = { label: string; value: number; color?: string };

const PALETTE = [
  "#e5383b", "#b91c1c", "#7f1d1d", "#fbbf24", "#ef4444", "#1a1a1a",
  "#fda4af", "#ef4444", "#f97316", "#78716c",
];

export function BarChart({ data, height = 180, unit }: { data: ChartDatum[]; height?: number; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
            <span className="text-[10px] text-muted font-medium group-hover:text-red-500 group-hover:scale-110 transition-all">{d.value}{unit}</span>
            <div
              className="w-full rounded-t-md ai-bar group-hover:brightness-110 group-hover:scale-y-[1.02] transition-all duration-200 origin-bottom"
              style={{ height: `${Math.max(3, (d.value / max) * (height - 30))}px`, background: d.color || PALETTE[i % PALETTE.length], animationDelay: `${i * 0.06}s` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-muted truncate">{d.label}</div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ data, size = 190, centerLabel } : { data: ChartDatum[]; size?: number; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let offset = 0;
  const segments = data.map((d, i) => {
    const frac = d.value / total;
    const seg = { ...d, frac, start: offset };
    offset += frac;
    return seg;
  });
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e8cfcf" strokeWidth="12" />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={s.color || PALETTE[i % PALETTE.length]}
            strokeWidth="12"
            strokeDasharray={`${(s.frac * c).toFixed(1)} ${c.toFixed(1)}`}
            strokeDashoffset={`${(-1 * s.start * c).toFixed(1)}`}
          />
        ))}
      </svg>
      <div className="flex flex-col items-center" style={{ marginTop: -(size / 2) + 8 }}>
        <span className="text-2xl font-bold text-foreground">{centerLabel || total}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted">total</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color || PALETTE[i % PALETTE.length] }} />
            <span className="text-muted">{s.label} ({s.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ data, height = 170 } : { data: ChartDatum[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 420;
  const h = height;
  const points = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * (w - 20) + 10;
    const y = h - 18 - (d.value / max) * (h - 36);
    return { ...d, x, y };
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-[420px] w-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="10" x2={w - 10} y1={(h - 18) * (1 - f) + 8} y2={(h - 18) * (1 - f) + 8} stroke="currentColor" strokeDasharray="4 4" />
        ))}
        <path d={path} fill="none" stroke="#e5383b" strokeWidth="2.5" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#e5383b" />
            {data.length <= 16 && <text x={p.x} y={h - 4} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.6">{p.label}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

const TONES = { indigo: "bg-red-600", emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };

export function ProgressBar({ value, tone = "indigo", label } : { value: number; tone?: "indigo" | "emerald" | "amber" | "red"; label?: string }) {
  return (
    <div className="group">
      {label && <div className="flex justify-between text-xs text-muted mb-1 group-hover:text-foreground transition-colors"><span>{label}</span><span className="tabular-nums">{Math.round(value)}%</span></div>}
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden progress-shimmer">
        <div className={`h-full rounded-full ${TONES[tone]} transition-[width] duration-700 ease-out group-hover:brightness-110`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}
