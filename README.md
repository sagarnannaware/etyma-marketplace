# Etyma Marketplace

Ready-made **library modules** for [Etyma](https://github.com/sagarnannaware/GridStudio) — drop one into a solution and call it from a flow or place it on a page.

A library module never deploys as a service. It **compiles into** every module that references it, so a library costs you no container, no port, and no failure mode when "the library is down". That is the whole mechanism, and it is the same one you get for a library of your own.

```
catalog.json          every library, for the website and for tooling
libraries/<slug>/     the installable folder — a byte-for-byte .etyma/projects/<slug>/
libraries-src/*.mjs   the definitions. THIS is the source of truth
docs/<slug>.md        what each library does, in prose
lib/kit.mjs           the builder every definition is written against
scripts/              build · validate · verify-against-core
```

## Installing a library

An Etyma solution keeps its model in `.etyma/` in your repository, so installing is a copy:

```bash
# 1. copy the library into your solution's modules
cp -r libraries/dates /path/to/your-app/.etyma/projects/dates

# 2. add its id to `projectIds` in .etyma/solution.json
#    (the id is in libraries/dates/project.json)

# 3. reopen the workspace, then: Etyma: Add Reference → Dates & Time
```

> **This is more manual than it should be.** Etyma has no *Import Module* command yet — `New Project (Module)` makes an empty one and `Add Reference` only wires modules already in the solution. The importer that turns the three steps above into one is tracked in the main repository; the library folders here are laid out so that it can be a straight copy when it lands.

Once referenced:

- a **function** is a `RunAction` node in any server flow — a plain local call, compiled in
- a **component** is placed on a page like any other part, and its props are bound like any other

The npm packages a library declares are inherited through the reference, `@types` included, so the exported app installs and type-checks without you adding anything.

## What is in a library

Exactly two things, because that is what a library module can hold.

**Functions** — public server actions. Each is a straight line of one to four calls into a declared npm package. No branches, no loops: a library function is one idea, and anything with a condition in it is application logic that belongs in your module where you can read it.

**Components** — real React `.tsx` files with a default export. They may import only what Etyma allows (`react`, `clsx`, `tailwind-merge`, `lucide-react`, `class-variance-authority`, the Radix primitives, and the shadcn set including `recharts`, `react-day-picker`, `cmdk` and `react-hook-form`), plus `@/lib/utils` and `@/components/<Name>`.

A library cannot own pages, database entities or integrations.

## The rules these libraries hold themselves to

Everything here is checked by `scripts/validate.mjs` on every build, because a marketplace's only real promise is *install this and it works*, and the cost of breaking it lands somewhere none of our error messages reach — in a generated app, at `npm run build`, on someone else's afternoon.

- **Exact versions, never ranges.** A library that floats its dependency breaks on somebody else's Tuesday.
- **CommonJS only.** A generated Etyma app is CJS. An ESM-only package resolves badly under Node's dual-package rules, so where a package went ESM-first we pin the last CJS line and say why in the file.
- **Every call is checked against its own manifest** — the export exists, and the argument count matches the signature. This is the failure that otherwise surfaces as a type error inside your app.
- **Theme tokens only.** Not one `bg-blue-600`. A component that hard-codes a hue looks wrong in every app but the one it was written in, and unreadable in the other colour scheme.
- **Ids are derived, not random.** The same library has the same ids forever, so a rebuild shows real change only, and an importer can tell an update from a duplicate.

## Working on it

```bash
node scripts/build.mjs          # libraries-src/ → libraries/ + catalog.json
node scripts/validate.mjs       # the rules above
node scripts/build.mjs --check  # fail if the committed output has drifted
npm test                        # all three

# the check that matters most, when you have an Etyma checkout with core built:
ETYMA_REPO=../GridStudio node scripts/verify-against-core.mjs
```

That last one loads every library through Etyma's **real** `WorkspaceStorage` and runs its **real** `validateModule` — the same two pieces of code that run when you open the folder in the IDE. It caught a rule this repository's own validator did not know about within an hour of existing. If you have the checkout, run it.

**Never edit `libraries/` by hand.** It is generated, `--check` will catch you, and the edit would install something nobody can rebuild.

## Adding a library

Read `libraries-src/dates.lib.mjs` (a logic library) or `libraries-src/insight.lib.mjs` (a UI one) first — every other file is one of those two with different nouns. Then:

1. `libraries-src/<slug>.lib.mjs`, default-exporting `library({...})` from `lib/kit.mjs`
2. `docs/<slug>.md` — what it is for, and when *not* to reach for it
3. `node scripts/build.mjs && npm test`

Say what a function is **not** good for. A marketplace entry that only sells itself wastes the reader's afternoon before it wastes their evening.

## Licence

MIT. The npm packages these libraries wrap keep their own licences, which are listed per library in `docs/`.
