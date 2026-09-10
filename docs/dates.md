# Dates & Time

Date arithmetic over [date-fns](https://date-fns.org) — format for people or for storage, add days and working days, measure the gap between two dates, and ask whether a deadline has passed.

**Kind** logic · **Category** Data · **Wraps** `date-fns@4.1.0` and `date-fns-tz@3.2.0` (both MIT)

## Why it exists

Every business app does date maths and almost every one does it slightly wrong. The recurring mistakes are a small set: measuring "days between" with a 24-hour subtraction so a run at 23:00 gives a different answer than one at 01:00; treating a due date as elapsed time rather than working days; and formatting a date by string-slicing an ISO value until it looks right for one locale.

This is a thin, honest wrapper over the library that gets all three right.

## Everything takes and returns ISO-8601 text

An Etyma parameter carries **text**. `date-fns` wants a `Date`. So every function here is `parseISO` and then the real call, and the ones that produce a date end with `formatISO` on the way out.

That is why they chain rather than being one call each, and it is the shape you want for your own wrappers: keep ISO at the boundary, parse inside. A function that returned a `Date` object would be unusable from a page binding, and one that took a pre-parsed date would push the problem onto every caller.

## Functions

| Function | Takes | Gives back |
|---|---|---|
| **Format Date** | `date`, `pattern` | The date written for a person — `d MMM yyyy`, `EEEE`, `HH:mm`. [Pattern reference](https://date-fns.org/docs/format). |
| **Format In Time Zone** | `date`, `timeZone`, `pattern` | The same, rendered in a named IANA zone. What you want when the server is UTC and the reader is not. |
| **From Local Time** | `localDateTime`, `timeZone` | Wall-clock text somebody typed in their zone → a real instant, as UTC. The conversion an appointment form always gets wrong. |
| **Add Days** | `date`, `days` | ISO, shifted. Negative subtracts. |
| **Add Business Days** | `date`, `days` | ISO, shifted by *working* days. "Due in 5 working days". |
| **Days Between** | `from`, `to` | Whole calendar days. Negative when `to` is earlier. |
| **Business Days Between** | `from`, `to` | Working days — the usual measure of an SLA. |
| **Is Overdue** | `now`, `deadline` | `true` when the deadline has passed. |
| **Is Weekend** | `date` | Saturday or Sunday. |
| **Age** | `date` | `"3 days"`, `"2 months"` — for a *Last updated* column. |
| **Start Of Day** | `date` | Midnight, as ISO. The lower bound of a whole-day range. |
| **End Of Month** | `date` | The month's last moment. Billing periods, retention cut-offs. |

## When *not* to reach for this

**Public holidays.** `Add Business Days` and `Business Days Between` skip **weekends only**. Holidays vary by country, by state, and by year, and several move — Good Friday, Chinese New Year, Hari Raya, Diwali. A library that shipped a holiday table would be wrong somewhere on the day it was published and everywhere within two years. If your SLA has to respect holidays, the calendar is data your app owns.

**Recurrence.** Cron-like rules, "every second Tuesday", RRULE — none of that is here, and expressing it as a chained call would be a lie.

## Everything that returns a date returns UTC

`formatISO` renders in the **server's** zone. The same instant is `2026-09-10T00:00:00Z` on a UTC container and `2026-09-10T08:00:00+08:00` on a Singapore laptop — both correct, neither canonical. Two replicas in different zones would write two different strings for one moment, and string comparison would stop working.

So every function that hands back a date pins the output to UTC. If you want it in someone's local zone, that is `Format In Time Zone`, and it is a rendering decision made at the point of display rather than a property of what you stored.

The first version of this library got that wrong, and the pin was wrong with it: it used date-fns 2.30.0 on the belief that 3.x+ was ESM-only and would not `require()` from a CommonJS app. That is simply false — 4.1.0 requires cleanly under Node 20 — and the cost of the belief was doing without time zones altogether.
