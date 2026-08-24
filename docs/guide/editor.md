# Zen Mode & focus

Four features that change how the page looks while you write. All are toggles in Settings → Creative Writer; none of them touch the text.

## Zen Mode

**Toggle Zen Mode** hides the ribbon, the tab headers, both sidebars, the status bar and the title bar, and stretches the editor to the window. Toggle again to bring everything back. The plugin adds one class to `<body>` and removes it on unload, so a crash or a reload never leaves you stuck without chrome.

**Fullscreen in Zen Mode** (off by default) also asks the window to go fullscreen when Zen Mode turns on.

Because the writing desk, story map and timeline live in leaves, Zen Mode hides them too — they are *about* the work, not the work.

## Typewriter scrolling

Keeps the line you are writing vertically centred, so your eyes never travel to the bottom of the window. It recentres after each edit or cursor move, on the next animation frame, and only when the cursor line has actually moved — scrolling with the wheel to read something above is left alone.

## Current line

A faint full-width band behind the **visual line** you are on — the wrapped line, not the whole paragraph. It stays visible inside a focus-faded paragraph and follows the cursor as you type.

## Focus fade

A three-level hierarchy:

1. the line you are on, full strength;
2. the rest of its paragraph, slightly veiled (**Paragraph strength**, default 0.7);
3. other paragraphs faded progressively by distance, down to **Far text strength** (default 0.25) for the furthest.

Both strengths are sliders. Fade is computed over the visible viewport only, so it costs nothing on long notes.

## What a paragraph is

For every feature here and in [Paragraph rhythm](/guide/rhythm) and [Style checks](/guide/style-checks), a paragraph is a maximal run of non-blank lines. Markdown markup is irrelevant to it: a heading is a one-line paragraph, a list item is a line of one. Front matter and code fences are skipped by the prose-aware features (rhythm, readability, scenes) but are still "paragraphs" to focus fade, which is only about distance from the cursor.
