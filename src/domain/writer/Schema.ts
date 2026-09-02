import { groupsOf } from "./Framework";
import { writerTag } from "./Tags";
import { WRITER_EXTENSION, WRITER_FILE_NAME, WRITER_VERSION, type WriterFile, resolveFramework } from "./WriterFile";

/**
 * The writer protocol as one text: what a note, a project note and the
 * writer file must contain for the board to read them. Written for a
 * person or an LLM harness that is migrating an existing board (a canvas,
 * a spreadsheet, a pile of notes) into the vault. The plugin ships no
 * importer; it ships this.
 */
export function writerSchema(file: WriterFile): string {
  const fw = resolveFramework(file);
  const prefix = file.prefix;
  const groups = groupsOf(fw);
  const tagRows = fw.layers.flatMap((l) => l.groups.map((g) => `| \`#${writerTag(prefix, g.id)}\` | ${l.name} / ${g.name} | ${g.hint} |`));
  const example = {
    version: WRITER_VERSION,
    framework: fw.id === "custom" ? fw : fw.id,
    prefix,
    colours: { [groups[0]!.id]: groups[0]!.colour },
    groups: { [groups[0]!.id]: { x: 0, y: 0, w: 480, h: 320 } },
    cards: { "notes/A note.md": { x: 40, y: 60 } },
    edges: [{ from: "notes/A note.md", to: "stories/A story/A story.md", label: "inspired by", colour: "#c9a44c" }],
    view: { x: 0, y: 0, k: 0.5 },
  };
  return [
    `# Creative Writer: the writer protocol`,
    ``,
    `The writer board is a collage of notes the writer placed on it, grouped by a framework (active: **${fw.name}**), plus the vault's declared story projects. The board owns nothing but layout: every card is an ordinary note, every story is an ordinary project folder. This text says what to write so the board reads it.`,
    ``,
    `## 1. Cards: a tag on any note`,
    ``,
    `A note anywhere in the vault becomes a card by carrying a nested tag under the prefix \`${prefix}\`, inline (\`#${prefix}/theme\`) or in front matter (\`tags: [${prefix}/theme, ${prefix}/quote]\`). A note may carry several. A tag whose suffix matches no group below goes to *Unsorted*; a bare \`#${prefix}\` does too. The tag changes nothing else: it does not opt the note out of the story map or the word count.`,
    ``,
    `| Tag | Layer / Group | What belongs there |`,
    `|---|---|---|`,
    ...tagRows,
    ``,
    `Do not move notes to declare them. Do not create a folder for the board. Do not write tags the writer did not ask for.`,
    ``,
    `## 2. Stories: declared projects`,
    ``,
    `A story is a folder with a project note, as everywhere in the plugin: any note in the folder with \`writing-target: <words>\` or \`story: true\` in its front matter. The board reads these keys on the project note, all optional:`,
    ``,
    `| Key | Values | Meaning |`,
    `|---|---|---|`,
    `| \`writing-stage\` | \`development\` \`drafting\` \`revising\` \`finished\` \`shelved\` | Where the story is. Without it, \`drafting\` is inferred once prose exists and \`finished\` once the target is met. |`,
    `| \`writing-premise\` | one sentence | The story question, shown on the story card. |`,
    `| \`writing-idea\` | \`"[[Idea note]]"\` | The premise card this story grew from. |`,
    `| \`writing-voice\` | \`"[[Voice note]]"\` | The narrator persona the story adopts. |`,
    ``,
    `An **idea** is a card in the \`premise\` group with no story yet. When it becomes one, the idea note gains \`writer-story: "[[Project note]]"\` and stays where it is, tag and all.`,
    ``,
    `A **reading** card may carry \`reading: to-read\`, \`reading\` or \`read\`.`,
    ``,
    `## 3. Uses: links and REF comments`,
    ``,
    `A story *uses* a card when any note in its folder links to the card. A plain \`[[wikilink]]\` counts. So does \`%% REF: [[Card]] %%\`, a comment form that keeps the link out of the manuscript page and any export. A card used by two or more stories is *recurring*. The plugin never writes REF comments by itself.`,
    ``,
    `## 4. The writer file`,
    ``,
    `One file per vault, \`${WRITER_FILE_NAME}\` (extension \`.${WRITER_EXTENSION}\`, JSON), the first one found by extension. It holds only what the notes cannot. Everything in it is optional; a missing or empty file still gives a full board.`,
    ``,
    "```json",
    JSON.stringify(example, null, 2),
    "```",
    ``,
    `| Field | Meaning |`,
    `|---|---|`,
    `| \`version\` | ${WRITER_VERSION}. |`,
    `| \`framework\` | \`"truby"\`, \`"generic"\`, or an inline \`{ name, layers: [{ name, groups: [{ id, name, colour, hint }] }] }\`. Group ids are lowercase letters, digits and hyphens and double as tag suffixes. |`,
    `| \`prefix\` | The tag prefix, default \`writer\`. |`,
    `| \`colours\` | Group id to hex colour, overriding the framework's. |`,
    `| \`groups\` | Group id to \`{ x, y, w, h }\`: its size, and its order among the groups of its layer by \`x\`. Groups flow left to right inside a layer and never overlap, so \`x\` and \`y\` are recomputed; only the order and the size are kept. |`,
    `| \`cards\` | Note path to \`{ x, y }\`: where the card sits, **relative to the top-left corner of its group**, so it travels with the group. Unplaced cards are laid out in the group's grid automatically. |`,
    `| \`edges\` | Named lines between two cards **whose notes link to each other**: \`{ from, to, label, colour }\`. An edge between notes that do not link is drawn dashed and offered for removal. |`,
    `| \`view\` | \`{ x, y, k }\`: the last pan and zoom. |`,
    ``,
    `Obsidian Sync carries this file only with *Sync all other types* enabled. Without it the board still works on each machine; only positions and edge names differ between them.`,
    ``,
    `## 5. Privacy`,
    ``,
    `The board is the writer's most private thing. Nothing on it is exported, sent to a model, or shown on the manuscript. It is read only back to the vault owner.`,
    ``,
  ].join("\n");
}
