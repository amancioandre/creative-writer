/** The writer's own grid templates: notes carrying `creative-writer-template` in the templates folder. */
export interface TemplateRepository {
  /** Where the templates live, vault-relative, no trailing slash. */
  folder(): string;
  /** Every template note in the folder, by name, with its markdown. */
  list(): Promise<readonly { readonly name: string; readonly path: string; readonly markdown: string }[]>;
  /** Writes a new template note, never over an existing one; resolves to the path written. */
  save(name: string, markdown: string): Promise<string>;
}
