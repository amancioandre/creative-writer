# Myth & archetype

Select a scene — forty words or more — and run **Analyse selection for myth and archetype**. A sidebar report says what the passage is echoing, if it is echoing anything.

Needs **Local (Ollama)** as the model; `deepseek-r1:14b` does noticeably better than 7B here.

## The report

- **Summary** — one sentence naming the mythic register of the passage, or nothing.
- **Patterns** — structural or mythic patterns the passage is enacting: katabasis, threshold crossing, the refusal of the call, the wounded king, the trickster's bargain, the recognition scene, the forbidden room, the unburied dead… Each with a verbatim quote from the passage and a note on what the pattern traditionally asks of the story next — the debt the scene has taken on.
- **Archetypes** — figures present (mentor, herald, threshold guardian, shadow, shapeshifter, trickster, the crone, the psychopomp…), who carries each, and a quote.
- **What the pattern asks next** — two or three sentences for the writer about where the pattern wants to go and what refusing it would cost.

## Why an empty report is a good report

The prompt is explicit that most passages are not myths and that a quiet domestic scene with no descent, no threshold and no guardian gets an empty list. Every quote is checked against the passage; a pattern whose evidence is not actually there is dropped. The one thing this guards against is a model that sees Campbell everywhere.

## Relation to the story map

The myth report is per selection and lives in the sidebar for the session. The story map's [reading](/guide/model-reading) covers something adjacent — outside *references* per scene, persisted — and both use the same rule: verbatim evidence or nothing.
