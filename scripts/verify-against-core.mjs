#!/usr/bin/env node
// ─── verify-against-core.mjs — the check only the real thing can make ────────
//
//   ETYMA_REPO=/path/to/Etyma node scripts/verify-against-core.mjs
//
// `validate.mjs` checks this repository's own rules and knows nothing about
// Etyma's. This loads each built library through the REAL `WorkspaceStorage`
// and runs the REAL `validateModule` over it — the same two pieces of code that
// run when a developer opens the folder in the IDE.
//
// It is deliberately NOT part of `npm test`, because it needs a checkout of the
// Etyma repository with `packages/core` built, which a contributor cloning only
// this repository will not have. When that checkout is present — on a
// maintainer's machine, and in the release job — this is the gate that matters:
// everything else is our opinion about the model, and this is the model's.
//
// Absent ETYMA_REPO it exits 0 with a line saying it was skipped. A check that
// fails for being unavailable teaches people to ignore it.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "libraries");
const repo = process.env.ETYMA_REPO;

if (!repo) {
  console.log("verify-against-core: skipped — set ETYMA_REPO to a checkout with packages/core built.");
  process.exit(0);
}

const corePath = join(repo, "packages/core/dist/index.js");
if (!existsSync(corePath)) {
  console.error(`verify-against-core: ${corePath} not found. Run \`pnpm build\` in ${repo}.`);
  process.exit(1);
}

const core = await import(pathToFileURL(corePath).href);
const { WorkspaceStorage, MemoryFs, createSolution, validateModule } = core.default ?? core;

/** Copy a built library folder into an in-memory `.etyma/projects/<slug>/`. */
function seed(fs, slug) {
  const dir = join(OUT, slug);
  const walk = (d, prefix) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else fs.writeText(`.etyma/projects/${slug}/${rel}`, readFileSync(full, "utf8"));
    }
  };
  walk(dir, "");
}

const slugs = readdirSync(OUT, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

let failed = 0;
for (const slug of slugs) {
  const fs = new MemoryFs();
  const solution = createSolution(`Verify ${slug}`);
  fs.writeText(".etyma/solution.json", JSON.stringify(solution, null, 2));
  seed(fs, slug);

  let project;
  try {
    const storage = new WorkspaceStorage(fs);
    // `loadProject` takes the project's ID, not its folder name — the folder is
    // cosmetic and the id inside project.json is the identity. Discovering it
    // through `listProjects` is also the check that the folder is readable at
    // all: a malformed project.json never reaches the listing.
    const listed = await storage.listProjects();
    const meta = listed.find((m) => m.name && m.id);
    if (!meta) throw new Error("listProjects found nothing — project.json is unreadable");
    project = await storage.loadProject(meta.id);
    if (!project) throw new Error(`loadProject(${meta.id}) returned nothing`);
  } catch (err) {
    console.log(`✗ ${slug}: WorkspaceStorage could not load it — ${err.message}`);
    failed++;
    continue;
  }

  const issues = validateModule(project) ?? [];
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity !== "error");

  if (errors.length) {
    console.log(`✗ ${slug}: ${errors.length} validation error(s)`);
    for (const i of errors.slice(0, 8)) console.log(`    ${i.rule ?? ""} ${i.message}`);
    failed++;
  } else {
    console.log(`✓ ${slug}: loads and validates${warnings.length ? ` (${warnings.length} warning(s))` : ""}`);
    for (const i of warnings.slice(0, 4)) console.log(`    △ ${i.rule ?? ""} ${i.message}`);
  }
}

if (failed) {
  console.log(`\n${failed}/${slugs.length} libraries would not load or validate in the IDE.`);
  process.exit(1);
}
console.log(`\nverify-against-core: all ${slugs.length} libraries load and validate against real core.`);
