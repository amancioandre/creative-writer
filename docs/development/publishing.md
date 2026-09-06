# Publishing to the Obsidian community plugin list

What Obsidian requires, and where this repo stands.

## Already in place

- `manifest.json` — `id` (`creative-writer`, must never change), `name`, `version`, `minAppVersion`, `description`, `author`, `isDesktopOnly: true`.
- `versions.json` — maps plugin version → minimum app version. Updated by `npm version`.
- `LICENSE` — MIT, plus CC-BY attribution for the bundled concreteness norms.
- `README.md` — what it does, how to install, settings, data/licensing, model caveats.
- Build: `npm run build` → `main.js` (gitignored; attached to releases, not committed).
- Guidelines compliance checked: no `innerHTML` with untrusted content (model text goes in as text nodes), no default hotkeys, commands named without the plugin name, sentence-case settings, `onunload` restores the body class, no `console.log`, no Node/Electron APIs (the only network call goes through `requestUrl`).
- `npm run lint` runs the directory's own rule set locally: `eslint-plugin-obsidianmd` (recommended config, warnings fail) and stylelint with `stylelint-no-unsupported-browser-features` against the Chromium behind Obsidian 1.6.5 (`.browserslistrc`). CI, `release:check` and the release workflow all run it, so a failing lint never becomes a release.

## Submitting (current process — https://docs.obsidian.md/plugins/releasing/submit-plugin)

Submission is through the **community directory**, not a pull request:

1. Repository has `README.md`, `LICENSE` and `manifest.json` at the root, and the plugin `id` is unique and does not contain "obsidian". ✅
2. A GitHub release exists whose tag equals `manifest.version`, with `main.js`, `manifest.json`, `styles.css` attached. CI does this on every version tag.
3. Sign in at https://community.obsidian.md with your Obsidian account, link your GitHub profile, and add the plugin by repository.
4. The automated review reads `manifest.json` at the HEAD of the default branch and checks the matching release. Errors block installation; warnings don't.
5. **To get re-reviewed after fixes, publish a new release with an incremented version** — the directory does not re-check an existing version.

## Each later release (and every review round)

```bash
npm run release:check    # lint + build + tests + version check; fix everything before bumping
npm version patch        # or minor/major — bumps package.json, manifest.json, versions.json; commits + tags
git push --follow-tags
```
CI lints, builds, attests and creates the release; the directory picks up the new version and re-runs its review. Users on the community list get the update automatically.

## What the review has failed on, and the rule that now catches it

The 0.8.0 review (2026-09-05) failed on `no-static-styles-assignment` and warned on `prefer-create-el`, a deprecated `caretRangeFromPoint`, a partially supported `text-decoration` and a duplicate `display`. Each is now a lint error:

| Habit | Rule | Do instead |
|---|---|---|
| `el.style.left = "50%"` | `obsidianmd/no-static-styles-assignment` | a class in `styles.css`; `el.setCssStyles({...})` or `el.setCssProps({ "--var": v })` for runtime values |
| `document.createElement("div")` | `obsidianmd/prefer-create-el` | `parent.createDiv({ cls, text, title })`, `createSpan`, `createEl` (they exist on SVG nodes too) |
| `document.caretRangeFromPoint` | `@typescript-eslint/no-deprecated` (disable comments are forbidden) | `caretPositionFromPoint` |
| `String(value)` on `unknown` | `@typescript-eslint/no-base-to-string` | narrow with `typeof` first |
| `text-decoration-style: dashed` and friends | `plugin/no-unsupported-browser-features` | `border-bottom: 1px dashed …` |
| two `display:` in one rule | `declaration-block-no-duplicate-properties` | keep one |

"Vault enumeration" and "clipboard access" appear as recommendations, not failures; they are what the board and the writer-protocol command do, and the README says so.

## Things a reviewer may ask about

- **Bundle size** (~600 KB): `compromise` and the concreteness norms. Both are justified in the README; the model assistant is optional and off by default.
- **`isDesktopOnly`**: true because the model features assume a local Ollama. Everything else would work on mobile; if you ever want mobile, gate the model settings behind `Platform.isDesktop` and flip the flag.
- **Plaintext API key** (Claude path, currently dormant): the settings description says so explicitly. Reviewers like that.
- **`data/` directory** (1.6 MB source norms): only used by `npm run build:concreteness`; not shipped. Fine to keep, or move to a release asset if repo size matters.
