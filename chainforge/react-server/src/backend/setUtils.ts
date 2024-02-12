// Returns whether two sets are equal.
export function isEqual<T>(a: Set<T>, b: Set<T>): boolean {
  return isSubset(a, b) && isSubset(b, a);
}

// Returns the union of two sets.
export function union<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a, ...b]);
}

// Returns whether A is a subset of B.
export function isSubset<T>(a: Set<T>, b: Set<T>): boolean {
  return [...a].every((x) => b.has(x));
}

export function isSuperset<T>(a: Set<T>, b: Set<T>): boolean {
  return isSubset(b, a);
}

export function subtract<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => !b.has(x)));
}

// A is an "extension" of B and C if
// (1) A is a superset of B
// (2) The elements in A that are not in B are a subset of C.
export function isExtension<T>(a: Set<T>, b: Set<T>, c: Set<T>): boolean {
  return isSuperset(a, b) && isSubset(subtract(a, b), c);
}

// Returns whether A is an "extension" of B and C, ignoring empty strings.
export function isExtensionIgnoreEmpty(a: string[], b: string[], c: string[]) {
  const emptyStringFilter = (x: string) => x !== "";
  return isExtension(
    new Set(a.filter(emptyStringFilter)),
    new Set(b.filter(emptyStringFilter)),
    new Set(c.filter(emptyStringFilter)),
  );
}
