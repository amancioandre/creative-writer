# Creative Writer (Obsidian plugin)

## Before any commit

```bash
npm run lint        # eslint (Obsidian's own rule set) + stylelint; warnings fail
npm run build       # typecheck + bundle
npm test
```

`npm run release:check` runs all three; CI and the release workflow run them too, so a tag whose lint fails never becomes a release. Do not skip or disable a rule to get past it. If a rule is wrong for this project, turn it off in `eslint.config.mjs` with a comment saying why.

## The Obsidian directory review

Every release is re-reviewed by the community directory with the rules in `eslint-plugin-obsidianmd` and a CSS browser-support check. The 0.8.0 review failed on things that are easy to write by habit. These are the rules, in the words of the review:

- **Never assign `element.style.x = "..."`** (`no-static-styles-assignment`, an error). Static values go in a CSS class in `styles.css`. Values computed at runtime go through `el.setCssStyles({ left: "12px" })` or, for custom properties, `el.setCssProps({ "--czm-group": colour })`.
- **Never call `document.createElement`** (`prefer-create-el`). Use `parent.createDiv({ cls, text, title })`, `parent.createSpan(...)`, `parent.createEl("button", ...)`. Obsidian puts these on `Node`, so they work on SVG `foreignObject` too. `document.createElementNS` for SVG is fine.
- **No deprecated DOM APIs** (`@typescript-eslint/no-deprecated`, and the config forbids `eslint-disable` for it). `caretRangeFromPoint` is out; `caretPositionFromPoint` is in.
- **`String(x)` on an `unknown`** is an error (`no-base-to-string`). Narrow with `typeof x === "string"` first.
- **CSS: nothing only partially supported** by the Chromium behind Obsidian 1.6.5 (`stylelint-no-unsupported-browser-features`, browserslist in `.browserslistrc`). Styled underlines (`text-decoration-style`, `-color`, `-line`, and the shorthand with a style or colour) are the known trap; use a `border-bottom` instead.
- **CSS: no duplicate properties** in one rule (`declaration-block-no-duplicate-properties`).
- Also on the review's list and already respected: no `innerHTML` with untrusted content, no default hotkeys, no plugin name in command names, sentence case in the UI, `onunload` restores what `onload` set, no Node or Electron imports, one network path through `requestUrl`.

Vault enumeration and clipboard access show up as "Recommendation" in the review. They are inherent to the plugin (the board scans tags; the writer protocol command copies text) and are documented in the README, not something to remove.

## Tests and the DOM

`tests/setup.ts` mirrors the Obsidian DOM helpers in jsdom (`createEl`/`createDiv`/`createSpan` on `Node`, `setCssStyles`/`setCssProps` on `HTMLElement`). When source starts using another Obsidian helper, add it there and to the `declare global` block in `tests/stubs/obsidian.ts`, and stub the standard API in tests, never the deprecated one.

## QA in a vault

After a user-visible change: `npm run build`, `npm run install:vault -- /home/apollo/obsidian-dev` (and `/home/apollo/obsidian`), write a dated QA note into obsidian-dev, open it with `xdg-open "obsidian://open?vault=obsidian-dev&file=<name>"`. Run npm from the repo directory. See `docs/development/publishing.md` for the release steps.
