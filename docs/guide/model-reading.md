# Reading a project

The offline pass knows *who* shares a scene. A local model can say *how*: the relationships between the people in a scene, the outside references the scene is invoking, and what happens. This is the **References** layer of the [story map](/guide/story-map), the labelled edges in its **Scenes** layer, and the event lines in the [timeline](/guide/story-timeline).

Needs **Local (Ollama)** as the model. `deepseek-r1:14b` is recommended.

## Running it

From the story map panel, **Read project with model** reads every scene of the project. On a chapter node's card (turn on the *Notes* kind), **Read with model** reads just that note. The command **Read this note with model (story map)** reads the active note when run from an editor.

The status line bottom-left counts scenes as they go; press the button again to stop. Nothing is lost on stop: the result is saved after every scene.

## What the model is asked

For each scene, the model gets the prose and the list of names known to be in it, and returns:

- **relations** — `from`, `to` (both from the given names), a one-to-three-word label ("sister", "rival", "owes money to", "guards"), and a verbatim quote;
- **references** — name ("Orpheus and Eurydice", "the 1755 Lisbon earthquake"), kind (myth, history, literature, scripture, other), which given name carries the echo, one sentence on the parallel, and a quote. Indirect echoes only when the parallel is specific — a descent with a rule not to look back, not "a journey";
- **events** — plot as it happens ("Marta confesses the theft to Ilse"), participants from the given names, a quote. At most five.

## What is kept

- A relation must join two names that were on the list, and must not be self-referential. "Marta" is accepted for *Marta Kovács* by the same lookup the map uses.
- Every claim must quote the scene verbatim; the quote is checked. No quote, no claim.
- Duplicates (same pair, same label) collapse.

A model that invents a cousin does not get a node. This is deliberate and makes the reading conservative — a 7B model may return little; a 14B model returns more of what survives.

## Incremental by design

Each reading is stored with a hash of the scene's prose. Next time, unchanged scenes are skipped ("Unchanged 2/7"), so re-reading a novel after editing one scene costs one scene. An edited scene's old edges turn **dashed** on the map until it is re-read. Renaming a heading counts as a new scene.

Readings are stored in `Story map.md` inside the project folder — see [Files & sync](/reference/data-and-sync).
