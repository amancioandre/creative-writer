import { EMPTY_LOG, normalizeLog, type WritingLog } from "./WritingLog";

/**
 * The writing log as a markdown note inside the vault, so streaks and the
 * heatmap follow the writer to every device. Same shape as the story map
 * note: front matter flags, a line for a human who opens it, one JSON
 * block. Markdown is the one file type every sync method carries.
 */
export const WRITING_LOG_FLAG = "creative-writer-log";
export const WRITING_LOG_VERSION = 1;
export const DEFAULT_WRITING_LOG_NOTE = "Creative Writer/Writing log.md";

export function serializeWritingLogNote(log: WritingLog): string {
  return [
    "---",
    "creative-writer: false",
    `${WRITING_LOG_FLAG}: ${WRITING_LOG_VERSION}`,
    "---",
    "Creative Writer's writing log: words added and cut per day and per note, for the streaks and the heatmap in the writing desk. Kept as a note so it syncs with the vault. Editing it by hand is safe; deleting it starts the log afresh.",
    "",
    "```json",
    JSON.stringify(log),
    "```",
    "",
  ].join("\n");
}

const BLOCK = /```json\s*\n([\s\S]*?)\n```/;

export function parseWritingLogNote(markdown: string): WritingLog {
  const m = BLOCK.exec(markdown);
  if (!m) return EMPTY_LOG;
  try {
    return normalizeLog(JSON.parse(m[1]!));
  } catch {
    return EMPTY_LOG;
  }
}

export function isLogEmpty(log: WritingLog): boolean {
  return Object.keys(log.days).length === 0 && Object.keys(log.counts).length === 0;
}
