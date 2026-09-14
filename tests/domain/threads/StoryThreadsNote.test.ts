import { describe, it, expect } from "vitest";
import { addThread, removeThread, appendThreadItems, formatThreadItem, parseStopText, parseStoryThreads, removeThreadItem, renameThread, resolveThreadRef, sameLink, serializeStoryThreadsNote, upsertThreadItem } from "../../../src/domain/threads/StoryThreadsNote";

const note = `---
creative-writer: false
creative-writer-threads: 1
---
Story threads for **Novel**.

# Not a thread

## The letter
- [[Chapter 3#The station]] — Anna pockets it
- [Dinner](Chapter%2012.md#Dinner) — first mentioned aloud
- Chapter 41#The reading — payoff
- [[Chapter 50]]

## Empty

\`\`\`
- [[Ignored#In a fence]]
\`\`\`
`;

describe("Story threads note", () => {
  it("parses one thread per ## heading, with wiki, markdown and bare links", () => {
    const threads = parseStoryThreads(note);
    expect(threads.map((t) => t.name)).toEqual(["The letter", "Empty"]);
    expect(threads[0]!.items).toEqual([
      { link: "Chapter 3#The station", note: "Anna pockets it", line: 9, role: "touch", quote: null },
      { link: "Chapter 12#Dinner", note: "first mentioned aloud", line: 10, role: "touch", quote: null },
      { link: "Chapter 41#The reading", note: "payoff", line: 11, role: "touch", quote: null },
      { link: "Chapter 50", note: "", line: 12, role: "touch", quote: null },
    ]);
    expect(threads[1]!.items).toEqual([]);
  });

  it("reads a role and a quoted anchor off a line; a line without them is a touch", () => {
    const md = `## The letter
- [[Chapter 3#The station]] — plant: "she pocketed the letter without reading it"
- [[Chapter 12#Dinner]] — Touch: first mentioned aloud
- [[Chapter 41#The reading]] — payoff: “addressed to her mother” the reveal
- [[Chapter 2#Harbour]] — "salt on the wind"
- [[Chapter 9#Rain]] — reversal:
`;
    expect(parseStoryThreads(md)[0]!.items.map((i) => [i.role, i.quote, i.note])).toEqual([
      ["plant", "she pocketed the letter without reading it", ""],
      ["touch", null, "first mentioned aloud"],
      ["payoff", "addressed to her mother", "the reveal"],
      ["touch", "salt on the wind", ""],
      ["reversal", null, ""],
    ]);
    expect(parseStopText("payoff is not a role here")).toEqual({ role: "touch", quote: null, note: "payoff is not a role here" });
  });

  it("writes a stop line in a fixed order and reads it back the same", () => {
    expect(formatThreadItem("One#Quay", "Anna", { role: "plant", quote: "she pocketed it" })).toBe('- [[One#Quay]] — plant: "she pocketed it" Anna');
    expect(formatThreadItem("One#Quay", "", { role: "touch", quote: null })).toBe("- [[One#Quay]]");
    expect(formatThreadItem("One#Quay", "", { quote: 'he said "no"' })).toBe(`- [[One#Quay]] — "he said 'no'"`);
    const line = formatThreadItem("One#Quay", "note", { role: "reversal", quote: "her mother" });
    expect(parseStoryThreads(`## T\n${line}`)[0]!.items[0]).toMatchObject({ role: "reversal", quote: "her mother", note: "note" });
  });

  it("keeps a stop's role and quote when only its note changes, and replaces them when given", () => {
    const md = '## T\n- [[One#Quay]] — plant: "she pocketed it" first\n';
    expect(upsertThreadItem(md, "T", "One#Quay", "second")).toBe('## T\n- [[One#Quay]] — plant: "she pocketed it" second\n');
    expect(upsertThreadItem(md, "T", "One#Quay", "", { role: "payoff", quote: null })).toBe("## T\n- [[One#Quay]] — payoff:\n");
    expect(appendThreadItems("", "Salt", [{ link: "One#Quay", note: "", quote: "salt on the wind" }, { link: "Two#Return", note: "", quote: "salt on the wind" }]))
      .toBe('## Salt\n- [[One#Quay]] — "salt on the wind"\n- [[Two#Return]] — "salt on the wind"\n');
  });

  it("adds a stop to an existing thread, updates the note of an existing stop, or starts a new thread", () => {
    const added = upsertThreadItem(note, "the letter", "Chapter 7#Attic", "hidden");
    expect(added.split("\n")[13]).toBe("- [[Chapter 7#Attic]] — hidden");
    const relabelled = upsertThreadItem(note, "The letter", "[[Chapter 3#the station]]", "planted");
    expect(relabelled.split("\n")[9]).toBe("- [[Chapter 3#The station]] — planted");
    expect(parseStoryThreads(relabelled)[0]!.items).toHaveLength(4);
    const fresh = upsertThreadItem("", "Motif: gulls", "One#Quay", "");
    expect(fresh).toBe("## Motif: gulls\n- [[One#Quay]]\n");
    const appended = upsertThreadItem(note, "New", "Two#Return", "x");
    expect(appended.endsWith("\n\n## New\n- [[Two#Return]] — x\n")).toBe(true);
  });

  it("removes a stop, taking an emptied thread's heading with it", () => {
    const one = removeThreadItem(note, "The letter", "Chapter 12#dinner");
    expect(parseStoryThreads(one)[0]!.items.map((i) => i.link)).toEqual(["Chapter 3#The station", "Chapter 41#The reading", "Chapter 50"]);
    let md = "## Solo\n- [[One#Quay]]\n\n## Other\n- [[Two#Return]]\n";
    md = removeThreadItem(md, "Solo", "One#Quay");
    expect(md).toBe("## Other\n- [[Two#Return]]\n");
    expect(removeThreadItem(md, "Nope", "x")).toBe(md);
  });

  it("renames a thread heading", () => {
    expect(renameThread(note, "the letter", "The envelope").split("\n")[8]).toBe("## The envelope");
    expect(renameThread(note, "Nope", "X")).toBe(note);
    expect(renameThread(note, "The letter", " ")).toBe(note);
  });

  it("compares links by note basename and heading, case aside", () => {
    expect(sameLink("Chapters/One#Quay", "[[One#quay]]")).toBe(true);
    expect(sameLink("One#Quay", "One#Creek")).toBe(false);
    expect(sameLink("One", "One")).toBe(true);
  });

  it("resolves links to scenes, falls back to a note's first scene, and keeps broken links visible", () => {
    const scenes = [
      { scene: { path: "Novel/Chapter 3.md", title: "The station", line: 4 }, index: 2 },
      { scene: { path: "Novel/Chapter 3.md", title: "Platform", line: 40 }, index: 3 },
      { scene: { path: "Novel/Chapter 12.md", title: "Dinner", line: 0 }, index: 7 },
    ];
    expect(resolveThreadRef({ link: "Chapter 3#the STATION", note: "n", line: 1, role: "touch", quote: null }, scenes)).toEqual({ scene: scenes[0]!.scene, index: 2, note: "n", line: 1, role: "touch" });
    expect(resolveThreadRef({ link: "Chapter 3", note: "", line: 2, role: "plant", quote: "q" }, scenes)).toMatchObject({ index: 2, role: "plant", quote: "q" });
    const broken = resolveThreadRef({ link: "Chapter 99#Nowhere", note: "?", line: 3, role: "touch", quote: null }, scenes);
    expect(broken.index).toBe(-1);
    expect(broken.unresolved).toBe("Chapter 99#Nowhere");
    expect(broken.scene).toEqual({ path: "Chapter 99", title: "Nowhere", line: 0 });
  });

  it("serialises a first note with the opt-out front matter", () => {
    const md = serializeStoryThreadsNote("Novel");
    expect(md.startsWith("---\ncreative-writer: false\ncreative-writer-threads: 1\n---")).toBe(true);
    expect(md).toContain("Story threads for **Novel**");
    expect(parseStoryThreads(md)).toEqual([]);
  });

  it("starts a thread with no stops, once, and takes a whole thread out with its section", () => {
    const md = "## The letter\n- [[One#Camp]] — x\n";
    const added = addThread(md, "Theme: Salt");
    expect(added).toBe("## The letter\n- [[One#Camp]] — x\n\n## Theme: Salt\n");
    expect(addThread(added, "theme: salt")).toBe(added);
    expect(addThread("", "  ")).toBe("");
    expect(parseStoryThreads(added).map((t) => [t.name, t.items.length])).toEqual([["The letter", 1], ["Theme: Salt", 0]]);
    const three = addThread(added, "Last");
    expect(removeThread(three, "Theme: Salt")).toBe("## The letter\n- [[One#Camp]] — x\n\n## Last\n");
    expect(removeThread(three, "The letter")).toBe("## Theme: Salt\n\n## Last\n");
    expect(removeThread(three, "Nobody")).toBe(three);
  });
});
