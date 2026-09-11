# Etyma Marketplace

Ready-made **library modules** for [Etyma](https://github.com/sagarnannaware/GridStudio) — drop one into a solution and call it from a flow or place it on a page.

A library module never deploys as a service. It **compiles into** every module that references it, so a library costs you no container, no port, and no failure mode when "the library is down". That is the whole mechanism, and it is the same one you get for a library of your own.

```
catalog.json          every library, for the website, the Assistant's search and tooling
bundles/<slug>.json   each library folder as ONE download — what an install fetches
libraries/<slug>/     the installable folder — a byte-for-byte .etyma/projects/<slug>/
libraries-src/*.mjs   the definitions. THIS is the source of truth
docs/<slug>.md        what each library does, in prose
lib/kit.mjs           the builder every definition is written against
scripts/              build · validate · verify-against-core
```

## What is being shipped here — and what is not

Three operations are easy to confuse, so they are named apart:

| | What moves | In what form | For |
|---|---|---|---|
| **Export / Publish** | the whole **solution** | generated **source code** — React, Node, Prisma, Docker, CI | deploying your app |
| **Share to the marketplace** | **one module** | the **model** — `project.json`, `actions/*.json`, `blocks/*.tsx` | reuse by other solutions |
| **Install from the marketplace** | **one module** | the same model files | your solution |

**A marketplace entry is a module, not a solution, and model, not code.** Export turns your solution into an app; this moves a *module* between solutions, in model form, so the receiving IDE can open it in its editors and that app's own generators compile it in.

Shipping a whole solution would be wrong for a library. A `Solution` is a deployment manifest — `projectIds`, theme, environments, home page — and installing someone else's manifest into yours means nothing. The unit of reuse in Etyma is the module, which is why `Add Reference` is module-to-module.

There **is** a solution-shaped marketplace entry, but it is a different thing: a **template**, a whole solution you start *from* rather than install *into* (Acme Service Desk is already one, offered by `Etyma: Initialize Workspace`). Templates are not in this repository yet.

## Installing a library

Clone this repository, then in your solution's IDE run **`Etyma: Import Module…`** and point it at `libraries/<slug>`. It reads the folder, checks the signature, says what installing would do — new, an update of one you already have, or a name that clashes — and adds the module to your solution. Then it offers **Add Reference** so the module that will use it can see it.

That works because an Etyma solution keeps its model in `.etyma/` in your repository and `libraries/<slug>/` is a byte-for-byte `.etyma/projects/<slug>/`. The import is a folder copy through the same storage layer that opens a workspace — there is no package format to go stale.

From a terminal, `etyma fetch <slug>` downloads an entry and checks its signature; the install itself stays in the IDE, because a library is installed into a *model* somebody may have open.

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
- **`require()` is tested, not assumed.** A generated Etyma app is CommonJS, so every package here is actually required under Node 20 before it is pinned. An assumption cost us once already: date-fns was pinned to 2.30.0 on the belief that 3.x+ was ESM-only. It is not — 4.1.0 requires cleanly — and believing it had cost the library time-zone support entirely.
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

There are two authoring paths, and the second is the better one.

**Contributed — built in the IDE.** Make a module of type `library` in your own solution, write its functions, then run **`Etyma: Share Module as Library…`** and point it at a clone of this repository. It checks the module against the publishing rules first — in the IDE, where you can still fix what it finds — asks for the four things the model does not carry (name, tagline, category, version), and writes `libraries/<slug>/` plus `meta/<slug>.json`. `etyma pack <module-dir> -o <checkout>` does the same from a terminal.

`build.mjs` validates a contributed library like any other and never regenerates it — there is no definition to regenerate from, and inventing one would mean this repository silently rewriting somebody's module.

### Signatures

**Etyma signs what it publishes.** An entry that came from the registry carries `meta/<slug>.sig.json`: every file hashed, the account that published it named, and an Ed25519 signature over the lot, made with Etyma's own key. Every install already has the public half, so checking it needs no network call and there is **no author key for anybody to share**.

An entry in *this repository* carries no signature and needs none. It is either generated by CI from a definition in `libraries-src/`, or a pull request somebody read — and a reviewed diff is better evidence than a signature. So `verify-against-core.mjs` fails on a signature that does not check out and shrugs at a missing one.

What a signature means, exactly: **these are the bytes Etyma published, unchanged**. It does not mean the library is safe, and nothing here treats it as though it did — that is what the rules below and your own reading are for.

**Curated — written as code.** For the libraries maintained here: exact npm pins, deterministic ids and a CI rebuild all want a definition rather than a snapshot, which is why `cryptoLibrary.ts` in the main repository works the same way. Read `libraries-src/dates.lib.mjs` (logic) or `libraries-src/insight.lib.mjs` (UI) first — every other file is one of those two with different nouns. Then:

1. `libraries-src/<slug>.lib.mjs`, default-exporting `library({...})` from `lib/kit.mjs`
2. `docs/<slug>.md` — what it is for, and when *not* to reach for it
3. `node scripts/build.mjs && npm test`

Say what a function is **not** good for. A marketplace entry that only sells itself wastes the reader's afternoon before it wastes their evening.

## Themes

`themes/<slug>.json` is the other kind of entry: **a look as data** — shadcn's colour tokens (light, and dark when
authored), and optionally a style (one of Etyma's four: corporate, friendly, editorial, console; a density) with
the typography it needs. Nothing installs: the IDE's **Project Settings → Look** lists them under *From the
marketplace* and applies one in a tap, and the Assistant applies one with `set_theme({ marketplace: "<slug>" })`
after `search_marketplace` found it by what it looks like ("a warm serif look for the knowledge base"). A theme
has no folder, no bundle and no module id; `validate.mjs` holds it to every token in both modes and
`verify-against-core.mjs` applies it through core's own `applyCatalogTheme`. The three here — **Midnight**,
**Sand**, **Meadow** — were made from the IDE's presets (a colour preset, a style preset) and are the shape a
contributed one takes.

## Licence

MIT. The npm packages these libraries wrap keep their own licences, which are listed per library in `docs/`.
