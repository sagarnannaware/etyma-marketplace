#!/usr/bin/env node
// ─── build.mjs — definitions in, installable folders out ─────────────────────
//
//   node scripts/build.mjs           rebuild libraries/ and catalog.json
//   node scripts/build.mjs --check   rebuild into memory and fail on any drift
//
// Every file under `libraries/<slug>/` is generated. Nobody edits it by hand;
// the source of truth is `libraries-src/<slug>.lib.mjs`. `--check` is what CI
// runs: a build whose output differs from what is committed means someone
// edited the projection instead of the source, and that is the one failure
// mode a marketplace cannot afford — an install would carry a change nobody
// can trace back to a definition.
//
// The layout below is not ours. It is `WorkspaceStorage`'s, exactly, so that
// installing a library is `cp -r libraries/<slug> .etyma/projects/<slug>` and
// nothing more.

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { slugify } from "../lib/kit.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "libraries-src");
const OUT = join(ROOT, "libraries");
const CHECK = process.argv.includes("--check");

// ─── Shredding: which Project fields become their own files ──────────────────
//
// Mirrors ASSET_COLLECTIONS in packages/core/src/storage/workspaceLayout.ts.
// A library only ever fills `actions` and `blocks`, but the empty collections
// still round-trip the way the loader expects: required ones as [], optional
// ones absent entirely (an empty directory is indistinguishable from a missing
// one, so an optional [] must not be written).
const COLLECTIONS = [
  { dir: "entities", field: "entities", required: true },
  { dir: "pages", field: "pages", required: true, sidecar: true },
  { dir: "blocks", field: "blocks", required: true, sidecar: true },
  { dir: "actions", field: "actions", required: true },
  { dir: "workflows", field: "workflows", required: false },
  { dir: "agents", field: "agents", required: false },
  { dir: "email-templates", field: "emailTemplates", required: false },
  { dir: "integrations", field: "integrations", required: true },
  { dir: "services", field: "publishedServices", required: false },
];

/** core's `idSuffix` — the part of an id that is safe in a file name. */
const idSuffix = (id) => id.toLowerCase().replace(/[^a-z0-9]/g, "") || "x";

/** core's `fileSlug`: a duplicate name in one collection gets a stable suffix. */
function fileSlug(name, id, taken) {
  const base = slugify(name && name.trim() ? name : id);
  const slug = taken.has(base) ? `${base}-${idSuffix(id)}` : base;
  taken.add(slug);
  return slug;
}

/**
 * One library → the map of relative path → file contents that `.etyma/projects/
 * <slug>/` should hold. Returning a map rather than writing lets `--check`
 * compare without touching the disk.
 */
function filesFor(slug, project) {
  const files = new Map();
  const rest = { ...project };

  for (const col of COLLECTIONS) {
    const items = project[col.field];
    delete rest[col.field];

    if (!items || items.length === 0) {
      // Required collections assemble to [] from an absent directory, so the
      // field is dropped either way — the loader supplies it.
      continue;
    }

    const taken = new Set();
    const order = [];
    for (const item of items) {
      const name = fileSlug(item.name, item.id, taken);
      order.push(name);

      if (col.sidecar && item.kind === "code" && typeof item.source === "string") {
        // The source is a SIDECAR: a real .tsx beside the JSON, paired by base
        // name. It never lives inside the JSON — that is the one documented
        // exception to "never trust the file name", and it exists so a
        // component diffs, lints and edits as code.
        const { source, ...withoutSource } = item;
        files.set(`${col.dir}/${name}.tsx`, source.endsWith("\n") ? source : `${source}\n`);
        files.set(`${col.dir}/${name}.json`, json(withoutSource));
      } else {
        files.set(`${col.dir}/${name}.json`, json(item));
      }
    }
    // Order lives in project.json, never in the asset files: an asset file that
    // carried its own index would conflict on every reorder.
    rest._order = { ...(rest._order || {}), [col.field]: order };
  }

  files.set("project.json", json(rest));
  return files;
}

const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

/** Every file under `dir`, as relative path → contents. */
function readTree(dir) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.set(relative(dir, full).split("\\").join("/"), readFileSync(full, "utf8"));
    }
  };
  walk(dir);
  return out;
}

function writeTree(dir, files) {
  rmSync(dir, { recursive: true, force: true });
  for (const [rel, contents] of files) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
}

// ─── Load every definition ───────────────────────────────────────────────────

if (!existsSync(SRC)) {
  console.error(`No libraries-src/ directory at ${SRC}`);
  process.exit(1);
}

const sources = readdirSync(SRC)
  .filter((f) => f.endsWith(".lib.mjs"))
  .sort();

if (sources.length === 0) {
  console.error("libraries-src/ has no *.lib.mjs definitions");
  process.exit(1);
}

const built = [];
for (const file of sources) {
  const mod = await import(pathToFileURL(join(SRC, file)).href);
  const lib = mod.default;
  if (!lib || !lib.meta || !lib.project) {
    console.error(`${file}: default export must be the result of library({...})`);
    process.exit(1);
  }
  if (lib.meta.slug !== file.replace(/\.lib\.mjs$/, "")) {
    console.error(`${file}: slug "${lib.meta.slug}" does not match the file name`);
    process.exit(1);
  }
  built.push(lib);
}

built.sort((a, b) => a.meta.slug.localeCompare(b.meta.slug));

// ─── Emit ────────────────────────────────────────────────────────────────────

const catalog = {
  // The website reads this. It is the ONLY place marketplace metadata lives —
  // keeping it out of the library folders is what lets an install be a copy.
  $comment: "Generated by scripts/build.mjs — do not edit by hand.",
  generatedFrom: "libraries-src/*.lib.mjs",
  count: built.length,
  libraries: built.map((l) => l.meta),
};

let drift = 0;
for (const lib of built) {
  const dir = join(OUT, lib.meta.slug);
  const files = filesFor(lib.meta.slug, lib.project);

  if (CHECK) {
    const onDisk = readTree(dir);
    for (const [rel, contents] of files) {
      if (onDisk.get(rel) !== contents) {
        console.error(`drift: libraries/${lib.meta.slug}/${rel}`);
        drift++;
      }
    }
    for (const rel of onDisk.keys()) {
      if (!files.has(rel)) {
        console.error(`stale: libraries/${lib.meta.slug}/${rel}`);
        drift++;
      }
    }
  } else {
    writeTree(dir, files);
  }
}

const catalogPath = join(ROOT, "catalog.json");
const catalogText = json(catalog);
if (CHECK) {
  const onDisk = existsSync(catalogPath) ? readFileSync(catalogPath, "utf8") : "";
  if (onDisk !== catalogText) {
    console.error("drift: catalog.json");
    drift++;
  }
  // A library folder with no definition behind it is the other half of drift:
  // it would install something nobody can rebuild.
  if (existsSync(OUT)) {
    const known = new Set(built.map((l) => l.meta.slug));
    for (const entry of readdirSync(OUT, { withFileTypes: true })) {
      if (entry.isDirectory() && !known.has(entry.name)) {
        console.error(`orphan: libraries/${entry.name}/ has no libraries-src definition`);
        drift++;
      }
    }
  }
} else {
  writeFileSync(catalogPath, catalogText);
}

if (CHECK) {
  if (drift) {
    console.error(`\n${drift} file(s) differ from a fresh build. Run: node scripts/build.mjs`);
    process.exit(1);
  }
  console.log(`build --check: clean — ${built.length} libraries match their definitions.`);
} else {
  const fns = built.reduce((n, l) => n + l.meta.functions.length, 0);
  const cmps = built.reduce((n, l) => n + l.meta.components.length, 0);
  console.log(`built ${built.length} libraries — ${fns} functions, ${cmps} components → libraries/, catalog.json`);
}
