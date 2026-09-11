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
// Marketplace metadata for CONTRIBUTED libraries, kept outside the folder so the
// folder stays a byte-identical copy of `.etyma/projects/<slug>/`.
const META = join(ROOT, "meta");
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

// ─── Contributed libraries ───────────────────────────────────────────────────
//
// A library does not have to be written as code. The second — and better —
// authoring path is to build the module IN the IDE and export it, because
// "dogfood through the IDE, never around it" applies to us more than to anyone:
// a marketplace whose only authors write JS builders is a marketplace where
// nobody ever finds out what authoring a library actually feels like.
//
// Such a library arrives as the folder itself, already in exactly this layout,
// with its marketplace metadata in `meta/<slug>.json` — kept OUTSIDE the folder
// so the folder stays a byte-identical copy of `.etyma/projects/<slug>/`.
//
// It is validated like every other entry but never regenerated: there is no
// definition to regenerate it from, and inventing one would mean this
// repository silently rewriting somebody's module.

const contributed = [];
if (existsSync(OUT)) {
  const generated = new Set(built.map((l) => l.meta.slug));
  for (const entry of readdirSync(OUT, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || generated.has(entry.name)) continue;
    const slug = entry.name;
    const metaPath = join(META, `${slug}.json`);
    const projectPath = join(OUT, slug, "project.json");

    if (!existsSync(projectPath)) {
      console.error(`libraries/${slug}/: no project.json — this is not a module folder`);
      process.exit(1);
    }
    if (!existsSync(metaPath)) {
      console.error(
        `libraries/${slug}/ has no definition in libraries-src/ and no meta/${slug}.json.\n` +
          `  A contributed library needs its marketplace metadata in meta/${slug}.json ` +
          `(name, tagline, category, tags, version, license).`,
      );
      process.exit(1);
    }
    contributed.push({ slug, meta: JSON.parse(readFileSync(metaPath, "utf8")), projectPath });
  }
}

/** Catalogue metadata for a contributed folder: the declared half plus what the model says. */
function contributedMeta({ slug, meta, projectPath }) {
  const project = JSON.parse(readFileSync(projectPath, "utf8"));
  const read = (dir) => {
    const d = join(OUT, slug, dir);
    if (!existsSync(d)) return [];
    return readdirSync(d)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => JSON.parse(readFileSync(join(d, f), "utf8")));
  };
  const actions = read("actions");
  const blocks = read("blocks");
  return {
    slug,
    name: meta.name || project.name,
    tagline: meta.tagline || meta.description || project.description || "",
    description: meta.description || project.description || "",
    category: meta.category || "Utilities",
    kind: blocks.length && !actions.length ? "ui" : actions.length && !blocks.length ? "logic" : "mixed",
    version: meta.version || "1.0.0",
    tags: meta.tags || [],
    // Says where it came from, because a reader deserves to know whether this
    // was curated here or contributed from someone's app.
    source: "contributed",
    ...(meta.author ? { author: meta.author } : {}),
    ...(meta.license ? { license: meta.license } : {}),
    ...(meta.notes ? { notes: meta.notes } : {}),
    ...surfaceOf(project, actions, blocks),
    download: `bundles/${slug}.json`,
  };
}

// ─── The retrieval contract ──────────────────────────────────────────────────
//
// What the Assistant searches. This is core's `CatalogEntry` (`catalogEntry` in
// packages/core/src/marketplaceCatalog.ts): the PUBLIC functions with their
// descriptions and params, the public components with their props, the npm
// packages, the module id, and where the folder is. `verify-against-core.mjs`
// holds every entry here to what the real `catalogEntry` computes from the same
// folder, so a description the Assistant reads is one a consumer can call.
function surfaceOf(project, actions, blocks) {
  const isPublicFn = (a) => a.isPublic && a.scope === "server";
  return {
    kind: "library",
    moduleId: project.id,
    functions: actions.filter(isPublicFn).map((a) => ({
      name: a.name,
      ...(a.description && a.description.trim() ? { description: a.description.trim() } : {}),
      params: (a.parameters || []).map((x) => x.name),
      ...(a.returnType ? { returns: String(a.returnType) } : {}),
    })),
    components: blocks.filter((b) => b.isPublic).map((b) => ({
      name: b.name,
      ...(b.description && b.description.trim() ? { description: b.description.trim() } : {}),
      props: (b.inputParameters || []).map((x) => x.name),
    })),
    packages: (project.npmPackages || []).map((x) => ({ name: x.name, version: x.version })),
  };
}

// ─── Emit ────────────────────────────────────────────────────────────────────

/** A curated library's entry: its declared metadata, then the surface read from the model it built. */
function curatedEntry(lib) {
  const { functions: _f, components: _c, packages: _p, ...meta } = lib.meta;
  const project = lib.project;
  const surface = surfaceOf({ ...project, slug: lib.meta.slug }, project.actions || [], project.blocks || []);
  return { ...meta, ...surface, kind: "library", download: `bundles/${lib.meta.slug}.json` };
}

const catalog = {
  // The website reads this. It is the ONLY place marketplace metadata lives —
  // keeping it out of the library folders is what lets an install be a copy.
  $comment: "Generated by scripts/build.mjs — do not edit by hand.",
  generatedFrom: "libraries-src/*.lib.mjs",
  count: built.length + contributed.length,
  libraries: [
    ...built.map((l) => ({ ...curatedEntry(l), source: "curated" })),
    ...contributed.map(contributedMeta),
  ].sort((a, b) => a.slug.localeCompare(b.slug)),
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

// ─── Bundles: one request per install ────────────────────────────────────────
//
// A folder cannot be fetched from a static host in one request, and an install
// from the Assistant (`install_library`) or `etyma fetch` wants exactly what the
// registry's download route answers: `{ slug, version, files: { path: base64 } }`.
// So every library also ships as `bundles/<slug>.json` — generated, checked for
// drift like the folders, and named by each catalogue entry's `download`. A raw
// clone of this repository is thereby a complete marketplace with no server.
const BUNDLES = join(ROOT, "bundles");
const bundleFor = (slug, version, files) => {
  const encoded = {};
  for (const [rel, contents] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) encoded[rel] = Buffer.from(contents, "utf8").toString("base64");
  return json({ $comment: "Generated by scripts/build.mjs — the folder libraries/<slug>/ as one download.", slug, version, files: encoded });
};
const bundles = new Map();
for (const lib of built) bundles.set(lib.meta.slug, bundleFor(lib.meta.slug, lib.meta.version, filesFor(lib.meta.slug, lib.project)));
for (const c of contributed) bundles.set(c.slug, bundleFor(c.slug, c.meta.version || "1.0.0", readTree(join(OUT, c.slug))));
for (const [slug, text] of bundles) {
  const path = join(BUNDLES, `${slug}.json`);
  if (CHECK) {
    if ((existsSync(path) ? readFileSync(path, "utf8") : "") !== text) { console.error(`drift: bundles/${slug}.json`); drift++; }
  } else {
    mkdirSync(BUNDLES, { recursive: true });
    writeFileSync(path, text);
  }
}
if (!CHECK && existsSync(BUNDLES)) {
  for (const f of readdirSync(BUNDLES)) if (f.endsWith(".json") && !bundles.has(f.slice(0, -5))) rmSync(join(BUNDLES, f));
}

const catalogPath = join(ROOT, "catalog.json");
const catalogText = json(catalog);
if (CHECK) {
  const onDisk = existsSync(catalogPath) ? readFileSync(catalogPath, "utf8") : "";
  if (onDisk !== catalogText) {
    console.error("drift: catalog.json");
    drift++;
  }
  // A curated folder with no definition behind it would be an install nobody
  // can rebuild — but a CONTRIBUTED one has no definition by design, and the
  // loader above has already refused any folder that is neither.
} else {
  writeFileSync(catalogPath, catalogText);
}

if (CHECK) {
  if (drift) {
    console.error(`\n${drift} file(s) differ from a fresh build. Run: node scripts/build.mjs`);
    process.exit(1);
  }
  console.log(
    `build --check: clean — ${built.length} curated librar${built.length === 1 ? 'y' : 'ies'} match their definitions` +
      `${contributed.length ? `, ${contributed.length} contributed left as authored` : ''}.`,
  );
} else {
  const fns = catalog.libraries.reduce((n, l) => n + l.functions.length, 0);
  const cmps = catalog.libraries.reduce((n, l) => n + l.components.length, 0);
  console.log(
    `built ${built.length} curated + ${contributed.length} contributed = ${catalog.count} libraries — ` +
      `${fns} functions, ${cmps} components → libraries/, catalog.json`,
  );
}
