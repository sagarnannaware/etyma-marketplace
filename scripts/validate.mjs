#!/usr/bin/env node
// ─── validate.mjs — would this library actually work? ────────────────────────
//
//   node scripts/validate.mjs
//
// A marketplace's whole promise is "install this and it works". The cost of
// breaking that promise is not a failed build — it is a developer who installs
// something, wires it into a flow, exports, and finds out at `npm run build` in
// a generated app that the export they were told about does not exist. That is
// an afternoon, and it happens where none of our error messages reach.
//
// So this checks the things that would only otherwise surface there:
//   • every CallFunction names a package the library declares, and an export
//     that package's manifest describes, with an argument count its signature
//     accepts
//   • every argument expression resolves to a declared parameter or is a
//     literal
//   • every flow is a connected Start → … → End with exactly one call
//   • every code component parses, exports a default, and imports only what
//     Etyma allows
//   • no Tailwind palette literal anywhere — a marketplace component that
//     hard-codes bg-blue-600 is unusable in an app with a theme
//   • ids are unique across the WHOLE marketplace, not just within a library,
//     because two libraries installed into one solution share an id space
//
// It reads the BUILT output, never the definitions: the built folder is what a
// developer installs, so it is what has to be right.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isAllowedImport, isLocalImport } from "../lib/allowed-imports.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "libraries");

const problems = [];
const fail = (where, msg) => problems.push({ level: "error", where, msg });
const warn = (where, msg) => problems.push({ level: "warn", where, msg });

// ─── Tailwind palette literals ───────────────────────────────────────────────
//
// The theme is `Solution.theme.tokens`; a component that reaches past it for a
// literal hue is a component that looks wrong in every app but the one it was
// written in, and unreadable in the other colour scheme. Same rule as the
// extension's own `tokens.test.ts`.
const PALETTE = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|outline|decoration|divide|accent|caret|placeholder)-(?:slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

/** Import specifiers of an ES module source, without parsing it properly. */
function scanImports(source) {
  const specs = [];
  const patterns = [
    /\bimport\s+[^'"]*?from\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bexport\s+[^'"]*?from\s*["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(source))) specs.push(m[1]);
  }
  return specs;
}

/** Parameter names an expression reads: "{{a}} and {{b}}" → ["a","b"]. */
function readsOf(expr) {
  if (typeof expr !== "string") return [];
  const out = [];
  // A "{{= ... }}" block is authored JavaScript, not a parameter reference.
  const re = /\{\{(?!=)\s*([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(expr))) out.push(m[1]);
  return out;
}

if (!existsSync(OUT)) {
  console.error("No libraries/ directory — run `node scripts/build.mjs` first.");
  process.exit(1);
}

const slugs = readdirSync(OUT, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

if (!slugs.length) {
  console.error("libraries/ is empty — run `node scripts/build.mjs` first.");
  process.exit(1);
}

// Every id in the marketplace, so a collision across two libraries is caught:
// a developer may install both into one solution, where ids must be unique.
const idOwners = new Map();
let actionCount = 0;
let componentCount = 0;

for (const slug of slugs) {
  const dir = join(OUT, slug);
  const at = (rest) => `${slug}${rest ? `/${rest}` : ""}`;

  const projectPath = join(dir, "project.json");
  if (!existsSync(projectPath)) {
    fail(at(), "no project.json");
    continue;
  }
  const project = JSON.parse(readFileSync(projectPath, "utf8"));

  // ── The module itself ──────────────────────────────────────────────────────
  if (project.type !== "library") fail(at("project.json"), `type is "${project.type}", must be "library"`);
  if (project.pages && project.pages.length) fail(at("project.json"), "a library cannot own pages");
  if (project.entities && project.entities.length) fail(at("project.json"), "a library cannot own entities");
  if (project.integrations && project.integrations.length) fail(at("project.json"), "a library cannot own integrations");
  if (project.solutionId) fail(at("project.json"), "a marketplace library must not name a solutionId — the importer stamps it");

  const claim = (id, where) => {
    if (!id) return fail(where, "missing id");
    const prev = idOwners.get(id);
    if (prev) fail(where, `id ${id} collides with ${prev}`);
    else idOwners.set(id, where);
  };
  claim(project.id, at("project.json"));

  // ── Declared packages ──────────────────────────────────────────────────────
  const packages = new Map();
  for (const manifest of project.npmPackages || []) {
    packages.set(manifest.name, manifest);
    if (!/^\d+\.\d+\.\d+/.test(manifest.version || "")) {
      fail(at("project.json"), `${manifest.name}: version "${manifest.version}" is not exact`);
    }
    if (manifest.typesSource === "@types" && !manifest.typesVersion) {
      fail(at("project.json"), `${manifest.name}: typesSource "@types" but no typesVersion — the export will not type-check`);
    }
    if (!manifest.functions || !manifest.functions.length) {
      warn(at("project.json"), `${manifest.name}: declares no functions, so nothing can call it`);
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  const actionsDir = join(dir, "actions");
  const actionFiles = existsSync(actionsDir) ? readdirSync(actionsDir).filter((f) => f.endsWith(".json")).sort() : [];
  for (const file of actionFiles) {
    actionCount++;
    const where = at(`actions/${file}`);
    const action = JSON.parse(readFileSync(join(actionsDir, file), "utf8"));
    claim(action.id, where);

    if (action.scope !== "server") fail(where, `scope is "${action.scope}" — a library function must be server scope`);
    if (action.isPublic !== true) fail(where, "not isPublic — a library function nobody can call is dead weight");
    if (!action.description) warn(where, "no description — this is what a developer reads in the marketplace");

    const nodes = action.nodes || [];
    const edges = action.edges || [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const n of nodes) claim(n.id, `${where}#${n.type}`);

    const starts = nodes.filter((n) => n.type === "Start");
    const ends = nodes.filter((n) => n.type === "End");
    if (starts.length !== 1) fail(where, `${starts.length} Start nodes, expected exactly 1`);
    if (ends.length !== 1) fail(where, `${ends.length} End nodes, expected exactly 1`);

    // The graph must be one connected path from Start to End: an orphan node is
    // silently skipped at export, which is the worst kind of wrong.
    if (starts.length === 1 && ends.length === 1) {
      const next = new Map();
      for (const e of edges) {
        if (!byId.has(e.source)) fail(where, `edge from unknown node ${e.source}`);
        if (!byId.has(e.target)) fail(where, `edge to unknown node ${e.target}`);
        next.set(e.source, e.target);
      }
      const seen = new Set();
      let cur = starts[0].id;
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        cur = next.get(cur);
      }
      if (!seen.has(ends[0].id)) fail(where, "the flow does not reach its End node");
      const orphans = nodes.filter((n) => !seen.has(n.id));
      if (orphans.length) fail(where, `${orphans.length} node(s) not on the path: ${orphans.map((n) => n.type).join(", ")}`);
    }

    const calls = nodes.filter((n) => n.type === "CallFunction");
    // A function does something when a node other than Start and End is on the path — a
    // CallFunction over a package, or an Assign whose expression IS the function (a pivot, a
    // slug, a Luhn check need no package). An empty flow is the one that does nothing.
    const working = nodes.filter((n) => n.type !== "Start" && n.type !== "End");
    if (working.length < 1) fail(where, "no node between Start and End — the function does nothing");
    // A straight line of up to four calls. Past that it is application logic
    // wearing a library's clothes, and the consumer should own it.
    if (calls.length > 4) fail(where, `${calls.length} CallFunction nodes — split this; a library function is one idea`);

    const paramNames = new Set((action.parameters || []).map((p) => p.name));
    for (const p of action.parameters || []) claim(p.id, `${where}#param:${p.name}`);

    // A later call may read an earlier one's output. Names become readable in
    // flow order, so a forward reference is caught rather than silently empty.
    const inScope = new Set(paramNames);
    for (const call of calls) {
      const { packageName, exportName, args } = call.data || {};
      const manifest = packages.get(packageName);
      if (!manifest) {
        fail(where, `calls package "${packageName}" which the library does not declare`);
        continue;
      }
      const signature = (manifest.functions || []).find((f) => f.export === exportName);
      if (!signature) {
        fail(where, `calls ${packageName}.${exportName}, not described in that package's manifest`);
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse(args || "[]");
      } catch {
        fail(where, `args is not valid JSON: ${args}`);
        continue;
      }
      if (!Array.isArray(parsed)) {
        fail(where, "args must be a JSON array, positionally matched to the export");
        continue;
      }
      const required = (signature.params || []).filter((p) => !p.optional).length;
      const total = (signature.params || []).length;
      if (parsed.length < required || parsed.length > total) {
        fail(
          where,
          `${packageName}.${exportName} takes ${required === total ? total : `${required}–${total}`} argument(s), ${parsed.length} given`,
        );
      }
      for (const expr of parsed) {
        for (const name of readsOf(expr)) {
          // `settings`, `resources`, `session` and `Entities` are in scope of
          // every expression; anything else must be a declared parameter or an
          // earlier call's output.
          if (["settings", "resources", "session", "Entities"].includes(name)) continue;
          if (!inScope.has(name)) {
            fail(where, `argument reads "{{${name}}}", which is neither a parameter nor the output of an earlier call`);
          }
        }
      }
      // Only now: a call cannot read its own output.
      if (call.data.outputVariable) inScope.add(call.data.outputVariable);
    }
  }

  // ── Code components ────────────────────────────────────────────────────────
  const blocksDir = join(dir, "blocks");
  const blockFiles = existsSync(blocksDir) ? readdirSync(blocksDir).filter((f) => f.endsWith(".json")).sort() : [];
  for (const file of blockFiles) {
    componentCount++;
    const base = file.replace(/\.json$/, "");
    const where = at(`blocks/${file}`);
    const block = JSON.parse(readFileSync(join(blocksDir, file), "utf8"));
    claim(block.id, where);

    if (block.isPublic !== true) fail(where, "not isPublic — a library component nobody can place is dead weight");
    if (block.kind !== "code") {
      fail(where, `kind is "${block.kind}" — marketplace components are code components`);
      continue;
    }
    if (block.source !== undefined) fail(where, "source must live in the .tsx sidecar, never inside the JSON");

    const tsxPath = join(blocksDir, `${base}.tsx`);
    if (!existsSync(tsxPath)) {
      fail(where, `no sidecar blocks/${base}.tsx`);
      continue;
    }
    const source = readFileSync(tsxPath, "utf8");
    const sw = at(`blocks/${base}.tsx`);

    if (!/export\s+default\s/.test(source)) fail(sw, "no default export — the contract requires one");

    for (const spec of scanImports(source)) {
      if (spec.startsWith(".") || spec.startsWith("/")) {
        fail(sw, `relative import "${spec}" — a component may only import @/lib/utils, @/components/<Name>, or an allowed package`);
      } else if (!isAllowedImport(spec)) {
        fail(sw, `imports "${spec}", which is not on Etyma's allow-list`);
      }
    }

    const literals = [...new Set(source.match(PALETTE) || [])];
    if (literals.length) {
      fail(sw, `Tailwind palette literals (use theme tokens): ${literals.slice(0, 6).join(", ")}${literals.length > 6 ? ` +${literals.length - 6}` : ""}`);
    }

    // An event's NAME is the prop, so it must read as one. Core's CODE-004
    // rejects the bare form ("Action" rather than "onAction") and this is the
    // one rule that only surfaced when the real validator ran — worth keeping
    // here so an author sees it at build time instead.
    for (const event of block.events || []) {
      if (!/^on[A-Z][A-Za-z0-9]*$/.test(event.name)) {
        fail(where, `event "${event.name}" must be named on<Name>, e.g. "onAction" — the name IS the React prop`);
      } else if (!new RegExp(`\\b${event.name}\\b`).test(source)) {
        fail(sw, `declares event "${event.name}" but the source never calls that prop`);
      }
    }

    // Props are passed BY NAME. A declared parameter the source never mentions
    // is either a typo or a prop that silently does nothing.
    for (const param of block.inputParameters || []) {
      claim(param.id, `${where}#prop:${param.name}`);
      if (!new RegExp(`\\b${param.name}\\b`).test(source)) {
        warn(sw, `declares prop "${param.name}" but the source never reads it`);
      }
    }
  }

  if (!actionFiles.length && !blockFiles.length) fail(at(), "the library is empty");
}

// ─── catalog.json agrees with what was built ─────────────────────────────────
const catalogPath = join(ROOT, "catalog.json");
if (!existsSync(catalogPath)) {
  fail("catalog.json", "missing — run `node scripts/build.mjs`");
} else {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const listed = new Set((catalog.libraries || []).map((l) => l.slug));
  for (const slug of slugs) if (!listed.has(slug)) fail("catalog.json", `libraries/${slug}/ is not listed`);
  for (const slug of listed) if (!slugs.includes(slug)) fail("catalog.json", `lists "${slug}" with no folder behind it`);
}

// ─── Report ──────────────────────────────────────────────────────────────────
const errors = problems.filter((p) => p.level === "error");
const warnings = problems.filter((p) => p.level === "warn");

for (const p of problems) console.log(`${p.level === "error" ? "✗" : "△"} ${p.where}: ${p.msg}`);

const summary = `${slugs.length} libraries · ${actionCount} functions · ${componentCount} components · ${idOwners.size} ids`;
if (errors.length) {
  console.log(`\n${summary}\n${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(`${problems.length ? "\n" : ""}validate: clean — ${summary}${warnings.length ? `, ${warnings.length} warning(s)` : ""}.`);
