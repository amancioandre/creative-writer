import type { Card } from "../../domain/writer/Board";
import type { WriterVault } from "../ports/WriterVault";

/** The folders the generated shape carries; the project note is its only file. */
export const SCAFFOLD_FOLDERS = ["Characters", "Places", "Items", "Act I", "Act II", "Act III", "_Work"] as const;

export interface PromoteInput {
  /** The premise card the story grows from; null to start a story from nothing. */
  readonly idea: Card | null;
  readonly name: string;
  /** Vault-relative folder the story folder goes in; "" for the root. */
  readonly folder: string;
}

/**
 * An idea becomes a story: a folder is scaffolded, from a template folder
 * when one is declared (`story-template: true` on a note inside it,
 * `{{name}}` replaced in names and text) and otherwise in the documented
 * shape; the project note gets `story: true`, `writing-stage`,
 * `writing-premise` and `writing-idea`; the idea note gets `writer-story`
 * and stays where it is, tag and all.
 */
export class PromoteIdea {
  constructor(private readonly vault: WriterVault) {}

  /** Returns the new project note's path. */
  async execute(input: PromoteInput): Promise<string> {
    const name = safeName(input.name);
    if (!name) throw new Error("A story needs a name.");
    const folder = input.folder.replace(/^\/+|\/+$/g, "");
    const base = folder ? `${folder}/${name}` : name;
    if (this.vault.paths().some((p) => p.startsWith(`${base}/`)) || await this.vault.exists(base)) throw new Error(`${base} already exists.`);
    const keys: [string, string][] = [["story", "true"], ["writing-stage", "development"], ["writing-premise", yaml(premiseOf(input.idea))]];
    if (input.idea) keys.push(["writing-idea", yaml(`[[${basename(input.idea.path)}]]`)]);
    const template = this.template();
    let projectNote: string;
    if (template) {
      projectNote = await this.copyTemplate(template, base, name, keys);
    } else {
      for (const f of SCAFFOLD_FOLDERS) await this.vault.createFolder(`${base}/${f}`);
      projectNote = `${base}/${name}.md`;
      await this.vault.write(projectNote, `---\n${keys.map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n`);
    }
    if (input.idea) {
      const link = `[[${basename(projectNote)}]]`;
      await this.vault.processFrontMatter(input.idea.path, (fm) => { fm["writer-story"] = link; });
    }
    return projectNote;
  }

  /** Declares a folder a story: `story: true` on its namesake note, else its first note, else a new namesake note. */
  async declare(folder: string): Promise<string> {
    const clean = folder.replace(/^\/+|\/+$/g, "");
    const namesake = `${clean}/${basename(clean)}.md`;
    const inside = this.vault.paths().filter((p) => p.startsWith(`${clean}/`)).sort();
    const note = (await this.vault.exists(namesake)) ? namesake : inside[0] ?? namesake;
    if (!(await this.vault.exists(note))) await this.vault.write(note, "");
    await this.vault.processFrontMatter(note, (fm) => { fm["story"] = true; });
    return note;
  }

  /** The note declaring itself a template, and the folder it sits in. */
  template(): { note: string; folder: string } | null {
    for (const p of this.vault.paths()) {
      const fm = this.vault.frontmatter(p);
      if (fm && (fm["story-template"] === true || fm["story-template"] === "true")) return { note: p, folder: p.slice(0, p.lastIndexOf("/")) };
    }
    return null;
  }

  private async copyTemplate(template: { note: string; folder: string }, base: string, name: string, keys: [string, string][]): Promise<string> {
    const prefix = template.folder ? `${template.folder}/` : "";
    let projectNote = "";
    for (const p of this.vault.paths()) {
      if (!p.startsWith(prefix) || (template.folder === "" && p.includes("/"))) continue;
      const rel = p.slice(prefix.length).split("{{name}}").join(name);
      const target = `${base}/${rel}`;
      let text = (await this.vault.read(p)).split("{{name}}").join(name);
      if (p === template.note) { text = withProjectKeys(text, keys); projectNote = target; }
      await this.vault.write(target, text);
    }
    return projectNote;
  }
}

/** The idea's first sentence, as the story's premise. */
export function premiseOf(idea: Card | null): string {
  if (!idea?.excerpt) return "";
  const m = /^(.*?[.!?])(\s|$)/.exec(idea.excerpt);
  return (m ? m[1]! : idea.excerpt).trim().slice(0, 300);
}

/** Inserts the project keys into a copied template note's front matter, replacing `story-template`; adds a block when there is none. */
export function withProjectKeys(text: string, keys: [string, string][]): string {
  const lines = keys.map(([k, v]) => `${k}: ${v}`).join("\n");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return `---\n${lines}\n---\n${text}`;
  const body = m[1]!.split(/\r?\n/).filter((l) => !/^\s*story-template\s*:/.test(l) && !keys.some(([k]) => new RegExp(`^\\s*${k}\\s*:`).test(l)));
  return `---\n${[...body, lines].filter(Boolean).join("\n")}\n---\n${text.slice(m[0].length)}`;
}

export function safeName(raw: string): string {
  return raw.replace(/[\\/:*?"<>|#^[\]]+/g, " ").replace(/\s+/g, " ").trim();
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}

function yaml(s: string): string {
  return JSON.stringify(s);
}
