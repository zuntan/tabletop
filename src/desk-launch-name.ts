/** Recognize only the automatic untitled-name family, including legacy Japanese launches. */
function automaticIndex(name: string): number | undefined {
  if (!name) return 1;
  const match = /^(?:Untitled|無題)(?:\(([1-9]\d*)\))?$/.exec(name);
  if (!match) return undefined;
  const index = Number(match[1] ?? 1);
  return Number.isSafeInteger(index) ? index : undefined;
}

/** The server supplies a canonical automatic-name hint, not a translated document name. */
export function nextAutomaticDeskName(names: Iterable<string>): string {
  const used = new Set([...names].map(automaticIndex));
  let index = 1;
  while (used.has(index)) index++;
  return index === 1 ? 'Untitled' : `Untitled(${index})`;
}

/** A caller-supplied name stays literal unless the launcher explicitly marks it automatic. */
export function localizedLaunchName(name: string, automatic: boolean, untitled: string): string {
  const index = automatic ? automaticIndex(name) : undefined;
  return index === undefined ? name : index === 1 ? untitled : `${untitled}(${index})`;
}
