# Model assistant

Optional. A language model reads a paragraph and adds findings the rules cannot see: a cliché that is only tired *in this context*, a metaphor that is fresh or dead, a passive that is hiding an agent. Everything is off by default and stays off until you choose a model.

## Choosing a model

Settings → Creative Writer → **Model assistant** → **Model**:

| Choice | Where it runs | Notes |
|---|---|---|
| **Off** (default) | — | No model calls anywhere. |
| **Local (Ollama)** | Your machine, via [Ollama](https://ollama.com) at **Ollama URL** (default `http://localhost:11434`) | Any chat model you have pulled, named in **Ollama model** (default `qwen2.5:7b`). Nothing leaves the computer. |
| **Claude** | Anthropic's API | Needs an **Anthropic API key**, stored in plain text in the plugin's `data.json` (the settings screen says so). **Daily spending cap** stops calls when today's spend reaches it; the status bar shows the session's cost. |

Which model to pull for Ollama: `qwen2.5:7b` is quick and fine for paragraph notes; `deepseek-r1:14b` is noticeably better at [myth](/guide/myth) and [relationship reading](/guide/model-reading) and abstains correctly on quiet passages, at the cost of speed.

::: warning Measured honestly
On the labelled corpus, a 7B local model scores far below the offline rules (F1 0.27–0.45 against 0.97) and cannot abstain — asked about a clean sentence, it finds something. That is why the rules own every mechanical check, the model is asked only about *judgement* kinds (cliché, metaphor, passive), its findings dedupe against rule findings, and the default is on-command. Numbers in [Testing & evaluation](/development/testing).
:::

## Running it

- **Analyse paragraph with model** — reads the paragraph under the cursor. Findings are tinted like rule findings; the status bar shows which model is working.
- **Analyse automatically** (off by default) runs the model after a pause in typing (**Pause before analysing**, default 1500 ms). Results are cached by paragraph text, an edit aborts the in-flight call, and stale results are never shown.

## How findings are validated

The model returns quotes, never character offsets — models are unreliable at arithmetic. A finding is kept only if its quoted span is actually in the paragraph and lands on token boundaries; anything else is dropped. The same principle guards the myth report and the story-map reading: **no quote, no claim.**

## Errors

A dead Ollama shows one notice a minute at most, not one per pause.
