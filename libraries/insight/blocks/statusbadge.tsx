import { cn } from "@/lib/utils";

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
