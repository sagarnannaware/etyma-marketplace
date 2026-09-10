import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * A trend, at the size of a word.
 *
 * Drawn by hand rather than with recharts: this belongs in a table cell beside
 * a number, where a charting library's axes, tooltip and responsive container
 * are all cost and no benefit. For a real chart, use recharts — it is on
 * Etyma's allow-list.
 *
 * The series arrives as text, because that is what a page binding gives you.
 */
export default function Sparkline({
  series,
  height,
  showLast,
  label,
  className,
}: {
  /** Comma or space separated numbers, oldest first. */
  series: string;
  height?: string;
  /** Mark the most recent point with a dot. */
  showLast?: boolean;
  /** Accessible description; falls back to a count of points. */
  label?: string;
  className?: string;
}) {
  const points = useMemo(
    () =>
      String(series || "")
        .split(/[\s,]+/)
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v)),
    [series],
  );

  const h = Math.max(16, Number(height) || 32);
  const w = 100;

  if (points.length < 2) {
    // One point is not a trend, and an empty chart that renders as a stray dot
    // reads as a bug. Say nothing instead.
    return <div className={cn("h-8 text-xs text-muted-foreground", className)}>—</div>;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 2;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const d = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const [lx, ly] = coords[coords.length - 1];
  const rising = points[points.length - 1] >= points[0];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      // Fills the cell it is given; the viewBox does the scaling.
      className={cn("w-full overflow-visible", className)}
      style={{ height: h }}
      role="img"
      aria-label={label || `Trend over ${points.length} points`}
      preserveAspectRatio="none"
    >
      <path
        d={d}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ stroke: rising ? "var(--chart-2)" : "var(--chart-5)" }}
      />
      {showLast && (
        <circle cx={lx} cy={ly} r={2} vectorEffect="non-scaling-stroke" style={{ fill: rising ? "var(--chart-2)" : "var(--chart-5)" }} />
      )}
    </svg>
  );
}
