// ─── Dates & Time ────────────────────────────────────────────────────────────
//
// The reference LOGIC library. Every other one in this marketplace is this file
// with different nouns, so it is worth reading before writing your own.
//
// Two things it demonstrates:
//
//   1. Every Etyma parameter arrives as TEXT. `date-fns` wants a `Date`. So
//      almost every function here is `parseISO` then the real call — a chain,
//      not a single node. Pretending otherwise would give a signature that does
//      not match the package and fails in the consumer's own tsc.
//
//   2. The package is pinned to 2.30.0 on purpose. date-fns 3.x and 4.x are
//      ESM-first, and a generated Etyma app is CommonJS: `require("date-fns")`
//      on v3+ resolves badly under Node's dual-package rules. 2.30.0 is plain
//      CJS, ships its own types, and is the version most of the ecosystem is
//      still on. A marketplace library that floats or chases the newest version
//      is a library that breaks on somebody else's Tuesday.

import { library, pkg, p, fn } from "../lib/kit.mjs";

const SLUG = "dates";

const dateFns = pkg("date-fns", "2.30.0", {
  // date-fns ships its own .d.ts — no @types/date-fns (that package is a stub
  // that exists only to tell you so).
  types: "bundled",
  environments: ["node", "browser"],
  functions: [
    {
      export: "parseISO",
      params: [p("argument", "string")],
      returns: "Date",
      jsdoc: "Parse an ISO-8601 string into a Date. The entry point for every other function here.",
    },
    {
      export: "formatISO",
      params: [p("date", "Date"), p("options", "object", true)],
      returns: "string",
      jsdoc: "Format a Date back to ISO-8601, which is how a date should be stored and passed.",
    },
    {
      export: "format",
      params: [p("date", "Date"), p("format", "string"), p("options", "object", true)],
      returns: "string",
      jsdoc: "Format a Date for a human, e.g. 'd MMM yyyy' or 'EEEE, d MMMM'.",
    },
    {
      export: "addDays",
      params: [p("date", "Date"), p("amount", "number")],
      returns: "Date",
      jsdoc: "Add days. A negative amount subtracts.",
    },
    {
      export: "addBusinessDays",
      params: [p("date", "Date"), p("amount", "number")],
      returns: "Date",
      jsdoc: "Add working days, skipping Saturdays and Sundays. Public holidays are NOT considered.",
    },
    {
      export: "differenceInCalendarDays",
      params: [p("dateLeft", "Date"), p("dateRight", "Date")],
      returns: "number",
      jsdoc: "Whole days between two dates, counting calendar days rather than 24-hour spans.",
    },
    {
      export: "differenceInBusinessDays",
      params: [p("dateLeft", "Date"), p("dateRight", "Date")],
      returns: "number",
      jsdoc: "Working days between two dates, weekends excluded.",
    },
    {
      export: "isWeekend",
      params: [p("date", "Date")],
      returns: "boolean",
      jsdoc: "Saturday or Sunday.",
    },
    {
      export: "isAfter",
      params: [p("date", "Date"), p("dateToCompare", "Date")],
      returns: "boolean",
      jsdoc: "Is the first date later than the second?",
    },
    {
      export: "formatDistanceToNowStrict",
      params: [p("date", "Date"), p("options", "object", true)],
      returns: "string",
      jsdoc: "'3 days', '2 months' — no 'about', no 'almost'. Strict is the one you want in a table.",
    },
    {
      export: "startOfDay",
      params: [p("date", "Date")],
      returns: "Date",
      jsdoc: "Midnight at the start of the date, for a range that should include the whole day.",
    },
    {
      export: "endOfMonth",
      params: [p("date", "Date")],
      returns: "Date",
      jsdoc: "The last moment of the month — billing periods, reporting windows, retention.",
    },
  ],
});

/** parseISO, then one call that takes the Date. The shape of nearly every function here. */
const parsed = (arg = "date") => ({ pkg: "date-fns", export: "parseISO", args: [`{{${arg}}}`], out: arg === "date" ? "parsed" : `parsed${arg}` });

export default library({
  slug: SLUG,
  name: "Dates & Time",
  tagline: "Format, shift and compare dates — including working days.",
  description:
    "Date arithmetic over date-fns: format for humans or for storage, add days and business days, measure the gap between two dates, and ask whether a deadline has passed. Every function takes and returns ISO-8601 text, which is what an Etyma parameter carries.",
  category: "Data",
  tags: ["dates", "time", "sla", "business-days", "formatting"],
  packages: [dateFns],
  notes:
    "Business-day functions skip weekends only. Public holidays vary by country and change every year, so they need a calendar the app supplies — see the Business Calendar library if you need them.",
  actions: [
    fn(
      SLUG,
      "Format Date",
      "Format an ISO date for a person, e.g. '9 Sep 2026'. Patterns are date-fns patterns: d MMM yyyy, EEEE, HH:mm.",
      ["date", "pattern"],
      [parsed(), { pkg: "date-fns", export: "format", args: ["{{parsed}}", "{{pattern}}"] }],
      "formatted",
      { returnType: "Text" },
    ),
    fn(
      SLUG,
      "Add Days",
      "Shift an ISO date by a number of days and return ISO. Negative subtracts.",
      ["date", "days"],
      [
        parsed(),
        { pkg: "date-fns", export: "addDays", args: ["{{parsed}}", "{{= Number(days) }}"], out: "shifted" },
        { pkg: "date-fns", export: "formatISO", args: ["{{shifted}}"] },
      ],
      "result",
      { returnType: "Text" },
    ),
    fn(
      SLUG,
      "Add Business Days",
      "Shift an ISO date by working days, skipping weekends. Use for 'due in 5 working days'.",
      ["date", "days"],
      [
        parsed(),
        { pkg: "date-fns", export: "addBusinessDays", args: ["{{parsed}}", "{{= Number(days) }}"], out: "shifted" },
        { pkg: "date-fns", export: "formatISO", args: ["{{shifted}}"] },
      ],
      "result",
      { returnType: "Text" },
    ),
    fn(
      SLUG,
      "Days Between",
      "Whole calendar days from the first date to the second. Negative when the second is earlier.",
      ["from", "to"],
      [
        { pkg: "date-fns", export: "parseISO", args: ["{{to}}"], out: "left" },
        { pkg: "date-fns", export: "parseISO", args: ["{{from}}"], out: "right" },
        { pkg: "date-fns", export: "differenceInCalendarDays", args: ["{{left}}", "{{right}}"] },
      ],
      "days",
      { returnType: "Integer" },
    ),
    fn(
      SLUG,
      "Business Days Between",
      "Working days from the first date to the second, weekends excluded. The usual measure of an SLA.",
      ["from", "to"],
      [
        { pkg: "date-fns", export: "parseISO", args: ["{{to}}"], out: "left" },
        { pkg: "date-fns", export: "parseISO", args: ["{{from}}"], out: "right" },
        { pkg: "date-fns", export: "differenceInBusinessDays", args: ["{{left}}", "{{right}}"] },
      ],
      "days",
      { returnType: "Integer" },
    ),
    fn(
      SLUG,
      "Is Overdue",
      "True when the deadline is in the past. Pass the deadline and the moment to judge it against.",
      ["now", "deadline"],
      [
        { pkg: "date-fns", export: "parseISO", args: ["{{now}}"], out: "left" },
        { pkg: "date-fns", export: "parseISO", args: ["{{deadline}}"], out: "right" },
        { pkg: "date-fns", export: "isAfter", args: ["{{left}}", "{{right}}"] },
      ],
      "overdue",
      { returnType: "Boolean" },
    ),
    fn(
      SLUG,
      "Is Weekend",
      "True on a Saturday or Sunday. The cheap half of a working-day check.",
      ["date"],
      [parsed(), { pkg: "date-fns", export: "isWeekend", args: ["{{parsed}}"] }],
      "weekend",
      { returnType: "Boolean" },
    ),
    fn(
      SLUG,
      "Age",
      "How long ago, in plain words: '3 days', '2 months'. For a Last updated column.",
      ["date"],
      [parsed(), { pkg: "date-fns", export: "formatDistanceToNowStrict", args: ["{{parsed}}"] }],
      "age",
      { returnType: "Text" },
    ),
    fn(
      SLUG,
      "Start Of Day",
      "Midnight at the start of the date, as ISO. Use as the lower bound of a whole-day range.",
      ["date"],
      [
        parsed(),
        { pkg: "date-fns", export: "startOfDay", args: ["{{parsed}}"], out: "floored" },
        { pkg: "date-fns", export: "formatISO", args: ["{{floored}}"] },
      ],
      "result",
      { returnType: "Text" },
    ),
    fn(
      SLUG,
      "End Of Month",
      "The last moment of the date's month, as ISO. Billing periods, reporting windows, retention cut-offs.",
      ["date"],
      [
        parsed(),
        { pkg: "date-fns", export: "endOfMonth", args: ["{{parsed}}"], out: "last" },
        { pkg: "date-fns", export: "formatISO", args: ["{{last}}"] },
      ],
      "result",
      { returnType: "Text" },
    ),
  ],
});
