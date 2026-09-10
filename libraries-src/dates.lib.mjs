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
//   2. Nothing here returns `formatISO`. That was the first version and it was
//      wrong: `formatISO` renders in the SERVER's zone, so the same instant is
//      "2026-09-10T00:00:00Z" on a UTC container and "2026-09-10T08:00:00+08:00"
//      on a Singapore laptop. Both denote the same moment and neither is
//      invalid — but a value billed as canonical must not depend on where the
//      process happens to run, or two rows written by two replicas stop
//      comparing equal as strings. Every function that returns a date pins the
//      output to UTC through `formatInTimeZone`.
//
//      (date-fns 4.1.0 and date-fns-tz 3.2.0 both `require()` cleanly under
//      Node 20 CommonJS — verified, not assumed. An earlier note here claimed
//      v3+ was ESM-only and pinned 2.30.0 for it; that was simply false, and
//      the cost of believing it was losing time zones entirely.)

import { library, pkg, p, fn } from "../lib/kit.mjs";

const SLUG = "dates";

const dateFns = pkg("date-fns", "4.1.0", {
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

const dateFnsTz = pkg("date-fns-tz", "3.2.0", {
  // Ships its own .d.ts. The reason it is here at all: a generated Etyma app
  // runs in a container set to UTC while the people using it do not, and every
  // "which day is this?" question is answered wrongly by default.
  types: "bundled",
  environments: ["node", "browser"],
  functions: [
    {
      export: "formatInTimeZone",
      params: [p("date", "Date"), p("timeZone", "string"), p("formatStr", "string")],
      returns: "string",
      jsdoc: "Render an instant in a named IANA zone — 'Asia/Singapore', 'Europe/London'. Also how a canonical UTC string is produced.",
    },
    {
      export: "toZonedTime",
      params: [p("date", "Date"), p("timeZone", "string")],
      returns: "Date",
      jsdoc: "An instant re-expressed as wall-clock time in a zone, for arithmetic that must land on the local day.",
    },
    {
      export: "fromZonedTime",
      params: [p("date", "Date"), p("timeZone", "string")],
      returns: "Date",
      jsdoc: "Wall-clock text somebody typed in their zone, back to a real instant. The conversion an appointment form always gets wrong.",
    },
  ],
});

/** The canonical UTC form. Pinned to UTC so the answer never depends on the server. */
const UTC_ISO = { pkg: "date-fns-tz", export: "formatInTimeZone", args: [null, '{{= "UTC" }}', `{{= "yyyy-MM-dd'T'HH:mm:ss'Z'" }}`] };
const toUtcIso = (from) => ({ ...UTC_ISO, args: [`{{${from}}}`, UTC_ISO.args[1], UTC_ISO.args[2]] });

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
  packages: [dateFns, dateFnsTz],
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
      "Format In Time Zone",
      "Render an instant in a named IANA zone — 'Asia/Singapore', 'Europe/London'. The one that matters when the server runs in UTC and the people using it do not.",
      ["date", "timeZone", "pattern"],
      [parsed(), { pkg: "date-fns-tz", export: "formatInTimeZone", args: ["{{parsed}}", "{{timeZone}}", "{{pattern}}"] }],
      "formatted",
      { returnType: "Text" },
    ),
    fn(
      SLUG,
      "From Local Time",
      "Wall-clock text a person typed in their own zone, back to a real instant as canonical UTC. The conversion an appointment form always gets wrong.",
      ["localDateTime", "timeZone"],
      [
        parsed("localDateTime"),
        { pkg: "date-fns-tz", export: "fromZonedTime", args: ["{{parsedlocalDateTime}}", "{{timeZone}}"], out: "instant" },
        toUtcIso("instant"),
      ],
      "result",
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
        toUtcIso("shifted"),
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
        toUtcIso("shifted"),
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
        toUtcIso("floored"),
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
        toUtcIso("last"),
      ],
      "result",
      { returnType: "Text" },
    ),
  ],
});
