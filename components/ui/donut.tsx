import { cn } from "@/lib/utils";

export interface AllocationDonutSegment {
  label: string;
  value: number;
}

export const DONUT_COLORS = [
  "#34d399",
  "#22d3ee",
  "#a3e635",
  "#fbbf24",
  "#f472b6",
  "#818cf8",
  "#fb7185",
  "#38bdf8",
  "#c084fc",
  "#f97316",
];

export function donutColor(index: number): string {
  return DONUT_COLORS[index % DONUT_COLORS.length];
}

export function AllocationDonut({
  segments,
  size = 176,
  centerValue,
  centerLabel = "total",
}: {
  segments: AllocationDonutSegment[];
  size?: number;
  centerValue: string;
  centerLabel?: string;
}) {
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  const radius = 54;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;

  const arcs = visible.reduce<
    { key: string; color: string; dash: number; offset: number }[]
  >((acc, s, i) => {
    const frac = total > 0 ? s.value / total : 0;
    const dash = frac * circumference;
    const previous = acc[acc.length - 1];
    const offset = previous ? previous.offset - previous.dash : 0;
    acc.push({ key: `${s.label}-${i}`, color: donutColor(i), dash, offset });
    return acc;
  }, []);

  return (
    <div className="relative inline-grid place-items-center">
      <svg width={size} height={size} viewBox="0 0 128 128" className="-rotate-90" aria-hidden>
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="rgb(255 255 255 / 0.05)"
          strokeWidth={stroke}
        />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeDasharray={`${a.dash} ${circumference - a.dash}`}
            strokeDashoffset={a.offset}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute flex flex-col items-center">
        {centerLabel && (
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            {centerLabel}
          </span>
        )}
        <span className={cn("font-semibold text-zinc-50", size > 160 ? "text-lg" : "text-base")}>
          {centerValue}
        </span>
      </div>
    </div>
  );
}