// ─── What a code component may import ────────────────────────────────────────
//
// Copied from `packages/core/src/codeComponents.ts` in the Etyma repository
// (CODE_COMPONENT_ALLOWED_IMPORTS), 2026-09-10. It is duplicated rather than
// imported because `@platform/core` is not published to npm and this repository
// must build for anyone who clones it.
//
// A copy drifts. `scripts/validate.mjs` is the only consumer, and it fails a
// library whose imports are not on this list — so the failure mode of a stale
// copy is a library refused here that the IDE would have accepted, which is
// noisy but safe. The reverse (accepting one the IDE rejects) only happens if
// core REMOVES an entry, which is a breaking change it would announce.
//
// If you widen this list, widen it from core — never from what a library wants.

/** The primitives shadcn/ui is built on. */
export const RADIX_PRIMITIVES = [
  "@radix-ui/react-slot",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-select",
  "@radix-ui/react-tabs",
  "@radix-ui/react-tooltip",
  "@radix-ui/react-popover",
  "@radix-ui/react-checkbox",
  "@radix-ui/react-switch",
  "@radix-ui/react-accordion",
  "@radix-ui/react-avatar",
  "@radix-ui/react-label",
  "@radix-ui/react-separator",
  "@radix-ui/react-progress",
  "@radix-ui/react-scroll-area",
  "@radix-ui/react-toggle",
  "@radix-ui/react-radio-group",
  "@radix-ui/react-slider",
  "@radix-ui/react-collapsible",
  "@radix-ui/react-alert-dialog",
  "@radix-ui/react-aspect-ratio",
  "@radix-ui/react-context-menu",
  "@radix-ui/react-hover-card",
  "@radix-ui/react-menubar",
  "@radix-ui/react-navigation-menu",
  "@radix-ui/react-toggle-group",
];

/**
 * The libraries the rest of shadcn/ui builds on — calendar, carousel, chart,
 * command, drawer, form, input-otp, resizable, sonner.
 *
 * `recharts` and `react-day-picker` being here matters: a chart or a date
 * picker does NOT have to be hand-rolled in SVG. Reach for the library first.
 */
export const UI_LIBRARIES = [
  "react-day-picker",
  "embla-carousel-react",
  "recharts",
  "cmdk",
  "vaul",
  "react-hook-form",
  "input-otp",
  "react-resizable-panels",
  "sonner",
];

export const ALLOWED_IMPORTS = [
  "react",
  "react/jsx-runtime",
  "clsx",
  "tailwind-merge",
  "lucide-react",
  "class-variance-authority",
  ...RADIX_PRIMITIVES,
  ...UI_LIBRARIES,
];

/** Etyma provides `cn()`; the export writes it to `src/lib/utils.ts`. */
export const LOCAL_UTILS_MODULE = "@/lib/utils";
/** Another code component of this library, or of one it references, by NAME. */
export const LOCAL_COMPONENTS_PREFIX = "@/components/";

export function isLocalImport(spec) {
  return spec === LOCAL_UTILS_MODULE || spec.startsWith(LOCAL_COMPONENTS_PREFIX);
}

export function isAllowedImport(spec) {
  return isLocalImport(spec) || ALLOWED_IMPORTS.includes(spec);
}
