/** Enter or Space, the keys that press a button. */
export function isActivationKey(ev: KeyboardEvent): boolean {
  return ev.key === "Enter" || ev.key === " ";
}

/**
 * Makes an element act like a button from the keyboard as well as the mouse:
 * a click, Enter or Space runs `run`. Space is prevented so the pane does not
 * scroll, Enter so a surrounding key handler does not treat it as its own.
 * Elements without the role or a tab stop get both, so the row is reachable.
 */
export function onActivate(el: Element, run: (ev: Event) => void, opts: { readonly tabIndex?: number; readonly role?: boolean } = {}): void {
  if (opts.role !== false && !el.getAttribute("role")) el.setAttribute("role", "button");
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", String(opts.tabIndex ?? 0));
  el.addEventListener("click", (ev) => run(ev));
  el.addEventListener("keydown", (ev) => {
    const key = ev as KeyboardEvent;
    if (!isActivationKey(key) || key.target !== el) return;
    key.preventDefault();
    key.stopPropagation();
    run(key);
  });
}

/** True for a key event that started in a field, where the panel's own keys must stay out of the way. */
export function inField(ev: KeyboardEvent): boolean {
  const t = ev.target as HTMLElement | null;
  const tag = t?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!t?.isContentEditable;
}
