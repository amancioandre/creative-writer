import { quoteAppears } from "../text/LocateQuote";
import { ARC_ROLES, THREAD_ROLES, type StopRole } from "../threads/Thread";
import type { ColumnKind } from "../threads/StoryThreadsNote";

const MAX_TEXT = 200;
const MAX_QUOTE = 300;

/** A reading the model gave for one cell, kept only when its quote is on the page and its role is one the column allows. */
export interface ValidReading {
  readonly text: string;
  readonly role: StopRole | null;
  readonly evidence: string;
}

/** `{reading: null}` is the model saying the scene does nothing for the thread; that is a valid answer and yields null. */
export function validateGridReading(raw: unknown, prose: string, kind: ColumnKind): ValidReading | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const o = (r.reading && typeof r.reading === "object" ? r.reading : null) as Record<string, unknown> | null;
  if (!o) return null;
  const text = typeof o.text === "string" ? o.text.trim().slice(0, MAX_TEXT) : "";
  const evidence = typeof o.evidence === "string" ? o.evidence.trim().slice(0, MAX_QUOTE) : "";
  if (!text || !evidence || !quoteAppears(prose, evidence)) return null;
  const roles: readonly StopRole[] = kind === "arc" ? ARC_ROLES : THREAD_ROLES;
  const word = typeof o.role === "string" ? o.role.trim().toLowerCase() : "";
  const role = roles.find((x) => x === word) ?? null;
  return { text, role: role === "touch" ? null : role, evidence };
}

/** A check's verdict: found with a quote that is on the page, or not found. A "found" with no locatable quote is not found. */
export function validateCheck(raw: unknown, prose: string): { readonly found: boolean; readonly evidence: string } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const evidence = typeof r.evidence === "string" ? r.evidence.trim().slice(0, MAX_QUOTE) : "";
  const found = r.found === true && !!evidence && quoteAppears(prose, evidence);
  return { found, evidence: found ? evidence : "" };
}
