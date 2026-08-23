# Publishing to the Obsidian community plugin list

What Obsidian requires, and where this repo stands.

## Already in place

- `manifest.json` — `id` (`creative-zen-mode`, must never change), `name`, `version`, `minAppVersion`, `description`, `author`, `isDesktopOnly: true`.
- `versions.json` — maps plugin version → minimum app version. Updated by `npm version`.
- `LICENSE` — MIT, plus CC-BY attribution for the bundled concreteness norms.
- `README.md` — what it does, how to install, settings, data/licensing, model caveats.
- Build: `npm run build` → `main.js` (gitignored; attached to releases, not committed).
- Guidelines compliance checked: no `innerHTML` with untrusted content (model text goes in as text nodes), no default hotkeys, commands named without the plugin name, sentence-case settings, `onunload` restores the body class, no `console.log`, no Node/Electron APIs (the only network call goes through `requestUrl`).

## Before the first release

1. **Fill in `author`/`authorUrl`** in `manifest.json` if you want a link (`authorUrl` is optional; `fundingUrl` too).
2. **Create a public GitHub repository** and push `main`. Any name is fine; the plugin `id` is what matters.
3. **Tag a release whose tag is exactly the version** — `0.1.0`, no `v` prefix:
   ```bash
   npm run release:check
   git tag 0.1.0 && git push --tags
   ```
   Then on GitHub create a release from that tag and attach **`main.js`, `manifest.json`, `styles.css`** as individual assets (not a zip).
4. **Submit**: fork `obsidianmd/obsidian-releases`, add an entry to the end of `community-plugins.json`:
   ```json
   { "id": "creative-zen-mode", "name": "Creative Zen Mode", "author": "André Amancio", "description": "…same as manifest…", "repo": "<github-user>/<repo>" }
   ```
   and open a PR titled `Add plugin: Creative Zen Mode`. A bot validates the manifest and release assets; a reviewer then reads the code. Expect a few weeks.

## Each later release

```bash
npm version 0.2.0        # bumps package.json, manifest.json, versions.json; commits
npm run release:check
git push && git push --tags
```
Attach the three files to the GitHub release as before. Users on the community list get the update automatically.

## Things a reviewer may ask about

- **Bundle size** (~600 KB): `compromise` and the concreteness norms. Both are justified in the README; the model assistant is optional and off by default.
- **`isDesktopOnly`**: true because the model features assume a local Ollama. Everything else would work on mobile; if you ever want mobile, gate the model settings behind `Platform.isDesktop` and flip the flag.
- **Plaintext API key** (Claude path, currently dormant): the settings description says so explicitly. Reviewers like that.
- **`data/` directory** (1.6 MB source norms): only used by `npm run build:concreteness`; not shipped. Fine to keep, or move to a release asset if repo size matters.
