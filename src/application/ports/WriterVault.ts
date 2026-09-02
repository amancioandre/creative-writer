/** The vault as the writer's stories row and promotion need it: paths, front matter, links, files and folders. */
export interface WriterVault {
  /** Every Markdown note's path. */
  paths(): string[];
  frontmatter(path: string): Record<string, unknown> | null;
  /** A link as written to the path it points at, or null. */
  resolve(link: string, from: string): string | null;
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  /** Creates the file and any missing folders, or overwrites. */
  write(path: string, text: string): Promise<void>;
  createFolder(path: string): Promise<void>;
  processFrontMatter(path: string, change: (fm: Record<string, unknown>) => void): Promise<void>;
  /** Whether any note in the folder has a paragraph of prose. */
  folderHasProse(folder: string): Promise<boolean>;
}
