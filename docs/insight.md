# Insight

The five things a back-office screen needs on day one: a KPI tile, a trend line, a status pill, a progress ring and an empty state.

**Kind** UI · **Category** Display · **Dependencies** none beyond what Etyma already ships

## Why it exists

Every internal app grows these five, and every one of them grows them badly — usually as a `<div>` with a hard-coded colour, copied between three screens until they disagree. They are small enough that nobody schedules them and visible enough that everybody judges the app by them.

## They take the app's colours, not their own

Not one component here contains `bg-blue-600`. Everything is drawn from the solution's theme tokens — `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, and `var(--chart-1..5)` for data.

That is the difference between a component you can install and a snippet you have to edit. A hard-coded hue looks wrong in every app but the one it was written in, and is usually unreadable in the other colour scheme. `scripts/validate.mjs` fails the build on a palette literal, which is the only way the rule survives contact with a hurry.

## Props are strings, on purpose

Every Etyma parameter arrives as text. So `Sparkline` takes `"12, 19, 14, 22"` and parses it; `ProgressRing` takes `value` and `max` as text and coerces them. Each one survives nonsense — an empty series, a non-numeric value — by rendering something reasonable rather than throwing inside your page.

A component that declared `series: number[]` would look tidier and crash the first time a page bound it to an expression.

## Components

| Component | What it is for |
|---|---|
| **StatTile** | A headline number with an optional delta that colours itself by direction. Set `invertDelta` where down is good — cost, backlog, time-to-resolve. |
| **Sparkline** | A trend at the size of a word, from a comma-separated series. Green when it ends above where it started. Renders `—` for fewer than two points, because one point is not a trend. |
| **StatusBadge** | A status pill in one of five tones: `neutral`, `info`, `success`, `warning`, `danger`. |
| **ProgressRing** | A circular proportion for places a bar will not fit — a table row, a card corner. |
| **EmptyState** | What a list says when it is empty, with a way out. Accepts children; emits `onAction`. |

## Two deliberate design decisions

**The tone list is closed.** `StatusBadge` takes one of five names, not a colour. A badge that accepted an arbitrary hue would let every screen invent its own vocabulary, and the entire value of a status pill is that amber means the same thing on every page. An unknown tone falls back to `neutral` rather than rendering unstyled.

**The empty state takes an action.** The most-skipped screen in any application, and the one a first-time user is most likely to hit first. An empty state that only apologises leaves the person exactly where they were. `actionLabel` is optional — not every empty list has a next step — but it is there because most do.

## When *not* to reach for this

**Real charts.** `Sparkline` is a mark, not a chart: no axes, no legend, no tooltip, no responsive container. For anything a person will read values off, use **recharts** — it is on Etyma's allow-list and is the right tool. The sparkline exists so that a table cell does not have to drag a charting library into the bundle.

**Dashboard layout.** These are five components, not a dashboard. Grid, responsive breakpoints and card ordering are your page's job.

**Accessibility beyond the basics.** The SVGs carry `role="img"` and a label, and the button is focusable with a visible ring. Nothing here has been through a screen-reader audit, and a `StatusBadge` communicates partly through colour — pair it with the word, which is why `label` is required rather than optional.
