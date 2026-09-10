import { cn } from "@/lib/utils";
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
