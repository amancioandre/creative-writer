#!/usr/bin/env node
/**
 * Copies the built plugin into a vault's plugin folder.
 *
 *   npm run install:vault -- /path/to/vault
 *   OBSIDIAN_VAULT=/path/to/vault npm run install:vault
 *
 * Run `npm run build` first (or `npm run dev` for watch mode). After the copy,
 * reload Obsidian (Ctrl/Cmd+R) or use the Hot Reload community plugin.
 */
import { cp, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const vault = process.argv[2] ?? process.env.OBSIDIAN_VAULT;
if (!vault) {
  console.error("Usage: npm run install:vault -- <vault-path>   (or set OBSIDIAN_VAULT)");
  process.exit(1);
}

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const target = path.join(vault, ".obsidian", "plugins", manifest.id);

try {
  await stat(path.join(vault, ".obsidian"));
} catch {
  console.error(`${vault} does not look like an Obsidian vault (no .obsidian directory).`);
  process.exit(1);
}
try {
  await stat("main.js");
} catch {
  console.error("main.js not found — run `npm run build` first.");
  process.exit(1);
}

await mkdir(target, { recursive: true });
for (const f of ["main.js", "manifest.json", "styles.css"]) await cp(f, path.join(target, f));
console.log(`Installed ${manifest.id} v${manifest.version} → ${target}`);
console.log("Enable it under Settings → Community plugins, then reload Obsidian.");
