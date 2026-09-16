# Release note: design note

Status: **designed, built and released as 0.11.0 on 2026-09-16.** Domain in `src/domain/release/`, modal in `infrastructure/obsidian/ReleaseNoteModal.ts`, wired from the layout-ready callback in `main.ts`; the UX exploration (update and welcome, light and dark, plus a banner alternate) is the design canvas at https://claude.ai/artifact/BU5RPUic8VgpdVp6b5qUsV, with its artboards under `docs/public/design/release-note/`. Departures: the seen version also advances when the switch is off, so turning it back on later does not replay old notes; the form link is `https://tally.so/r/obJ6AN`; the modal uses Obsidian's own `modal-button-container` for its row. The policy research behind it is summarised in `CLAUDE.md` (Popups, promotion and data collection).

## 1. Why

The plugin has no channel back from the writer except GitHub issues, which most writers never open. A short note shown once after install and once after a meaningful update can say what changed, point to the guide, and ask for two things: how the plugin is working for them, and whether they want to hear about the Creative Suite as it grows. Obsidian allows this as a *static pop-up within the plugin's own interface* provided the README discloses it, and the community welcomes release-note popups when they are rare and quiet.

The note is a **courtesy, not a funnel**. It never blocks, never nags, never sends anything by itself, and can be switched off in one toggle.

## 2. Ubiquitous language

| Term | Meaning |
|---|---|
| **Release note** | The modal itself. One per install, one per minor or major version. The command is *Show release note*. |
| **Seen version** | `settings.releaseNote.seenVersion`, the last `manifest.version` the writer was shown a note for. Empty string on a fresh install. |
| **Welcome** | The variant shown when the seen version is empty: first install. |
| **Update** | The variant shown when the seen version is behind the current one by a minor or major step. |
| **Form** | The external page the note links to, hosted by a form service (§7). It collects feedback and an optional email for the newsletter. |

## 3. When it shows

Pure decision in `domain/release/ReleaseNote.ts`:

```ts
export type NoteKind = "welcome" | "update" | null;
export function releaseNoteKind(seen: string, current: string, enabled: boolean): NoteKind
```

- `enabled` false → `null`, whatever the versions.
- `seen === ""` → `"welcome"`.
- `seen` and `current` differ in **major or minor** → `"update"`. A patch bump (`0.10.0 → 0.10.1`) → `null`; the seen version is still advanced silently so the next minor compares against the right base.
- `seen` newer than `current` (a downgrade, or a synced `data.json` from a machine that updated first) → `null`, and the seen version is left alone.
- Anything unparsable → `null`. Never guess.

Tests cover each row and the persist-before-open order below.

**Where in the lifecycle.** Inside the existing `onLayoutReady` callback in `main.ts`, after `tracker.start()` resolves, so the vault is indexed and the desk has its numbers:

1. Compute the kind.
2. If it is not `null`, **write** `seenVersion = current` and `saveData` first.
3. Then open the modal. A crash between the two costs one missed note, never a recurring one.

Skip, and try again next launch, when Zen Mode is on at layout-ready or when there is no workspace leaf yet (a fresh vault with nothing open still gets it, but a vault mid-restore does not).

**Where the seen version lives.** In `data.json`, so it syncs only with *Installed community plugins* sync on (see `reference/data-and-sync.md`). Without it each machine sees the note once. That is acceptable: the note is per install by intent, and `data.json` is where every other per-install preference already lives.

## 4. What it looks like

An Obsidian `Modal` subclass, `ReleaseNoteModal`, in `infrastructure/obsidian/ReleaseNoteModal.ts`. Same DOM rules as every view: `contentEl.createDiv({ cls })`, classes in `styles.css`, sentence case, no hotkey.

```
┌───────────────────────────────────────────────┐
│ Creative Writer 0.11                          │  ← modal title (h2 from setTitle)
│                                               │
│ The plot grid and the reading lenses          │  ← headline, one line
│                                               │
│ • Lenses: one reading pass at a time          │
│ • Plot grid: a column per thread, a cell per  │  ← at most three bullets
│   stop                                        │
│ • Dialogue lens reads speech and thought      │
│                                               │
│ Two minutes of your time would help the next  │
│ version: what works, what is missing, and     │  ← the ask, two sentences
│ whether you want news of the suite.           │
│                                               │
│ [Tell me how it goes]  [What changed]  Close  │
└───────────────────────────────────────────────┘
```

- **Tell me how it goes** is the primary (`mod-cta`) button. It opens the form in the browser via `window.open(url)`, then closes the modal.
- **What changed** opens the GitHub release page for the current tag. Absent on the welcome variant, replaced by **Read the guide** (docs site, getting started).
- **Close** closes. Escape and the ✕ do the same. All three paths leave the seen version as already written.
- A footer line in `--font-ui-smaller`, opacity 0.7: *Shown once per update. Turn it off under Settings → Where it runs.*
- Width: Obsidian's default modal, no override. Nothing scrolls.

Welcome headline and bullets are fixed copy: *Thanks for installing.* / *Zen Mode and the editor lenses work in any note* / *The story tools start from a folder with `story: true`* / *The writer board is the ribbon icon*. The ask is the same on both variants.

## 5. Content lives in one file

`src/domain/release/notes.ts` exports:

```ts
export const FORM_URL = "https://…";           // the form (§7), no query string
export const RELEASE_URL = (v: string) => `https://github.com/amancioandre/creative-writer/releases/tag/${v}`;
export const GUIDE_URL = "https://amancioandre.github.io/creative-writer/guide/getting-started";
export const WELCOME: NoteCopy = { headline, bullets };
export const UPDATE: NoteCopy = { headline, bullets };   // rewritten for every minor/major release
```

Writing `UPDATE` is a step in `publishing.md` for a minor or major bump, next to the changelog entry; the two say the same thing, the note shorter. A patch release leaves it untouched. A test asserts `UPDATE.bullets.length <= 3` and that every URL is `https:` and carries no query string, so the "nothing identifies the user" promise is enforced, not remembered.

The form URL carries **no parameters** (a test asserts no `?` or `#` in any URL). The form asks for the version as an optional dropdown instead. A prefilled `?version=` would be harmless, but the README disclosure is then one sentence longer and the promise one step weaker; the dropdown costs the writer two seconds.

## 6. Settings, command, docs

- `PluginSettings.releaseNote: { enabled: boolean; seenVersion: string }`, default `{ enabled: true, seenVersion: "" }`. `normalizeSettings` narrows both with `typeof`.
- Settings tab, group *Where it runs*, last row: **Release notes** — *Show a short note once after an update, with a link to send feedback.* Toggle. Turning it off does not clear the seen version.
- Command `show-release-note`, name *Show release note*, in the `COMMANDS` table. Always opens the update variant for the current version, regardless of the seen version, and does not touch it.
- README, under **Privacy**, one paragraph: *After you install the plugin, and once after each minor update, it shows a short note about what changed with a link to a feedback form hosted on <service>. The note is built into the plugin; nothing is fetched and nothing is sent unless you open the link, and the link carries nothing about you or your vault. Turn it off under Settings → Where it runs → Release notes.* The same paragraph goes in `reference/settings.md` and `reference/faq.md` ("Why did a window open after the update?").
- `docs/reference/data-and-sync.md`: add `releaseNote.seenVersion` to the `data.json` row.
- Changelog entry for the version that ships it names the toggle.

## 7. The form and the newsletter

The plugin only needs a URL. The form side is a separate decision, made once:

**Form: Tally** (tally.so). Free without a response cap, no branding fee, hidden and prefilled fields, conditional logic, a "which version" dropdown, an email field with a required consent checkbox, native Notion / Google Sheets / Airtable export, webhooks and Zapier/Make for the hand-off to a mailing list. Belgian company, GDPR terms and EU hosting, which matters because the form collects email addresses. Alternatives: **Fillout** (similar, generous free tier, US), **Formbricks** (open source, self-hostable, if owning the data end to end matters more than the evening it costs), **Google Forms** (free and familiar, but a Google login to view and a Google address on the privacy line, which the audience this plugin courts tends to distrust).

**Newsletter: Substack.** The Creative Suite letter lives there, so the form's last page asks for it and the thank-you page links to `https://andramnc.substack.com/subscribe`. Substack has no API for adding subscribers, so the writers who tick *yes* are imported by hand from Tally with the consent line as the attestation Substack asks for. The form is specified block by block in `feedback-form.md`.

**Zero-infrastructure alternative.** A GitHub Discussion "How is it going?" as the feedback link, and the newsletter signup as the ESP's own hosted form. No form service at all, no data in a third place, and the discussion is public, which some writers will prefer and others will not.

**Privacy page.** Whichever service: one page on the docs site, `reference/privacy.md`, naming the form host, the mailing-list host, what is stored (answers, and an email only if given), why, and how to have it deleted. The developer policy only demands a privacy policy for server-side telemetry, but collecting emails from EU residents demands one regardless, and the README's Privacy section links to it.

## 8. Not doing

- No `Notice` toast on launch, ever.
- No "remind me later": Close is a dismissal.
- No in-modal form. The form is a web page; embedding it would be a network fetch inside the plugin's UI.
- No donation or sponsor line in the note: `fundingUrl` already shows it in the plugin browser, and the policy wants it nowhere else.
- No A/B copy, no counter of opens, no "shown" event anywhere.

## 9. Increments

1. `domain/release/ReleaseNote.ts` + `notes.ts` + tests (kind, order, URL invariants). No UI.
2. Settings field, normalisation, toggle, command. Modal with fixed copy; open from the command only. QA note in obsidian-dev.
3. Wire the layout-ready trigger; test the persist-before-open order with a fake repository. Bump `seenVersion` handling in a `versions.json`-style upgrade test (`0.10.1 → 0.11.0` shows, `0.11.0 → 0.11.1` does not).
4. README, settings and FAQ paragraphs, data-and-sync row, privacy page, publishing.md step. Create the form and the list; put the real URL in `notes.ts` last.
