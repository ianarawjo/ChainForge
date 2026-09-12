// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// The jsdom bundled here predates structuredClone, which fake-indexeddb needs
// in order to store values. Provide a minimal stand-in: enough for the record
// shapes we persist, and it preserves Blobs (which are immutable, so sharing
// the reference is safe) rather than destroying them the way a JSON round trip
// would. Only defined when genuinely missing, so a newer jsdom wins.
if (typeof globalThis.structuredClone !== "function") {
  const cloneValue = (value) => {
    if (value === null || typeof value !== "object") return value;
    if (typeof Blob !== "undefined" && value instanceof Blob) return value;
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof Map)
      return new Map(
        [...value.entries()].map(([k, v]) => [cloneValue(k), cloneValue(v)]),
      );
    if (value instanceof Set) return new Set([...value].map(cloneValue));
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
    if (Array.isArray(value)) return value.map(cloneValue);
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cloneValue(v);
    return out;
  };
  globalThis.structuredClone = cloneValue;
}
