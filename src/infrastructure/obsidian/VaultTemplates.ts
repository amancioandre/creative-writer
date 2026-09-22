import type { TemplateRepository } from "../../application/ports/TemplateRepository";
import { TEMPLATE_FLAG, templateFileName } from "../../domain/plot/Templates";
import type { NoteVaultLike } from "./StoryMapNoteRepository";
import { frontMatterOf, type VaultAppLike } from "./VaultProjectNotes";

/**
 * Template notes in the folder the settings name. A note counts when its
 * front matter carries the template flag, read from the cache or, for a
 * note written a moment ago, from the text.
 */
export class VaultTemplates implements TemplateRepository {
  constructor(private readonly app: VaultAppLike, private readonly io: NoteVaultLike, private readonly folderSetting: () => string) {}

  folder(): string {
    return this.folderSetting().replace(/^\/+|\/+$/g, "");
  }

  async list(): Promise<{ name: string; path: string; markdown: string }[]> {
    const folder = this.folder();
    const out: { name: string; path: string; markdown: string }[] = [];
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (folder && !f.path.startsWith(`${folder}/`)) continue;
      const cached = this.app.metadataCache.getFileCache(f)?.frontmatter;
      const text = await this.app.vault.cachedRead(f);
      const fm = cached ?? frontMatterOf(text);
      if (!fm || fm[TEMPLATE_FLAG] === undefined) continue;
      const name = typeof fm["writing-name"] === "string" && fm["writing-name"].trim() ? fm["writing-name"].trim() : f.path.slice(f.path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
      out.push({ name, path: f.path, markdown: text });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  async save(name: string, markdown: string): Promise<string> {
    const folder = this.folder();
    const taken = this.app.vault.getMarkdownFiles().filter((f) => !folder || f.path.startsWith(`${folder}/`)).map((f) => f.path.slice(f.path.lastIndexOf("/") + 1).replace(/\.md$/i, ""));
    const path = `${folder ? `${folder}/` : ""}${templateFileName(name, taken)}.md`;
    await this.io.write(path, markdown);
    return path;
  }
}
