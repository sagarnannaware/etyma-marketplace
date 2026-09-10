// ─── Insight — the reference UI library ──────────────────────────────────────
//
// Five components a back-office screen needs on day one and that everyone ends
// up writing badly: a KPI tile, a trend line, a status pill, a progress ring and
// an empty state.
//
// What makes them marketplace-grade rather than snippets:
//
//   • THEME TOKENS ONLY. Not one `bg-blue-600`. A component that hard-codes a
//     hue looks wrong in every app but the one it was written in, and unreadable
//     in the other colour scheme. `scripts/validate.mjs` fails the build over
//     it, which is the only way this rule survives contact with a hurry.
//
//   • Hand-rolled SVG for the sparkline and the ring. `recharts` IS on Etyma's
//     allow-list and is the right answer for a real chart with axes, a legend
//     and a tooltip — but a 90-byte polyline in a table cell should not drag a
//     charting library into the bundle. Reach for recharts when you need a
//     chart; reach for these when you need a mark.
//
//   • Props are STRINGS. Every Etyma parameter arrives as text, so each
//     component parses what it is given and survives nonsense rather than
//     throwing inside someone's page. `useMemo` over a comma-separated series
//     is the shape; a component that assumed `number[]` would crash the first
//     time a page bound it to a expression.

import { library, component } from "../lib/kit.mjs";

const SLUG = "insight";

const STAT_TILE = `import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

/**
 * A single number, said well.
 *
 * The delta is the reason this exists: a figure with no comparison is a figure
 * nobody can act on. Direction is derived from the value's sign rather than
 * asked for separately, because two props that can disagree eventually will.
 */
export default function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  invertDelta,
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaLabel?: string;
  hint?: string;
  /** For metrics where down is good — cost, backlog, time to resolve. */
  invertDelta?: boolean;
  className?: string;
}) {
  const n = delta === undefined || delta === "" ? NaN : Number(String(delta).replace(/[^0-9.+-]/g, ""));
  const has = Number.isFinite(n) && n !== 0;
  const good = has ? (invertDelta ? n < 0 : n > 0) : false;
  const Icon = !has ? ArrowRight : n > 0 ? ArrowUp : ArrowDown;

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 text-card-foreground", className)}>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums tracking-tight">{value}</span>
        {delta !== undefined && delta !== "" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-sm font-medium tabular-nums",
              !has && "text-muted-foreground",
              has && good && "text-[var(--chart-2)]",
              has && !good && "text-destructive",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {delta}
          </span>
        )}
      </div>
      {(deltaLabel || hint) && (
        <div className="mt-1 text-xs text-muted-foreground">{deltaLabel || hint}</div>
      )}
    </div>
  );
}
`;

const SPARKLINE = `import { useMemo } from "react";
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
        .split(/[\\s,]+/)
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
  const d = coords.map(([x, y], i) => \`\${i ? "L" : "M"}\${x.toFixed(2)} \${y.toFixed(2)}\`).join(" ");
  const [lx, ly] = coords[coords.length - 1];
  const rising = points[points.length - 1] >= points[0];

  return (
    <svg
      viewBox={\`0 0 \${w} \${h}\`}
      // Fills the cell it is given; the viewBox does the scaling.
      className={cn("w-full overflow-visible", className)}
      style={{ height: h }}
      role="img"
      aria-label={label || \`Trend over \${points.length} points\`}
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
`;

const STATUS_BADGE = `import { cn } from "@/lib/utils";

/**
 * The state of one thing, in one word.
 *
 * Tone is a small closed set on purpose. A badge that took an arbitrary colour
 * would let every screen invent its own vocabulary, and the whole value of a
 * status pill is that "amber" means the same thing on every page.
 */
const TONES = {
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-secondary text-secondary-foreground ring-border",
  success: "text-[var(--chart-2)] ring-current/30 bg-current/10",
  warning: "text-[var(--chart-4)] ring-current/30 bg-current/10",
  danger: "bg-destructive/10 text-destructive ring-destructive/30",
} as const;

export type BadgeTone = keyof typeof TONES;

export default function StatusBadge({
  label,
  tone,
  dot,
  className,
}: {
  label: string;
  /** neutral · info · success · warning · danger */
  tone?: string;
  /** A leading dot, for a dense table where the word alone is hard to scan. */
  dot?: boolean;
  className?: string;
}) {
  const key = (tone && tone in TONES ? tone : "neutral") as BadgeTone;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        TONES[key],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {label}
    </span>
  );
}
`;

const PROGRESS_RING = `import { cn } from "@/lib/utils";

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
  /** Defaults to 100, so a percentage needs only \`value\`. */
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
      <svg width={px} height={px} className="-rotate-90" role="img" aria-label={label || \`\${Math.round(pct * 100)} percent\`}>
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
`;

const EMPTY_STATE = `import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

/**
 * What a list says when it has nothing to say.
 *
 * The most-skipped screen in every application and the one a first-time user is
 * most likely to hit. It takes an action for a reason: an empty state that only
 * apologises leaves the person where they were.
 */
export default function EmptyState({
  title,
  description,
  actionLabel,
  compact,
  className,
  onAction,
  children,
}: {
  title: string;
  description?: string;
  /** Omit to render no button — not every empty list has a next step. */
  actionLabel?: string;
  compact?: boolean;
  className?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
}
`;

export default library({
  slug: SLUG,
  name: "Insight",
  tagline: "The five things every back-office screen needs on day one.",
  description:
    "KPI tiles, sparklines, status pills, progress rings and empty states — built on the theme's own tokens, so they take on the colours of whatever app they are dropped into and read correctly in both light and dark.",
  category: "Display",
  tags: ["dashboard", "kpi", "charts", "status", "empty-state", "theme"],
  notes:
    "The sparkline and the ring are hand-drawn SVG because they belong inside a table cell. For a real chart with axes and a tooltip, recharts is on Etyma's allow-list — use it.",
  components: [
    component(
      SLUG,
      "StatTile",
      "A headline number with an optional delta that colours itself by direction. Set invertDelta for metrics where down is good.",
      [
        { name: "label", type: "Text" },
        { name: "value", type: "Text" },
        { name: "delta", type: "Text" },
        { name: "deltaLabel", type: "Text" },
        { name: "hint", type: "Text" },
        { name: "invertDelta", type: "Boolean" },
        { name: "className", type: "Text" },
      ],
      STAT_TILE,
    ),
    component(
      SLUG,
      "Sparkline",
      "A trend line the size of a word, from a comma-separated series. Green when it ends above where it started.",
      [
        { name: "series", type: "Text" },
        { name: "height", type: "Number" },
        { name: "showLast", type: "Boolean" },
        { name: "label", type: "Text" },
        { name: "className", type: "Text" },
      ],
      SPARKLINE,
    ),
    component(
      SLUG,
      "StatusBadge",
      "A status pill in one of five tones: neutral, info, success, warning, danger. A closed set on purpose.",
      [
        { name: "label", type: "Text" },
        { name: "tone", type: "Text" },
        { name: "dot", type: "Boolean" },
        { name: "className", type: "Text" },
      ],
      STATUS_BADGE,
    ),
    component(
      SLUG,
      "ProgressRing",
      "A circular proportion for places a bar will not fit — a row, a card corner, beside a label.",
      [
        { name: "value", type: "Text" },
        { name: "max", type: "Text" },
        { name: "size", type: "Number" },
        { name: "label", type: "Text" },
        { name: "showValue", type: "Boolean" },
        { name: "className", type: "Text" },
      ],
      PROGRESS_RING,
    ),
    component(
      SLUG,
      "EmptyState",
      "What a list says when it is empty, with a way out. Accepts children for anything extra.",
      [
        { name: "title", type: "Text" },
        { name: "description", type: "Text" },
        { name: "actionLabel", type: "Text" },
        { name: "compact", type: "Boolean" },
        { name: "className", type: "Text" },
      ],
      EMPTY_STATE,
      {
        acceptsChildren: true,
        events: [{ name: "onAction", description: "The person pressed the button. Bind it to what should happen next." }],
      },
    ),
  ],
});
