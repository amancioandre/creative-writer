/**
 * The release note: a modal shown once after install and once after a minor
 * or major update. Whether it shows is a pure function of the version last
 * shown and the version running; the plugin persists the answer before it
 * opens anything, so a crash can never make the note recur.
 */
export type NoteKind = "welcome" | "update";

export interface ReleaseNoteDecision {
  /** What to show, if anything. */
  readonly kind: NoteKind | null;
  /** The seen version to persist; unchanged when nothing should move. */
  readonly seen: string;
}

type Version = readonly [number, number, number];

/** "1.2.3" → [1, 2, 3]; anything else → null. A leading "v" is tolerated. */
export function parseVersion(raw: string): Version | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(raw.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const compare = (a: Version, b: Version): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * - the switch off → nothing, whatever the versions
 * - no seen version → the welcome note
 * - seen behind by a major or minor step → the update note
 * - seen behind by a patch only, or equal → nothing, but the seen version still moves up
 * - seen ahead (a downgrade, or a data.json synced from a machine that updated first) → nothing, left alone
 * - anything unparsable → nothing; a bad seen value is healed to the current version
 */
export function releaseNoteDecision(seenVersion: string, currentVersion: string, enabled: boolean): ReleaseNoteDecision {
  const current = parseVersion(currentVersion);
  if (!current) return { kind: null, seen: seenVersion };
  if (seenVersion === "") return { kind: enabled ? "welcome" : null, seen: currentVersion };
  const seen = parseVersion(seenVersion);
  if (!seen) return { kind: null, seen: currentVersion };
  if (compare(seen, current) > 0) return { kind: null, seen: seenVersion };
  const stepped = seen[0] !== current[0] || seen[1] !== current[1];
  return { kind: stepped && enabled ? "update" : null, seen: currentVersion };
}
