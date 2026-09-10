import { cn } from "@/lib/utils";

/**
 * A proportion, where a bar would not fit.
 *
 * An SVG circle with a dashed stroke: circumference as the dash length, and the
 * offset as the remainder. No library, no layout thrash, and it scales with the
 * font size it is dropped beside.
 */
export default function ProgressRing({
  value,
  max,
  size,
  label,
  showValue,
  className,
}: {
  value: string;
  /** Defaults to 100, so a percentage needs only `value`. */
  max?: string;
  size?: string;
  label?: string;
  showValue?: boolean;
  className?: string;
}) {
  const v = Number(value);
  const m = Number(max) || 100;
  const pct = Number.isFinite(v) && m > 0 ? Math.max(0, Math.min(1, v / m)) : 0;

  const px = Math.max(24, Number(size) || 48);
  const stroke = Math.max(3, Math.round(px / 12));
  const r = (px - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: px, height: px }}>
      <svg width={px} height={px} className="-rotate-90" role="img" aria-label={label || `${Math.round(pct * 100)} percent`}>
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="stroke-primary transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {showValue && (
        <span className="absolute text-[0.7em] font-semibold tabular-nums text-foreground">{Math.round(pct * 100)}%</span>
      )}
    </div>
  );
}
