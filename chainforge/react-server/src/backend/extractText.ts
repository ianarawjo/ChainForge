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

import { readBlobAsText } from "./blobRead";

/**
 * Formats that are plain text once decoded, so they need no parser.
 *
 * Deliberately matched to the subset the backend also treats as text, so a
 * flow built in the browser behaves the same when run against a local server.
 */
const PLAIN_TEXT_EXTENSIONS = new Set([".txt", ".md"]);

/**
 * Formats needing a parser we do ship to the browser, loaded on demand.
 *
 * Unlike the plain-text formats these do NOT round-trip identically against
 * the backend: /mediaToText uses markitdown (PyMuPDF), a different engine. The
 * backend is preferred whenever one exists; this is the fallback.
 */
const BROWSER_PARSED_EXTENSIONS = new Set([".pdf", ".docx"]);

/** Formats the backend can read but the browser still cannot. */
const BACKEND_ONLY_EXTENSIONS = new Set([".xlsx", ".xls", ".pptx"]);

/** The prefix MediaLookup gives uids it mints in the browser. */
const BROWSER_UID_MARKER = "__cache__";

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
  const ext = fileExtension(name);
  return PLAIN_TEXT_EXTENSIONS.has(ext) || BROWSER_PARSED_EXTENSIONS.has(ext);
}

/** Extensions readable in the browser, for populating file pickers. */
export function browserTextExtensions(): string[] {
  return [...PLAIN_TEXT_EXTENSIONS, ...BROWSER_PARSED_EXTENSIONS].sort();
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

  // Formats needing a parser. pdf.js is pulled in only at this point.
  if (ext === ".pdf") {
    const { extractPdfText } = await import("./pdfExtract");
    return await extractPdfText(blob);
  }
  if (ext === ".docx") {
    const { extractDocxText } = await import("./docxExtract");
    return await extractDocxText(blob);
  }

  // No usable extension: fall back to the MIME type the browser reported.
  if (ext === "" && blob.type.startsWith("text/"))
    return await readBlobAsText(blob);
  if (ext === "" && blob.type === "application/pdf") {
    const { extractPdfText } = await import("./pdfExtract");
    return await extractPdfText(blob);
  }

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
