import { describe, it, expect } from "vitest";
import { writerSchema } from "../../../src/domain/writer/Schema";
import { EMPTY_WRITER_FILE, setFramework } from "../../../src/domain/writer/WriterFile";

describe("writerSchema", () => {
  it("documents the active framework's tags, the front matter keys, REF and the file, with a parseable example", () => {
    const text = writerSchema(EMPTY_WRITER_FILE);
    expect(text).toContain("active: **Truby**");
    expect(text).toContain("| `#writer/archetype` | Wish list / Archetypes |");
    expect(text).toContain("| `#writer/voice` | Voices / Voices |");
    for (const key of ["writing-stage", "writing-premise", "writing-idea", "writing-voice", "writer-story", "reading: to-read"]) expect(text).toContain(key);
    expect(text).toContain("%% REF: [[Card]] %%");
    expect(text).toContain("Sync all other types");
    const json = /```json\n([\s\S]*?)\n```/.exec(text)![1]!;
    const example = JSON.parse(json) as { version: number; framework: string; prefix: string };
    expect(example.version).toBe(1);
    expect(example.framework).toBe("truby");
    expect(example.prefix).toBe("writer");
  });
  it("follows the file's prefix and an inline framework", () => {
    const file = setFramework({ ...EMPTY_WRITER_FILE, prefix: "me" }, { id: "x", name: "Mine", layers: [{ name: "L", groups: [{ id: "spark", name: "Sparks", colour: "#000000", hint: "Small fires." }] }] });
    const text = writerSchema(file);
    expect(text).toContain("active: **Mine**");
    expect(text).toContain("| `#me/spark` | L / Sparks | Small fires. |");
    const example = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(text)![1]!) as { framework: { name: string } };
    expect(example.framework.name).toBe("Mine");
  });
});
