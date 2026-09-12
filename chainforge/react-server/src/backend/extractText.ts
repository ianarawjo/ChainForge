/**
 * Extracting plain text from uploaded documents, in the browser.
 *
 * With a local ChainForge server, /mediaToText does this with markitdown
 * (PyMuPDF, python-docx, and friends). Without one there is no server to ask,
 * so anything we support has to be done here.
 *
 * Today that means formats which are already text. PDF and DOCX need real
 * parsers (pdf.js, mammoth); `canExtractTextInBrowser` is the single place to
 * update when those are added, and everything else keys off it.
 */

/**
 * Formats that are plain text once decoded, so they need no parser.
 *
 * Deliberately matched to the subset the backend also treats as text, so a
 * flow built in the browser behaves the same when run against a local server.
 */
const PLAIN_TEXT_EXTENSIONS = new Set([".txt", ".md"]);

/** Formats the backend can read but the browser currently cannot. */
const BACKEND_ONLY_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".xlsx",
  ".xls",
  ".pptx",
]);

/** The prefix MediaLookup gives uids it mints in the browser. */
const BROWSER_UID_MARKER = "__cache__";

/**
 * Decodes a Blob as UTF-8 text.
 *
 * Uses FileReader rather than Blob.text(): it is supported everywhere
 * ChainForge runs (including older Safari, and jsdom under test), and decodes
 * invalid byte sequences to replacement characters instead of throwing --
 * matching the backend's errors="ignore" decode.
 */
function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsText(blob);
  });
}

/**
 * Recovers the original filename from a browser-minted media uid.
 *
 * These look like `cache__<uuid>__cache__<filename>`; the filename can itself
 * contain underscores, so take everything after the final marker.
 */
export function fileNameFromUID(uid: string): string | undefined {
  const idx = uid.lastIndexOf(BROWSER_UID_MARKER);
  if (idx === -1) return undefined;
  const name = uid.slice(idx + BROWSER_UID_MARKER.length);
  return name.length > 0 ? name : undefined;
}

/** The lowercased extension of a filename, including the dot. "" if none. */
export function fileExtension(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const idx = base.lastIndexOf(".");
  // A leading dot means a dotfile (".gitignore"), not an extension.
  if (idx <= 0) return "";
  return base.slice(idx).toLowerCase();
}

/** Whether this file can be turned into text without a backend. */
export function canExtractTextInBrowser(nameOrUID: string): boolean {
  const name = fileNameFromUID(nameOrUID) ?? nameOrUID;
  return PLAIN_TEXT_EXTENSIONS.has(fileExtension(name));
}

/** Extensions readable in the browser, for populating file pickers. */
export function browserTextExtensions(): string[] {
  return Array.from(PLAIN_TEXT_EXTENSIONS).sort();
}

/**
 * Reads text out of an uploaded file, client-side.
 *
 * @param blob The file contents.
 * @param nameHint A filename or media uid used to detect the format. Falls
 *   back to the blob's own name, then its MIME type.
 * @throws If the format needs a parser we don't have in the browser, with a
 *   message explaining what to do instead.
 */
export async function extractTextInBrowser(
  blob: Blob,
  nameHint?: string,
): Promise<string> {
  const name =
    (nameHint ? fileNameFromUID(nameHint) : undefined) ??
    nameHint ??
    (blob as File).name ??
    "";
  const ext = fileExtension(name);

  // Anything already text decodes directly. Invalid byte sequences become
  // replacement characters rather than throwing, matching the backend's
  // errors="ignore" decode.
  if (PLAIN_TEXT_EXTENSIONS.has(ext)) return await readBlobAsText(blob);

  // No usable extension: fall back to the MIME type the browser reported.
  if (ext === "" && blob.type.startsWith("text/"))
    return await readBlobAsText(blob);

  const readable = browserTextExtensions().join(", ");
  if (BACKEND_ONLY_EXTENSIONS.has(ext))
    throw new Error(
      `Reading text out of ${ext} files requires the local ChainForge server. ` +
        `Run ChainForge locally to use ${ext} files, or upload ${readable} ` +
        `files to work entirely in the browser.`,
    );

  throw new Error(
    `Cannot read text from "${name || "this file"}" in the browser. ` +
      `Supported formats here are ${readable}; other formats require running ` +
      `ChainForge locally.`,
  );
}
