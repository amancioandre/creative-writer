# Zen Mode & focus

Four features that change how the page looks while you write. All are toggles under Settings → Writing; none of them touch the text, and none is a lens: they stay on under every [lens](/guide/lenses).

## Zen Mode

**Toggle Zen Mode** hides the ribbon, the tab headers, both sidebars, the status bar and the title bar, and stretches the editor to the window. Inside the note it also hides the properties block and the backlinks footer, and fades the note title (it returns to full strength while you edit it). Toggle again to bring everything back. The plugin adds one class to `<body>` and removes it on unload, so a crash or a reload never leaves you stuck without chrome.

**Zen Mode goes fullscreen** (off by default) also asks the window to go fullscreen when Zen Mode turns on.

Zen Mode admits one indicator: move the mouse and a small line inside the page says today's words and the way out (*Esc leaves Zen Mode*), then fades two seconds later; it never appears while you type. Escape, pressed on the page while no menu, prompt or suggestion is open, leaves Zen Mode.

Because the writing desk, the writer board, the story map, the plot grid, the threads and the manuscript live in leaves, Zen Mode hides them too — they are *about* the work, not the work. Zen Mode also shows no [lens](/guide/lenses): the page is plain, and the rhythm tint becomes a meter in the margin.

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
