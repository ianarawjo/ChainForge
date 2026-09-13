/**
 * Reading Blob contents, via FileReader.
 *
 * Blob.text() and Blob.arrayBuffer() are the obvious choices but only arrived
 * in Safari 14, and are absent from the jsdom used for tests -- so document
 * extraction would be untestable and would break on older Safari, which
 * ChainForge otherwise supports. FileReader is available everywhere and, for
 * text, maps invalid byte sequences to replacement characters instead of
 * throwing, matching the backend's errors="ignore" decode.
 */

/** Decodes a Blob as text, honouring any byte-order mark. */
export function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsText(blob);
  });
}

/** Reads a Blob's raw bytes, for parsers that want them. */
export function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(result);
      else reject(new Error("Could not read the file as binary data."));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsArrayBuffer(blob);
  });
}
