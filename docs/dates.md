# Dates & Time

Date arithmetic over [date-fns](https://date-fns.org) — format for people or for storage, add days and working days, measure the gap between two dates, and ask whether a deadline has passed.

**Kind** logic · **Category** Data · **Wraps** `date-fns@2.30.0` (MIT)

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

**Time zones.** Everything here operates on the instant the ISO string names. If you need "9am in the user's zone" you want a zoned library and a stored preference, not this.

**Recurrence.** Cron-like rules, "every second Tuesday", RRULE — none of that is here, and expressing it as a chained call would be a lie.

## Why date-fns 2.30.0 and not 3 or 4

A generated Etyma app is CommonJS. date-fns 3.x and 4.x are ESM-first and resolve badly under Node's dual-package rules from a `require()`. 2.30.0 is plain CJS, ships its own type declarations, and is still what most of the ecosystem is on.

If you need a v3+ feature, wrap it in your own module where you control the module system — do not "upgrade" this library and expect the export to keep building.
