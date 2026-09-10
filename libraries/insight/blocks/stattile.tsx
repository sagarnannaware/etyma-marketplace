import { cn } from "@/lib/utils";
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
