// Copies the static export (out/) into the repo's docs/ folder, which
// GitHub Pages serves at https://awomoon.github.io/shoka/.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const landing = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(landing, "out");
const docs = path.resolve(landing, "..", "docs");

if (!existsSync(out)) {
  console.error("out/ not found — run `next build` first.");
  process.exit(1);
}

rmSync(docs, { recursive: true, force: true });
mkdirSync(docs, { recursive: true });
cpSync(out, docs, { recursive: true });
// GitHub Pages runs Jekyll by default, which drops _next/; this disables it.
writeFileSync(path.join(docs, ".nojekyll"), "");
console.log(`Exported ${out} -> ${docs}`);
