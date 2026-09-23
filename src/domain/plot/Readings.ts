import { quoteAppears } from "../text/LocateQuote";
import { ARC_ROLES, THREAD_ROLES, type StopRole } from "../threads/Thread";
import type { ColumnKind } from "../threads/StoryThreadsNote";

const MAX_TEXT = 200;
const ALL_ROLES: readonly StopRole[] = [...THREAD_ROLES, ...ARC_ROLES];
const MAX_QUOTE = 300;

/** A reading the model gave for one cell, kept only when its quote is on the page and its role is one the column allows. */
export interface ValidReading {
  readonly text: string;
  readonly role: StopRole | null;
  /** The scale word the model said the scene mostly appears to be, as the scale spells it; null off the scale or without one. */
  readonly keyword: string | null;
  readonly evidence: string;
}

/** `{reading: null}` is the model saying the scene does nothing for the thread; that is a valid answer and yields null. */
export function validateGridReading(raw: unknown, prose: string, kind: ColumnKind, scale: readonly string[] = []): ValidReading | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const o = (r.reading && typeof r.reading === "object" ? r.reading : null) as Record<string, unknown> | null;
  if (!o) return null;
  const text = typeof o.text === "string" ? o.text.trim().slice(0, MAX_TEXT) : "";
  const evidence = typeof o.evidence === "string" ? o.evidence.trim().slice(0, MAX_QUOTE) : "";
  if (!text || !evidence || !quoteAppears(prose, evidence)) return null;
  const roles: readonly StopRole[] = kind === "arc" ? ARC_ROLES : THREAD_ROLES;
  // A small model sometimes answers with the label where the note should be: "plant" is a role, not a reading.
  if ((ALL_ROLES as readonly string[]).includes(text.toLowerCase().replace(/[.:]$/, ""))) return null;
  const word = typeof o.role === "string" ? o.role.trim().toLowerCase() : "";
  const role = roles.find((x) => x === word) ?? null;
  const said = typeof o.keyword === "string" ? o.keyword.trim().toLowerCase() : "";
  const keyword = said ? scale.find((w) => w.toLowerCase() === said) ?? null : null;
  return { text, role: role === "touch" ? null : role, keyword, evidence };
}

/** A check's verdict: found with a quote that is on the page, or not found. A "found" with no locatable quote is not found. */
export function validateCheck(raw: unknown, prose: string): { readonly found: boolean; readonly evidence: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const evidence = typeof r.evidence === "string" ? r.evidence.trim().slice(0, MAX_QUOTE) : "";
  const found = r.found === true && !!evidence && quoteAppears(prose, evidence);
  return { found, evidence: found ? evidence : "" };
}
