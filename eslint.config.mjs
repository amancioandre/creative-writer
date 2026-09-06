// Lint gate for the Obsidian community-plugin review.
// `obsidianmd.configs.recommended` is the same rule set the directory's automated
// review runs (no-static-styles-assignment, prefer-create-el, vault/iterate, …).
// `npm run lint` must pass before any release; see docs/development/publishing.md.
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.*"] },
      },
    },
    rules: {
      // Not part of the directory's automated review, and it misreads product names (Ollama, Zen Mode) as casing slips.
      "obsidianmd/ui/sentence-case": "off",
    },
  },
  { ignores: ["main.js", "node_modules/**", "coverage/**", "docs/**", "data/**", "eval/**", "scripts/**", "tests/**", "*.mjs", "*.config.ts"] },
]);
