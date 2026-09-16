# Feedback form: build sheet for Tally

Status: **built in Tally on 2026-09-16 (form obJ6AN), still a draft.** Departures from the sheet, all deliberate: *Something else* is a plain option (Tally's *Other* field was dropped after it collided with the option); the version field's placeholder is *e.g. 0.10.1* and the email field's is *Optional*, with the promises as text lines under the titles; the consent line is a text block under the *Want it?* options, since options carry no descriptions; the thank-you page has the two links as text lines, Tally having no button block; the theme is *Custom* with the docs site's light palette (Inter, text #3c3c43, buttons and accent #3451b2 on white), as Tally offers Light, Dark or Custom but not both. One form for the whole Creative Suite, linked from the release note (`release-note.md`) and from every plugin README. Build it at tally.so block by block as below; Tally has no import format, so this page is the source of truth and the form should match it.

## Principles

- **Under two minutes.** Ten questions, three pages, every one skippable except the first. Writers finish short forms.
- **Ask stories, not scores.** One rating-shaped question for attachment; everything else is a choice or a sentence. The sentences are what a solo developer reads.
- **The newsletter is the last page, not the price.** Nobody has to give an email to send feedback. The Substack ask comes after they have said their piece.
- **Nothing identifies the writer** unless they type it. No hidden fields, no query parameters, no respondent tracking.

## Tally settings

Form name: *Creative Suite: how is it going?*

- **Settings → General:** progress bar on; *Close form after* off; *Save partial submissions* off (partial answers are half-consented).
- **Settings → Respondent data:** turn off anything that stores IP, location, or device metadata. Leave *Collect email* off; the email is an ordinary optional question so it can carry its own consent line.
- **Settings → Submit button:** label *Send*.
- **Notifications:** email to yourself on each response, so the form is read.
- **Integrations:** Google Sheets or Notion for the archive. The Substack side is manual (see *After a submission*).

## Page 1: You

Heading block: **Two minutes, three pages. Every question can be skipped.**

1. **Which plugin are you telling me about?** — Dropdown, *required*. The only required question; it drives the logic below.
   - Creative Writer
   - Creative Thesaurus
   - Both

2. **What do you write?** — Checkboxes.
   - Novels
   - Short stories
   - Serial fiction
   - Screenplays
   - Poetry
   - Essays and nonfiction
   - Fan fiction
   - Something else (with the *Other* field on)

3. **Where is the current project?** — Multiple choice.
   - Notes and ideas
   - First draft
   - Revising
   - Out with readers, agents or editors
   - Between projects

4. **Which language do you write in, and which do you think in?** — Short answer. Placeholder: *English, and Portuguese in my head.*
   (This is the question behind the thesaurus and the transcreation plans. Keep it.)

## Page 2: The plugin

5. **How long have you had it installed?** — Multiple choice.
   - I just installed it
   - A few sessions
   - Weeks
   - Months

6. **Which parts do you actually use?** — Checkboxes, *conditional*: shown when Q1 is *Creative Writer* or *Both*.
   - Zen Mode and typewriter scrolling
   - Focus fade
   - The rhythm tint
   - Style checks
   - Dialogue, words or accents lens
   - Story map
   - Plot grid
   - Story threads
   - Manuscript page
   - Writer board
   - Writing desk, goals and streaks
   - Model assistant

6b. **Which parts do you actually use?** — Checkboxes, *conditional*: shown when Q1 is *Creative Thesaurus* or *Both*.
   - The `/thesaurus::` command while typing
   - Looking up a phrase, not just a word
   - Antonyms and related words
   - *Look up at cursor* from the command palette
   - The history pane
   - Hovering a word to see where it came from
   - The local model's register and nuance notes
   - Explanations in a language other than English

7. **If it vanished tomorrow, you would…** — Multiple choice. This is the one attachment measure; it reads better than a star rating.
   - Not notice
   - Shrug and carry on
   - Miss it
   - Go looking for it
   - Write to ask what happened

8. **Tell me about one moment it helped, or one moment it got in the way.** — Long answer. Placeholder: *A scene, a sentence, a setting that fought you. Anything.*

9. **What is the one thing you wish it did?** — Long answer. Placeholder: *Or the one thing you wish it stopped doing.*

10. **Which version?** — Short answer, optional. Description: *Settings → Community plugins shows it. Skip if unsure.*

## Page 3: Keep in touch

Heading block: **That was the form. Two more things, both optional.**

11. **May I write back to you about this?** — Email, optional. Description: *Only to answer what you wrote above. Never added to any list.*

12. **The Creative Suite has a newsletter on Substack.** — Text block, then a Multiple choice:
   Text: *Roughly one letter per release: what changed, what is coming, and a note or two on writing with these tools. It lives at https://andramnc.substack.com.*
   Question: **Want it?**
   - Yes, add the email above (shown only if Q11 has a value: conditional on Q11 *is not empty*)
   - I will subscribe myself on Substack
   - No thanks

   Under the first option, a consent line as the option's description: *You agree to receive the newsletter; every issue has an unsubscribe link.* Tally cannot subscribe anyone to Substack directly, so the *Yes* answers are imported by hand (below).

**Thank-you page** (Settings → Thank you page, custom): *Thank you. The next release will be better for it.* Two buttons: **Subscribe on Substack** → `https://andramnc.substack.com/subscribe`, **Report a bug on GitHub** → the plugin's issues page. Redirect on completion **off**; sending nobody anywhere they did not click.

## After a submission

- Read it. Reply when Q11 is filled and there is something to say.
- Once a week or once a release, filter responses where Q12 is *Yes* and Q11 has a value, and import those addresses into Substack (*Subscribers → Import*). Substack asks you to confirm they opted in; the consent line on the option is that confirmation. Keep the export file out of any repo.
- Delete the email from the Tally archive after the import or the reply, so the form is not a second mailing list.

## Where the link goes

- The release note modal's primary button (`release-note.md`, §4).
- Every plugin README, in the *Support* section: one sentence with the form link and one with the Substack link.
- The docs site FAQ: *How do I send feedback?*

## Privacy page

`docs/reference/privacy.md`, linked from every README's *Privacy* section: the form is hosted by Tally (Belgium, GDPR), answers are stored there and in a private Google Sheet or Notion page, an email is stored only if given and used only as its question says, Substack holds the newsletter list under its own policy, and any of it is deleted on request to the author's address.
