# Publishing to the Obsidian community plugin list

What Obsidian requires, and where this repo stands.

## Already in place

- `manifest.json` — `id` (`creative-writer`, must never change), `name`, `version`, `minAppVersion`, `description`, `author`, `isDesktopOnly: true`.
- `versions.json` — maps plugin version → minimum app version. Updated by `npm version`.
- `LICENSE` — MIT, plus CC-BY attribution for the bundled concreteness norms.
- `README.md` — what it does, how to install, settings, data/licensing, model caveats.
- Build: `npm run build` → `main.js` (gitignored; attached to releases, not committed).
- Guidelines compliance checked: no `innerHTML` with untrusted content (model text goes in as text nodes), no default hotkeys, commands named without the plugin name, sentence-case settings, `onunload` restores the body class, no `console.log`, no Node/Electron APIs (the only network call goes through `requestUrl`).

## Submitting (current process — https://docs.obsidian.md/plugins/releasing/submit-plugin)

Submission is through the **community directory**, not a pull request:

1. Repository has `README.md`, `LICENSE` and `manifest.json` at the root, and the plugin `id` is unique and does not contain "obsidian". ✅
2. A GitHub release exists whose tag equals `manifest.version`, with `main.js`, `manifest.json`, `styles.css` attached. CI does this on every version tag.
3. Sign in at https://community.obsidian.md with your Obsidian account, link your GitHub profile, and add the plugin by repository.
4. The automated review reads `manifest.json` at the HEAD of the default branch and checks the matching release. Errors block installation; warnings don't.
5. **To get re-reviewed after fixes, publish a new release with an incremented version** — the directory does not re-check an existing version.

## Each later release (and every review round)

```bash
npm version patch        # or minor/major — bumps package.json, manifest.json, versions.json; commits + tags
npm run release:check
git push --follow-tags
```
CI builds, attests and creates the release; the directory picks up the new version and re-runs its review. Users on the community list get the update automatically.

## Things a reviewer may ask about

- **Bundle size** (~600 KB): `compromise` and the concreteness norms. Both are justified in the README; the model assistant is optional and off by default.
- **`isDesktopOnly`**: true because the model features assume a local Ollama. Everything else would work on mobile; if you ever want mobile, gate the model settings behind `Platform.isDesktop` and flip the flag.
- **Plaintext API key** (Claude path, currently dormant): the settings description says so explicitly. Reviewers like that.
- **`data/` directory** (1.6 MB source norms): only used by `npm run build:concreteness`; not shipped. Fine to keep, or move to a release asset if repo size matters.
